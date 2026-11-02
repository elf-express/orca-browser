import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

// Editor-hosted shells (e.g. VS Code extensions) export this, which would start the playground as plain Node.
delete process.env['ELECTRON_RUN_AS_NODE']

// Dev-only host for manual testing; it bundles src/ directly, never dist/.
export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rolldownOptions: {
        input: { index: resolve('playground/main/index.ts') },
        // package.json is "type": "module", so CJS output needs the .cjs extension.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rolldownOptions: {
        input: { index: resolve('playground/preload/index.ts') },
        // Sandboxed preloads must be a single CJS file.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: resolve('playground/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', 'zustand']
    },
    build: {
      outDir: resolve('out/renderer'),
      rolldownOptions: {
        input: resolve('playground/renderer/index.html')
      }
    }
  }
})
