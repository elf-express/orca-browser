import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          // The ported raw-process retention test forces GC to prove completed helpers are released.
          execArgv: ['--expose-gc'],
          include: ['src/{main,preload,shared}/**/*.test.ts', 'scripts/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          // The ported grab toast cleanup test forces GC to prove closed panes are released.
          execArgv: ['--expose-gc'],
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['@testing-library/jest-dom/vitest']
        }
      }
    ]
  }
})
