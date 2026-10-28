import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { 'shared/index': 'src/shared/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist',
    target: 'node22',
    clean: false,
    sourcemap: false
  },
  {
    entry: { 'main/index': 'src/main/index.ts' },
    format: ['cjs'],
    external: ['electron', 'ws', 'agent-browser', '@modelcontextprotocol/sdk'],
    dts: true,
    outDir: 'dist',
    target: 'node22',
    clean: false,
    sourcemap: false
  },
  {
    entry: { 'preload/index': 'src/preload/index.ts' },
    format: ['cjs'],
    external: ['electron'],
    dts: true,
    outDir: 'dist',
    target: 'node22',
    clean: false,
    sourcemap: false
  },
  {
    entry: { 'renderer/index': 'src/renderer/index.ts' },
    format: ['esm'],
    external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', 'zustand', 'sonner'],
    dts: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'browser',
    clean: false,
    sourcemap: false
  }
])
