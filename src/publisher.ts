import { expectedError } from './expected-error'
import { publish } from './publish'

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
      console.log('Run yarn publish:npm instead')
      console.log()
      console.log()
      throw expectedError('Not correct publish')
    }
  },
  async publish(args, env, workdir) {
    try {
      await publish(args, env, workdir)
    } catch (e) {
      if (typeof e === 'string') throw expectedError(e)
      throw e
    }
  },
}

export async function run(
  argv: typeof process.argv,
  env: typeof process.env,
  workdir: string,
) {
  const cmd = argv[0]
  if (argv.length < 1 || !cmd) {
    console.log('Available commands:', Object.keys(commands).join(', '))
    return
  }
  const runner = commands[cmd]
  if (!runner) {
    console.log('Unknown command', cmd)
    process.exit(1)
  }
  await runner(argv.slice(1), env, workdir)
}
