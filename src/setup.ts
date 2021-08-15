import * as fs from 'fs'
import * as readline from 'readline'
import { createRunner } from './run-command'
import { URL } from 'url'
import * as ChildProcess from 'child_process'
import open from 'open'
import path from 'path'

const welcome = `
Welcome to @isbl/publisher ❤️

I'll ask you a couple of questions.
I'll try my best to detect correct answers for you, and if I do, I'll provide
those next to the question in parentheses. To accept those answers press enter
without inputting anything.

If at any point you decide that you don't want to continue with the setup you
can abort by pressing Ctrl-C.
`

const workflow = `
name: release
on:
  push:
    branches:
      - main
jobs:
  release:
    name: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v2
        with:
          node-version: 14
          cache: yarn
          registry-url: 'https://registry.npmjs.org'
      - run: yarn
      - run: yarn publish:npm
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`.trim() + '\n'

export async function setup(
  argv: readonly string[],
  env: typeof process.env,
  workdir: string,
) {
  const runner = createRunner({
    dryRun: false,
    env,
    cwd: workdir,
    verbose: argv.includes('--verbose'),
  })
  const rl = readline.createInterface(process.stdin, process.stdout)
  console.log(welcome)
  
  const remote = await question('Git repository https url', detectRemote(runner))
  const ci = await yesno('Do you plan to publish using CI?', true)
  const remoteUrl = new URL(remote)
  const github = remoteUrl.host === 'github.com'
  const file = !ci && !github
    && await question(
      'Where do you want to store gitlab token?',
      process.env['GITLAB_TOKEN_FILE'] || '$HOME/.gitlab-token'
      )
  const noDraft = ci && github && !(await yesno('Do you want to edit automatically generated changelog after each release?', true))
  
  console.log('\nMaking required changes')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  packageJson.repository = {
    type: 'git',
    url: remote,
  }
  if (!packageJson.scripts) packageJson.scripts = {}
  packageJson.scripts.prepublishOnly = prepublishOnly(packageJson.scripts)
  packageJson.scripts['publish:npm'] = `isbl-publisher publish${file  ? ' '+file : ''}${noDraft ? ' --no-draft' : ''}`
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')

  if (github && ci) {
    fs.mkdirSync('.github/workflows', { recursive:true })
    fs.writeFileSync('.github/workflows/release.yml', workflow)
  }

  console.log('Changes done\n')

  if (github && ci && await yesno('Do you want to setup NPM_TOKEN?', true)) {
    let generateToken = false
    while(true) {
      generateToken = await yesno('Do you want to generate npm token now?', true)
      if (!generateToken) break;

      console.log('\nRunning `npm token create`')
      const res = ChildProcess.spawnSync('npm', ['token', 'create'], {
        stdio: ['inherit', 'inherit', 'inherit'],
        env: clearEnv(env),
      })
      if (res.status === 0) break
      else console.log('\nSeems like token creation failed.')
    }

    console.log('\nℹ️  Now you have to add the token to your repository secrets section')
    console.log('Secret name: NPM_TOKEN')
    console.log('Secret value:', generateToken ? 'secret you just generated' : 'your secret')
    if (await yesno('Open browser?', true)) {
      await open(remote.replace(/\.git$/, '')  + '/settings/secrets/actions/new')
    }
  }

  console.log('We are done 🎉')


  async function yesno(q: string, defaultValue: boolean) {
    while (true) {
      const res = (
        await question(q + ' y/n', defaultValue ? 'yes' : 'no')
      ).toLowerCase()
      if (res === 'y' || res === 'yes') return true
      if (res === 'n' || res === 'no') return false
      console.log('You must write yes or no')
    }
  }

  async function question(q: string, defaultValue: string) {
    if (!rl) throw new Error('No readline')
    const result = await new Promise<string>((resolve) => {
      rl.question(q + (defaultValue ? ` (${defaultValue}): ` : ': '), resolve)
    })
    return result || defaultValue
  }
}

function clearEnv(env: typeof process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('npm_')))
}

function prepublishOnly(scripts: any) {
  const p = scripts.prepublishOnly
  if (p?.endsWith('isbl-publisher prepublishOnly')) return p
  return (p ? p + ' && ' : '') + 'isbl-publisher prepublishOnly'
}

function detectRemote(runner: ReturnType<typeof createRunner>) {
  let someRemote: string = ''
  for(const line of runner.cmdOut('git', ['remote', '-v']).split('\n')) {
    const rawRemote = line.split(/[\t ]+/g)[1]
    if (!rawRemote) continue
    const remote = httpRemote(rawRemote)

    if (line.startsWith('origin\t')) return remote

    if (!someRemote) someRemote = remote
  }
  return someRemote
}

function httpRemote(remote: string) {
  if (remote.startsWith('https://') || remote.startsWith('http://')) return remote

  return 'https://' + remote.replace(/^[^@]*@/, '').replace(':', '/')
}