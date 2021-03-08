import * as fs from 'fs'
import * as path from 'path'
import * as cp from 'child_process'
import * as readline from 'readline'
import fetch from 'node-fetch'
import { URL, URLSearchParams } from 'url'

export async function publish(
  argv: readonly string[],
  env: typeof process.env,
  workdir: string,
) {
  const dirty = cmdOut('git', ['status', '--porcelain'])
  if (dirty && !argv.includes('--allow-dirty')) {
    throw 'You have uncommited changes... Commit your changes first'
  }

  const pkgJsonFile = path.join(workdir, 'package.json')
  const oldPkgJson = fs.readFileSync(pkgJsonFile, 'utf8')
  const isPackageDefinitelyPublic = JSON.parse(oldPkgJson)['private'] === false

  const repoUrl = env['npm_package_repository_url']
  if (!repoUrl) {
    throw 'You must specify repository.url in your package.json'
  }

  const dryRun = argv.includes('--dry-run')

  const info = await getInfo(argv[0])

  const rl = readline.createInterface(process.stdin, process.stdout)
  try {
    const oldVersion = JSON.parse(oldPkgJson)['version']
    console.log('Current version:', oldVersion)
    const newVersion = await question(rl, 'New version: ')
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(-.*)?$/.test(newVersion)) {
      throw 'Invalid version: ' + newVersion
    }

    const tag = `v${newVersion}`
    const name = `Version ${newVersion}`

    const taglist = cmdOut('git', ['tag', '-l', tag])
    if (taglist) {
      throw `Git tag ${tag} already exists`
    }
    const lastTag =
      cmdOut('git', ['tag', '-l']).trim() &&
      cmdOut('git', ['describe', '--tags', '--abbrev=0']).trim()

    const newPkgJson = oldPkgJson.replace(
      `"version": ${JSON.stringify(oldVersion)}`,
      `"version": ${JSON.stringify(newVersion)}`,
    )

    if (newPkgJson === oldPkgJson) {
      throw 'Cannot patch package.json'
    }

    console.log('Creating release')
    console.log('  name:', name)
    console.log('  tag:', tag)
    console.log('  lastTag:', lastTag || '<no tags found>')
    if (dirty) console.log('Creating commit with message:', name)
    const changelog = cmdOut(
      'git',
      ['log', lastTag ? `${lastTag}..HEAD` : '', '--oneline'].filter(Boolean),
    )
      .trim()
      .split('\n')
      .map((l) => `- ${l}`)
      .join('\n')
    if (dryRun) console.log('Dry run: yes')
    console.log('Changelog (you can edit this via gitlab later):')
    console.log(changelog)

    const res = await question(rl, 'Is this okay? [y/N] ')
    rl.close()
    if (res !== 'y') {
      throw 'stopping.'
    }

    if (dryRun) {
      console.log('Writing new package json with version changed')
    } else {
      fs.writeFileSync(pkgJsonFile, newPkgJson, 'utf-8')
    }

    cmd('git', ['commit', '-am', name])
    cmd('git', ['push'])

    cmd('git', ['tag', '-a', tag, '-m', name])
    cmd('git', ['push', 'origin', tag])

    if (info.github) {
      const searchParams = new URLSearchParams({
        tag,
        title: name,
        body: changelog,
        prerelease: newVersion.includes('-') + '',
      })
      const url = info.repo + '/releases/new?' + searchParams.toString()
      if (cmdCheck('which', ['open'])) {
        cmd('open', [url])
      } else {
        cmd('xdg-open', [url])
      }
    } else {
      const body = { tag_name: tag, name, description: changelog }
      if (dryRun) {
        console.log('POSTing release ', body)
      } else {
        const res = await fetch(info.apiBase + '/releases', {
          headers: info.headers,
          method: 'POST',
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!json['tag_name']) {
          throw 'Failed to create release'
        }
      }
    }

    cmd(
      'yarn',
      ['publish', '--non-interactive', '--no-git-tag-version'].concat(
        isPackageDefinitelyPublic ? ['--access', 'public'] : [],
      ),
    )
  } finally {
    rl.close()
  }

  function cmd(c: string, args: readonly string[]) {
    if (dryRun) {
      console.log(c, args.map((a) => `'${a}'`).join(' '))
    } else {
      const res = cp.spawnSync(c, args, {
        stdio: 'inherit',
        cwd: workdir,
        env: {
          ...env,
          CORRECT_PUBLISH: '1',
        },
      })
      if (res.status !== 0) {
        throw `${c} ${args[0]} failed`
      }
    }
  }

  function cmdCheck(c: string, args: readonly string[]) {
    const res = cp.spawnSync(c, args, {
      stdio: [null, null, null],
      cwd: workdir,
    })
    return res.status === 0
  }

  function cmdOut(c: string, args: readonly string[]) {
    const res = cp.spawnSync(c, args, {
      encoding: 'utf-8',
      stdio: [null, 'pipe', 'inherit'],
      cwd: workdir,
    })
    if (res.status !== 0) {
      throw `${c} ${args[0]} failed`
    }
    return res.stdout
  }

  function question(rl: readline.Interface, q: string) {
    return new Promise<string>((resolve) => {
      rl.question(q, resolve)
    })
  }

  function apiUrl(path: string) {
    if (!repoUrl) throw new Error('No repoUrl')
    const url = new URL(repoUrl)
    url.search = ''
    url.pathname = path
    return url.toString()
  }

  async function getInfo(tokenFile: string | undefined) {
    if (!repoUrl) throw new Error('No repoUrl')
    const github = new URL(repoUrl).hostname === 'github.com'

    if (!github) {
      if (!tokenFile) {
        throw 'You must specify token file as first argument for gitlab repos.'
      }

      let token: string
      try {
        token = fs.readFileSync(tokenFile, 'utf-8').trim()
      } catch (e) {
        throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
      }
      if (!token) {
        throw 'Cannot read Release API token (reading from ' + tokenFile + ')'
      }

      const headers = {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': token,
      }
      const path = new URL(repoUrl).pathname.replace(/\.git$/, '').slice(1)
      const url = apiUrl('/api/v4/projects/' + encodeURIComponent(path))
      const res = await (await fetch(url, { headers })).json()
      const id = res['id']
      if (!id) {
        throw 'Project not found'
      }
      return {
        github: false,
        token,
        id,
        apiBase: apiUrl('/api/v4/projects/' + id),
        headers,
      }
    } else {
      return {
        github: true,
        repo: repoUrl.replace(/\.git$/, ''),
      }
    }
  }
}
