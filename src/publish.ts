import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { getRepoInfo } from './get-repo-info'
import { createRunner } from './run-command'
import { createRelease } from './create-release'
import { expectedError } from './expected-error'

export async function publish(
  argv: readonly string[],
  env: typeof process.env,
  workdir: string,
) {
  const runner = createRunner({
    dryRun: argv.includes('--dry-run'),
    env,
    cwd: workdir,
    verbose: argv.includes('--verbose'),
  })

  const ci = Boolean(argv.includes('--ci') || process.env['CI'])
  if (!ci && !runner.dryRun) {
    throw expectedError('Manual publish is no longer supported', 2)
  }

  const pkgJsonFile = path.join(workdir, 'package.json')
  const oldPkgJson = fs.readFileSync(pkgJsonFile, 'utf8')
  const isPackageDefinitelyPublic = JSON.parse(oldPkgJson)['private'] === false

  const info = await getRepoInfo({
    tokenFile: argv[0],
    env,
    ci,
    pkgJson: JSON.parse(oldPkgJson),
  })
  if (runner.verbose) {
    console.log('info', info)
  }

  const packageManager = detectPackageManager(workdir, JSON.parse(oldPkgJson))

  const rl = ci ? null : readline.createInterface(process.stdin, process.stdout)
  try {
    let { newVersion, oldVersion } = await getVersions()
    if (newVersion === oldVersion) {
      throw expectedError('Old version and new version are the same', 0)
    }

    const tag = `v${newVersion}`
    const name = `Version ${newVersion}`

    const taglist = runner.cmdOut('git', ['tag', '-l', tag])
    if (taglist) {
      throw expectedError(
        `Git tag ${tag} already exists`,
        oldVersion === '' ? 0 : 1,
      )
    }
    const lastTag = getLastTag(oldVersion)

    const npmtag = extractTag(newVersion)
    const prerelease = npmtag !== 'latest'

    console.log('Creating release')
    console.log('  name:', name)
    console.log('  tag:', tag)
    console.log('  lastTag:', lastTag || '<no tags found>')
    console.log('  npmtag:', npmtag)
    console.log('  prerelease:', prerelease)
    const changelog = runner
      .cmdOut(
        'git',
        ['log', lastTag ? `${lastTag}..HEAD` : '', '--oneline'].filter(Boolean),
      )
      .trim()
      .split('\n')
      .map((l) => `- ${highlightCommit(l)}`)
      .join('\n')
    console.log('Dry run:', runner.dryRun)
    console.log(
      'Changelog (you can edit this via',
      info.github ? 'github' : 'gitlab',
      'later):',
    )
    console.log(changelog)

    const ref = runner.cmdOut('git', ['rev-parse', 'HEAD']).trim()

    await createRelease({
      runner,
      info,
      args: {
        body: changelog,
        tag,
        title: name,
        prerelease,
        ref,
        draft: !argv.includes('--no-draft'),
      },
    })

    if (packageManager === 'pnpm') {
      runner.cmd(
        'pnpm',
        [
          'publish',
          '--no-git-checks',
          isPackageDefinitelyPublic ? ['--access', 'public'] : [],
          npmtag ? ['--tag', npmtag] : [],
        ].flat(),
      )
    } else {
      const version = runner.cmdOut('yarn', ['--version'])
      const modern = !version.startsWith('1.')

      runner.cmd(
        'yarn',
        [
          modern
            ? ['npm', 'publish']
            : ['publish', '--non-interactive', '--no-git-tag-version'],
          isPackageDefinitelyPublic ? ['--access', 'public'] : [],
          npmtag ? ['--tag', npmtag] : [],
        ].flat(),
      )
    }
  } finally {
    rl?.close()
  }

  async function getVersions(): Promise<{
    oldVersion: string
    newVersion: string
  }> {
    const newVersion: string = JSON.parse(oldPkgJson)['version']

    const packageName = JSON.parse(oldPkgJson)['name']

    const showCmd = packageManager === 'pnpm' ? 'pnpm' : 'npm'
    const showSubcmd = packageManager === 'pnpm' ? 'view' : 'show'

    const cerr = runner.npmErrJsonOut(showCmd, [
      showSubcmd,
      packageName,
      '--json',
    ])
    if (
      cerr?.error?.code === 'E404' ||
      cerr?.error?.code === 'ERR_PNPM_FETCH_404'
    ) {
      return { oldVersion: '', newVersion }
    }

    const versionInfo = runner.cmdOut(showCmd, [
      showSubcmd,
      packageName + '@' + newVersion,
      'version',
    ])

    // newVersion exits
    if (versionInfo) {
      return {
        oldVersion: newVersion,
        newVersion,
      }
    }
    const oldVersion = (
      runner.cmdOut(showCmd, [
        showSubcmd,
        packageName + '@' + extractTag(newVersion),
        'version',
      ]) || runner.cmdOut(showCmd, [showSubcmd, packageName, 'version'])
    ).trim()
    return { oldVersion, newVersion }
  }

  function getLastTag(oldVersion: string) {
    if (!runner.cmdOut('git', ['tag', '-l']).trim()) {
      // no tags
      return null
    }
    const oldTag = 'v' + oldVersion
    if (tagExists(oldTag)) {
      return oldTag
    }
    return runner.cmdOut('git', ['describe', '--tags', '--abbrev=0']).trim()
  }

  function tagExists(tag: string) {
    const ref = runner
      .cmdOut('git', ['rev-parse', tag], {
        allowErr: true,
      })
      .trim()
    return Boolean(ref) && tag !== ref
  }
}

function highlightCommit(line: string) {
  const parts = line.split(' ')
  if (parts[1]?.endsWith(':')) {
    parts[1] = `**${parts[1]}**`
  }
  return parts.join(' ')
}

function detectPackageManager(
  workdir: string,
  pkgJson: {
    packageManager?: string
    devEngines?: {
      packageManager?: DevEnginesPackageManager | DevEnginesPackageManager[]
    }
  },
): 'pnpm' | 'yarn' {
  if (pkgJson.packageManager && !pkgJson.devEngines?.packageManager) {
    const [name, version] = pkgJson.packageManager.split('@')
    console.warn(
      [
        '`packageManager` field is not used for package manager detection.',
        'Please replace it with `devEngines` instead:',
        '',
        JSON.stringify(
          {
            devEngines: {
              packageManager: { name, version, onFail: 'download' },
            },
          },
          null,
          2,
        ),
      ].join('\n'),
    )
  }

  const devEngines = pkgJson.devEngines?.packageManager
  const devEnginesList = Array.isArray(devEngines)
    ? devEngines
    : devEngines
      ? [devEngines]
      : []
  const preferred =
    devEnginesList.find((e) => e.onFail !== 'ignore') ?? devEnginesList[0]
  if (preferred?.name === 'pnpm') return 'pnpm'
  if (preferred?.name === 'yarn') return 'yarn'

  if (fs.existsSync(path.join(workdir, 'pnpm-lock.yaml'))) return 'pnpm'
  return 'yarn'
}

type DevEnginesPackageManager = {
  name?: string
  version?: string
  onFail?: 'ignore' | 'warn' | 'error'
}

function extractTag(version: string) {
  return (
    version
      .split('-')[1]
      ?.split(/[^a-z]/i)?.[0]
      ?.toLowerCase() || 'latest'
  )
}
