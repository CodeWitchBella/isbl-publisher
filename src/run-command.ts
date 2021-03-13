import * as cp from 'child_process'

export function createRunner({
  dryRun,
  env,
  cwd,
}: {
  dryRun: boolean
  env: typeof process.env
  cwd: string
}) {
  function cmd(c: string, args: readonly string[]) {
    if (dryRun) {
      console.log(c, args.map((a) => `'${a}'`).join(' '))
    } else {
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
    const res = cp.spawnSync(c, args, {
      stdio: [null, null, null],
      cwd,
    })
    return res.status === 0
  }

  function cmdOut(c: string, args: readonly string[]) {
    const res = cp.spawnSync(c, args, {
      encoding: 'utf-8',
      stdio: [null, 'pipe', 'pipe'],
      cwd,
    })
    if (res.stderr) {
      throw `${c} ${args[0]} because stderr is not empty`
    }
    if (res.status !== 0) {
      throw `${c} ${args[0]} failed`
    }
    return res.stdout
  }
  return { cmd, cmdCheck, cmdOut, dryRun }
}
