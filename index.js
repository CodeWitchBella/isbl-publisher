#!/usr/bin/env -S node --enable-source-maps
import('./dist/publisher.esm.js')
  .then(({ run }) => run(process.argv.slice(2), process.env, process.cwd()))
  .then(
    () => {
      process.exit(0)
    },
    (e) => {
      let code = 1
      if (e.expected) {
        console.error(e.message)
        if (typeof e.code === 'number') code = e.code
      } else {
        console.error(e)
      }
      process.exit(code)
    },
  )
