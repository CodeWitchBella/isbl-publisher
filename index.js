#!/usr/bin/env node
import('./dist/publisher.es.js')
  .then(({ run }) => run(process.argv))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
