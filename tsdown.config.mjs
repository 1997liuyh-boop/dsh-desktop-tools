import { defineConfig } from 'tsdown'
const shared = { outDir: 'dist', platform: 'node', target: 'es2024', dts: false, clean: false, codeSplitting: false, fixedExtension: false }
export default defineConfig([
  { ...shared, entry: { index: 'source/apps/desktop/native-extension-runtime/index.ts' }, format: 'esm', deps: { neverBundle: [/^@deepseek-ai\//] } },
  { ...shared, entry: { helper: 'source/apps/desktop/native-extension-runtime/helper.ts' }, format: 'esm', deps: { neverBundle: ['electron', 'zod'] } },
  { ...shared, entry: { preload: 'source/apps/desktop/src/preload.ts' }, format: 'cjs', outExtensions: () => ({ js: '.cjs' }), define: { DSH_NATIVE_STANDALONE: 'true' }, deps: { neverBundle: ['electron'] } },
])
