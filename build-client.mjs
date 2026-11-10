/** 构建 DSH Client 设置入口和内联 TwCSS。 */
import { mkdir } from 'node:fs/promises'
import { build } from 'vite'
import tailwind from '@tailwindcss/postcss'

await mkdir('dist', { recursive: true })
await build({
  configFile: false,
  css: { postcss: { plugins: [tailwind()] } },
  build: {
    outDir: 'dist', emptyOutDir: false,
    lib: {
      entry: 'source/client/index.tsx',
      formats: ['es'],
      fileName: () => 'client.js',
    },
    rollupOptions: {
      external: [/^@deepseek-ai\//u, 'react', 'react-dom', 'zod'],
    },
  },
})
