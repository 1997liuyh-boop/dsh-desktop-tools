/** 使用 Tailwind CSS 和 Vite 构建桌面工具静态资源。 */
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { build } from 'vite'

const styles = [
  ['selection-ui.tw.css', 'selection-toolbar.css'],
  ['selection-ui.tw.css', 'selection-result.css'],
  ['floating-mentions.tw.css', 'floating-mentions.css'],
  ['capture.tw.css', 'capture.css'],
  ['capture-result.tw.css', 'capture-result.css'],
]

for (const [input, output] of styles) {
  const from = resolve('assets', input)
  const result = await postcss([tailwind()]).process(await readFile(from, 'utf8'), { from })
  await writeFile(resolve('assets', output), result.css)
}

/** 每个浏览器脚本各打成一个 IIFE：采集界面在 CSP 'self' 下只能加载同源静态脚本。 */
const scripts = [
  ['source/apps/desktop/src/selection-markdown.ts', 'DshMarkdown', 'selection-markdown.js'],
  ['source/apps/desktop/src/capture-ui/main.ts', 'DshCapture', 'capture.js'],
  ['source/apps/desktop/src/capture-ui/pin.ts', 'DshCapturePin', 'capture-pin.js'],
  ['source/apps/desktop/src/capture-ui/result.ts', 'DshCaptureResult', 'capture-result.js'],
]

for (const [entry, name, fileName] of scripts) {
  await build({
    configFile: false,
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: 'assets',
      emptyOutDir: false,
      target: 'chrome130',
      lib: { entry, formats: ['iife'], name, fileName: () => fileName },
    },
  })
}

// 知识图谱结果窗口使用 mermaid 官方预构建的浏览器包，只在该窗口加载。
const require = createRequire(import.meta.url)
await copyFile(require.resolve('mermaid/dist/mermaid.min.js'), resolve('assets', 'mermaid.min.js'))
