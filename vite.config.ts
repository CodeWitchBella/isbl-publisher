import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(
  fs.readFileSync(path.join(dirname, 'package.json'), 'utf-8'),
)

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(dirname, 'src/publisher.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        ...Object.keys('dependencies' in pkg ? pkg['dependencies'] : {}),
        ...Object.keys(
          'peerDependencies' in pkg ? pkg['peerDependencies'] : {},
        ),
        'url',
        'path',
        'child_process',
        'readline',
        'util',
        'fs',
      ],
    },
  },
})
