import * as cp from 'child_process'

export function createRunner({
  dryRun,
  env,
  cwd,
  verbose,
}: {
  dryRun: boolean
  env: typeof process.env
  cwd: string
  verbose: boolean
}) {
  function print(c: string, args: readonly string[]) {
    console.log(c, args.map((a) => `'${a}'`).join(' '))
  }
  function cmd(c: string, args: readonly string[]) {
    if (dryRun) {
      print(c, args)
    } else {
      if (verbose) {
        print(c, args)
      }
      const res = cp.spawnSync(c, args, {
        stdio: 'inherit',
        cwd,
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
    if (verbose) {
      print(c, args)
    }
    const res = cp.spawnSync(c, args, {
      stdio: [null, null, null],
      cwd,
    })
    return res.status === 0
  }

  function cmdOut(
    c: string,
    args: readonly string[],
    { allowErr = false }: { allowErr?: boolean } = {},
  ) {
    if (verbose) {
      print(c, args)
    }
    const res = cp.spawnSync(c, args, {
      encoding: 'utf-8',
      stdio: [null, 'pipe', 'pipe'],
      cwd,
    })
    if (!allowErr) {
      if (res.stderr) {
        if (verbose) {
          console.log(res.stderr)
        }
        throw `${c} ${args[0]} failed because stderr is not empty`
      }
      if (res.status !== 0) {
        throw `${c} ${args[0]} failed`
      }
    }
    return res.stdout
  }
  /**
   * npm 7 broke --json output
   * https://github.com/npm/cli/issues/2740
   */
  function npmErrJsonOut(c: string,
    args: readonly string[],
  ) {
    if (verbose) {
      print(c, args)
    }
    const res = cp.spawnSync(c, args, {
      encoding: 'utf-8',
      stdio: [null, 'pipe', 'pipe'],
      cwd,
    })
    try {
      return JSON.parse(res.stdout) // npm 6 produces correct stdout
    } catch {}

    const start = res.stderr.indexOf('\n{\n')
    const end = res.stderr.lastIndexOf('\n}\n')
    if (start < 0 && end < start) {
      throw new Error('Couldn\'t parse npm json output. Did they break it further?')
    }
    return JSON.parse(res.stderr.substring(start+1, end+2))
  }
  return { cmd, cmdCheck, cmdOut, npmErrJsonOut, dryRun, verbose }
}
