// Test-only module resolution for `node --test`: lets src/lib/*.ts import each
// other the way the Next build does — `./timetable` (no extension) and
// `@/lib/...` — while Node strips the TypeScript types itself.
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs'
      import { fileURLToPath, pathToFileURL } from 'node:url'
      const SRC = ${JSON.stringify(new URL('../src/', import.meta.url).href)}
      export async function resolve(specifier, context, next) {
        let target = specifier.startsWith('@/') ? SRC + specifier.slice(2) : null
        if (!target && (specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL)
          target = new URL(specifier, context.parentURL).href
        if (target && !/\\.[cm]?[jt]sx?$/.test(target)) {
          for (const ext of ['.ts', '.tsx']) {
            if (existsSync(fileURLToPath(target + ext))) return next(target + ext, context)
          }
        }
        return next(target ?? specifier, context)
      }
    `),
)
