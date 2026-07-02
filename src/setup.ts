import * as fs from 'fs'
import * as readline from 'readline'
import { createRunner } from './run-command'
import { URL } from 'url'
import open from 'open'

const welcome = `
Welcome to @isbl/publisher ❤️

I'll ask you a couple of questions.
I'll try my best to detect correct answers for you, and if I do, I'll provide
those next to the question in parentheses. To accept those answers press enter
without inputting anything.

If at any point you decide that you don't want to continue with the setup you
can abort by pressing Ctrl-C.
`

export function createGithubWorkflow({
  noDraft = false,
  pnpm = false,
}: { noDraft?: boolean; pnpm?: boolean } = {}) {
  const setup = pnpm
    ? `
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: pnpm
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm isbl-publisher${noDraft ? ' --no-draft' : ''}`
    : `
      - uses: actions/setup-node@v6
        with:
          node-version: 26
          cache: yarn
          registry-url: 'https://registry.npmjs.org'
      - run: corepack enable yarn
      - run: yarn
      - run: yarn isbl-publisher${noDraft ? ' --no-draft' : ''}`

  return {
    file: '.github/workflows/release.yml',
    contents:
      `
name: release
on:
  push:
    branches:
      - main
jobs:
  release:
    name: release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0${setup}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`.trim() + '\n',
  }
}

export async function setup(argv: readonly string[], env: typeof process.env, workdir: string) {
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
  if (!ci) {
    console.error('Manual publish is no longer supported')
    return
  }
  const remoteUrl = new URL(remote)
  const github = remoteUrl.host === 'github.com'
  const noDraft =
    github &&
    !(await yesno(
      'Do you want to edit automatically generated changelog after each release?',
      true,
    ))

  console.log('\nMaking required changes')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  packageJson.repository = {
    type: 'git',
    url: remote,
  }
  if (!packageJson.scripts) packageJson.scripts = {}
  packageJson.scripts.prepublishOnly = prepublishOnly(packageJson.scripts)
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')

  if (github) {
    const pnpm = fs.existsSync('pnpm-lock.yaml')
    fs.mkdirSync('.github/workflows', { recursive: true })
    const workflow = createGithubWorkflow({ noDraft, pnpm })
    fs.writeFileSync(workflow.file, workflow.contents)
  }

  console.log('Changes done\n')

  if (github) {
    console.log('\nℹ️  Publishing uses npm trusted publishing (OIDC) — no NPM_TOKEN needed.')
    console.log(
      'Make sure the package is configured for trusted publishing on npmjs.com (Settings > Trusted Publishers).',
    )
    if (await yesno('Open browser to configure trusted publishing?', true)) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
      await open(`https://www.npmjs.com/package/${packageJson.name}/access`)
    }
  }

  console.log('We are done 🎉')

  async function yesno(q: string, defaultValue: boolean) {
    while (true) {
      const res = (await question(q + ' y/n', defaultValue ? 'yes' : 'no')).toLowerCase()
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

function prepublishOnly(scripts: any) {
  const p = scripts.prepublishOnly
  if (p?.endsWith('isbl-publisher prepublishOnly')) return p
  return (p ? p + ' && ' : '') + 'isbl-publisher prepublishOnly'
}

function detectRemote(runner: ReturnType<typeof createRunner>) {
  let someRemote: string = ''
  for (const line of runner.cmdOut('git', ['remote', '-v']).split('\n')) {
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
