import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 'shared/index': 'src/shared/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  outDir: 'dist',
  target: 'node22',
  clean: false,
  sourcemap: false
})
