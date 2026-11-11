/** 构建 DSH Client 设置入口和内联 TwCSS。 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'vite'
import tailwind from '@tailwindcss/postcss'

/** Client 模块注册名，必须与包名一致。 */
const MODULE_ID = 'dsh-desktop-tools'

await mkdir('dist', { recursive: true })
await build({
  configFile: false,
  css: { postcss: { plugins: [tailwind()] } },
  // 自动 JSX 运行时：从模块表取 react/jsx-runtime，不依赖全局 React。
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: 'dist', emptyOutDir: false,
    // 宿主为 Electron 44（Chromium 内核），原生支持类字段：避免降级出的 __defProp 等辅助函数被提到注册横幅之前
    target: 'es2022',
    // 保持 factory 参数名为 require，与官方 client 构建产物一致。
    minify: false,
    lib: {
      entry: 'source/client/index.tsx',
      formats: ['cjs'],
      fileName: () => 'client.js',
    },
    rollupOptions: {
      // 宿主模块表只提供预加载模块；dsh-typert-protocol 属于线协议层，官方构建一律内联（宿主 INLINE_SAFE 规则），
      // 若保持外部引用，运行时 require 会因模块表无此项而抛错，导致整个 web boot 失败。
      external: [/^@deepseek-ai\/(?!dsh-typert-protocol(?:\/|$))/u, 'react', 'react/jsx-runtime', 'react-dom', 'zod'],
      output: {
        // DSH client-modules 只接受通过 __ModuleLoader__.load 注册的闭包工厂，外部依赖经注入的 require 读取模块表。
        banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(MODULE_ID)}, factory: (require) => {`,
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        footer: 'return module.exports; } });',
        exports: 'named',
        inlineDynamicImports: true,
      },
    },
  },
})

// 打包器为避开 CommonJS 保留名会把工厂参数改成 require2，这里恢复为官方格式中的 require。
const output = 'dist/client.js'
const code = await readFile(output, 'utf8')
const renamed = code.replace(/\brequire2\b/gu, 'require')
if (!renamed.startsWith(`window.__ModuleLoader__.load({ id: ${JSON.stringify(MODULE_ID)}, factory: (require) => {`)) {
  throw new Error('client.js 未以 __ModuleLoader__.load 注册')
}
await writeFile(output, renamed)
