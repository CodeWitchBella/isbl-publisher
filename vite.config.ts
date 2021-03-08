import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

const pkg: typeof import('./package.json') = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
)

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/publisher.tsx'),
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        ...Object.keys('dependencies' in pkg ? pkg['dependencies'] : {}),
        ...Object.keys(
          'peerDependencies' in pkg ? pkg['peerDependencies'] : {},
        ),
      ],
    },
  },
})
