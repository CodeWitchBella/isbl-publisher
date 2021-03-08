import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import fetch from 'node-fetch'
import { URL, URLSearchParams } from 'url'
import { getRepoInfo } from './get-repo-info'
import { createRunner } from './run-command'
import { createRelease } from './create-release'

export async function publish(
  argv: readonly string[],
  env: typeof process.env,
  workdir: string,
) {
  const runner = createRunner({
    dryRun: argv.includes('--dry-run'),
    env,
    cwd: workdir,
  })

  const dirty = runner.cmdOut('git', ['status', '--porcelain'])
  if (dirty && !argv.includes('--allow-dirty')) {
    throw 'You have uncommited changes... Commit your changes first'
  }

  const pkgJsonFile = path.join(workdir, 'package.json')
  const oldPkgJson = fs.readFileSync(pkgJsonFile, 'utf8')
  const isPackageDefinitelyPublic = JSON.parse(oldPkgJson)['private'] === false

  const info = await getRepoInfo({ tokenFile: argv[0], env })

  const rl = readline.createInterface(process.stdin, process.stdout)
  try {
    const oldVersion = JSON.parse(oldPkgJson)['version']
    console.log('Current version:', oldVersion)
    const newVersion = await question(rl, 'New version: ')
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$/.test(newVersion)) {
      throw 'Invalid version: ' + newVersion
    }

    const tag = `v${newVersion}`
    const name = `Version ${newVersion}`

    const taglist = runner.cmdOut('git', ['tag', '-l', tag])
    if (taglist) {
      throw `Git tag ${tag} already exists`
    }
    const lastTag =
      runner.cmdOut('git', ['tag', '-l']).trim() &&
      runner.cmdOut('git', ['describe', '--tags', '--abbrev=0']).trim()

    const newPkgJson = oldPkgJson.replace(
      `"version": ${JSON.stringify(oldVersion)}`,
      `"version": ${JSON.stringify(newVersion)}`,
    )

    if (newPkgJson === oldPkgJson) {
      throw 'Cannot patch package.json'
    }

    const npmtag = newVersion.split('-')[1]?.replace(/[^a-z]/g, '') || 'latest'
    const prerelease = npmtag !== 'latest'

    console.log('Creating release')
    console.log('  name:', name)
    console.log('  tag:', tag)
    console.log('  lastTag:', lastTag || '<no tags found>')
    console.log('  npmtag:', npmtag)
    console.log('  prerelease:', prerelease)
    if (dirty) console.log('Creating commit with message:', name)
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
      'Changelog (you can edit this via',
      info.github ? 'github' : 'gitlab',
      'later):',
    )
    console.log(changelog)

    const res = await question(rl, 'Is this okay? [y/N] ')
    rl.close()
    if (res !== 'y') {
      throw 'stopping.'
    }

    if (runner.dryRun) {
      console.log('Writing new package json with version changed')
    } else {
      fs.writeFileSync(pkgJsonFile, newPkgJson, 'utf-8')
    }

    runner.cmd('git', ['commit', '-am', name])
    runner.cmd('git', ['push'])

    runner.cmd('git', ['tag', '-a', tag, '-m', name])
    runner.cmd('git', ['push', 'origin', tag])

    await createRelease({
      runner,
      info,
      args: {
        body: changelog,
        tag,
        title: name,
        prerelease,
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
    rl.close()
  }

  function question(rl: readline.Interface, q: string) {
    return new Promise<string>((resolve) => {
      rl.question(q, resolve)
    })
  }
}
