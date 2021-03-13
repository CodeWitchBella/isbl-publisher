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
  const ci = Boolean(argv.includes('--ci') || process.env['CI'])
  const runner = createRunner({
    dryRun: argv.includes('--dry-run'),
    env,
    cwd: workdir,
    verbose: argv.includes('--verbose'),
  })

  const dirty = runner.cmdOut('git', ['status', '--porcelain'])
  if (dirty && !argv.includes('--allow-dirty') && !ci) {
    throw 'You have uncommited changes... Commit your changes first'
  }

  const pkgJsonFile = path.join(workdir, 'package.json')
  const oldPkgJson = fs.readFileSync(pkgJsonFile, 'utf8')
  const isPackageDefinitelyPublic = JSON.parse(oldPkgJson)['private'] === false

  const info = await getRepoInfo({ tokenFile: argv[0], env, ci })
  if (info.github && ci) {
    throw expectedError('CI is only supported for gitlab (for now)')
  }

  const rl = ci ? null : readline.createInterface(process.stdin, process.stdout)
  try {
    let { newVersion, oldVersion } = await getVersions(rl)
    if (newVersion === oldVersion || (!ci && !oldVersion)) {
      throw expectedError('Old version and new version are the same', 0)
    }

    const tag = `v${newVersion}`
    const name = `Version ${newVersion}`

    const taglist = runner.cmdOut('git', ['tag', '-l', tag])
    if (taglist) {
      throw `Git tag ${tag} already exists`
    }
    const lastTag = getLastTag(oldVersion)

    const newPkgJson = patchVersion(oldPkgJson, oldVersion, newVersion)

    const npmtag = extractTag(newVersion)
    const prerelease = npmtag !== 'latest'

    console.log('Creating release')
    console.log('  name:', name)
    console.log('  tag:', tag)
    console.log('  lastTag:', lastTag || '<no tags found>')
    console.log('  npmtag:', npmtag)
    console.log('  prerelease:', prerelease)
    if (oldPkgJson !== newPkgJson) {
      console.log('Creating commit with message:', name)
    }
    const changelog = runner
      .cmdOut(
        'git',
        ['log', lastTag ? `${lastTag}..HEAD` : '', '--oneline'].filter(Boolean),
      )
      .trim()
      .split('\n')
      .map((l) => `- ${l}`)
      .join('\n')
    console.log('Dry run:', runner.dryRun)
    console.log(
      'Patching package.json and creating commit:',
      oldPkgJson !== newPkgJson,
    )
    console.log(
      'Changelog (you can edit this via',
      info.github ? 'github' : 'gitlab',
      'later):',
    )
    console.log(changelog)

    const res = rl ? await question(rl, 'Is this okay? [y/N] ') : 'N'
    rl?.close()
    if (!ci && res !== 'y') {
      throw expectedError('stopping.', 0)
    }

    if (oldPkgJson !== newPkgJson) {
      if (runner.dryRun) {
        console.log('Writing new package json with version changed')
      } else {
        fs.writeFileSync(pkgJsonFile, newPkgJson, 'utf-8')
      }
      runner.cmd('git', ['commit', '-am', name])
      runner.cmd('git', ['push'])
    }
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
      },
    })

    runner.cmd(
      'yarn',
      [
        'publish',
        '--non-interactive',
        '--no-git-tag-version',
        isPackageDefinitelyPublic ? ['--access', 'public'] : [],
        npmtag ? ['--tag', npmtag] : [],
      ].flat(),
    )
  } finally {
    rl?.close()
  }

  function question(rl: readline.Interface, q: string) {
    return new Promise<string>((resolve) => {
      rl.question(q, resolve)
    })
  }

  async function getVersions(
    rl: readline.Interface | null,
  ): Promise<{
    oldVersion: string
    newVersion: string
  }> {
    let newVersion: string
    if (rl) {
      console.log('Current version:', JSON.parse(oldPkgJson)['version'])
      newVersion = await question(rl, 'New version: ')
      if (!/^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$/.test(newVersion)) {
        throw 'Invalid version: ' + newVersion
      }
    } else {
      newVersion = JSON.parse(oldPkgJson)['version']
    }

    const packageName = JSON.parse(oldPkgJson)['name']

    const cerr = JSON.parse(
      runner.cmdOut('npm', ['show', packageName, '--json'], {
        allowErr: true,
      }),
    )
    if (cerr?.error?.code === 'E404') {
      return { oldVersion: '', newVersion }
    }

    const versionInfo = runner.cmdOut('npm', [
      'show',
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
      runner.cmdOut('npm', [
        'show',
        packageName + '@' + extractTag(newVersion),
        'version',
      ]) || runner.cmdOut('npm', ['show', packageName, 'version'])
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

function extractTag(version: string) {
  return (
    version
      .split('-')[1]
      ?.split(/[^a-z]/i)?.[0]
      ?.toLowerCase() || 'latest'
  )
}

function patchVersion(
  oldPackageJson: string,
  oldVersion: string,
  newVersion: string,
) {
  if (oldVersion === newVersion) return oldPackageJson

  const oldParsed = JSON.parse(oldPackageJson)
  if (oldParsed['version'] === newVersion) return oldPackageJson

  const newPkgJson = oldPackageJson.replace(
    `"version": ${JSON.stringify(oldParsed['version'])}`,
    `"version": ${JSON.stringify(newVersion)}`,
  )

  if (newPkgJson === oldPackageJson) {
    throw 'Cannot patch package.json'
  }

  return newPkgJson
}
