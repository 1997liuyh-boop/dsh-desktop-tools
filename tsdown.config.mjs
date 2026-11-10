import { execFileSync } from 'node:child_process'
import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'dist', platform: 'node', target: 'es2024', dts: false,
  clean: false, codeSplitting: false, fixedExtension: false,
}

export default defineConfig([
  {
    ...shared,
    clean: true,
    entry: {
      index: 'source/apps/desktop/native-extension-runtime/index.ts',
      helper: 'source/apps/desktop/native-extension-runtime/helper.ts',
      remote: 'source/apps/desktop/native-extension-runtime/remote.ts',
      selection: 'source/apps/desktop/src/desktop-selection-plugin.ts',
      floating: 'source/apps/desktop/src/desktop-floating-plugin.ts',
      capture: 'source/apps/desktop/src/desktop-capture-plugin.ts',
    },
    format: 'esm',
    deps: {
      neverBundle: [
        /^@deepseek-ai\//, 'electron', 'zod', 'turndown', 'pdfjs-dist', '@napi-rs/canvas',
      ],
    },
    onSuccess: async () => {
      if (process.platform !== 'darwin') return
      execFileSync(process.execPath, ['source/apps/desktop/scripts/build-macos-selection.mjs'], { stdio: 'inherit' })
      execFileSync(process.execPath, ['source/apps/desktop/scripts/build-macos-sck-napi.mjs'], { stdio: 'inherit' })
      for (const name of [
        'macos-selection-napi.node', 'libmacos-selection.dylib',
        'macos-sck-napi.node', 'libmacos-sck-capture.dylib',
      ]) {
        await copyFile(`source/apps/desktop/lib/${name}`, `dist/${name}`)
      }
    },
  },
  {
    ...shared,
    entry: { preload: 'source/apps/desktop/src/preload.ts' },
    format: 'cjs',
    outExtensions: () => ({ js: '.cjs' }),
    define: { DSH_NATIVE_STANDALONE: 'true' },
    deps: { neverBundle: ['electron'] },
  },
])
