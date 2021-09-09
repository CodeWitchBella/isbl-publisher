import { expectedError } from './expected-error'
import { publish } from './publish'
import { setup } from './setup'

export { createGithubWorkflow } from './setup'

const commands: {
  [key: string]: (
    args: readonly string[],
    env: typeof process.env,
    workdir: string,
  ) => Promise<void> | void
} = {
  prepublishOnly(args, env) {
    if (!env['CORRECT_PUBLISH']) {
      console.log()
      console.log()
      console.log('Publish via CI instead')
      console.log()
      console.log()
      throw 'Not correct publish'
    }
  },
  publish,
  setup,
}

export async function run(
  argv: typeof process.argv,
  env: typeof process.env,
  workdir: string,
) {
  const cmd = (argv[0] || '').replace(/-[a-z]/g, l => l.slice(1).toUpperCase())
  console.log({ cmd })
  if (argv.length < 1 || !cmd) {
    console.log('Available commands:', Object.keys(commands).join(', '))
    return
  }
  const runner = commands[cmd]
  if (!runner) {
    console.log('Unknown command', argv[0])
    process.exit(1)
  }
  try {
    await runner(argv.slice(1), env, workdir)
  } catch(e) {
    if (typeof e === 'string') throw expectedError(e)
    throw e
  }
}
