/** 使用 Tailwind CSS 和 Vite 构建桌面工具静态资源。 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { build } from 'vite'

const styles = [
  ['selection-ui.tw.css', 'selection-toolbar.css'],
  ['selection-ui.tw.css', 'selection-result.css'],
  ['floating-mentions.tw.css', 'floating-mentions.css'],
  ['capture.tw.css', 'capture.css'],
]

for (const [input, output] of styles) {
  const from = resolve('assets', input)
  const result = await postcss([tailwind()]).process(await readFile(from, 'utf8'), { from })
  await writeFile(resolve('assets', output), result.css)
}

await build({
  configFile: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'assets',
    emptyOutDir: false,
    lib: {
      entry: 'source/apps/desktop/src/selection-markdown.ts',
      formats: ['iife'],
      name: 'DshMarkdown',
      fileName: () => 'selection-markdown.js',
    },
  },
})
