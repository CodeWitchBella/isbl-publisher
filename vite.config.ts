import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(import.meta.url.replace('file://', ''))

const pkg: typeof import('./package.json') = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
)

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/publisher.ts'),
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
