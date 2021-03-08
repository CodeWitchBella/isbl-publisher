#!/usr/bin/env node
import('./dist/publisher.es.js')
  .then(({ run }) => run(process.argv.slice(2), process.env, process.cwd()))
  .then(
    () => {
      process.exit(0)
    },
    (e) => {
      if (e.expected) {
        console.error(e.message)
      } else {
        console.error(e)
      }
      process.exit(1)
    },
  )
