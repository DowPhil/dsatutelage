// Component tests (tests/components/*.test.tsx) — rendered in jsdom with the
// app's `@/` imports. The pure-logic tests stay on Node's runner (npm test).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.tsx'],
  },
})
