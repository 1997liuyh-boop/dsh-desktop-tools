/**
 * 跨 Electron 版本的剪贴板操作。
 * 辅助进程可能运行在 DSH 自带的 Electron 44，也可能运行在用户另备的独立 Electron（如 43）：
 * 44 新增 ClipboardItem / clipboard.write(items) 并从类型中移除了 writeImage，43 则只有旧接口。
 * 这里只用命名空间导入并在运行时探测，避免具名导入缺失的导出导致整个模块加载失败。
 */
import * as electron from 'electron'

interface LegacyClipboard {
  writeImage?(image: Electron.NativeImage): void
  availableFormats?(type?: string): string[]
}

interface ModernClipboardItem { readonly types: readonly string[] }
type ClipboardItemConstructor = new (items: Record<string, Blob>) => ModernClipboardItem

const legacy = (): LegacyClipboard => electron.clipboard as unknown as LegacyClipboard
const itemConstructor = (): ClipboardItemConstructor | undefined =>
  (electron as unknown as { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem

/**
 * 把 PNG 写入系统剪贴板。
 * @param png PNG 字节。
 */
export async function writeClipboardPng(png: Uint8Array): Promise<void> {
  const image = electron.nativeImage.createFromBuffer(Buffer.from(png))
  if (image.isEmpty()) throw new Error('Image is not readable')
  const writeImage = legacy().writeImage
  if (typeof writeImage === 'function') {
    writeImage.call(electron.clipboard, image)
    return
  }
  const Item = itemConstructor()
  if (Item === undefined) throw new Error('当前 Electron 不支持写入图片到剪贴板')
  const write = electron.clipboard.write as unknown as (items: ModernClipboardItem[]) => Promise<void>
  await write.call(electron.clipboard, [new Item({ 'image/png': new Blob([new Uint8Array(image.toPNG())]) })])
}

/**
 * 读取剪贴板当前包含的 MIME 类型。
 * @returns 全部条目的类型列表。
 */
export async function clipboardTypes(): Promise<string[]> {
  const formats = legacy().availableFormats
  if (typeof formats === 'function') return formats.call(electron.clipboard)
  const read = electron.clipboard.read as unknown as () => Promise<ModernClipboardItem[] | string>
  const items = await read.call(electron.clipboard)
  return Array.isArray(items) ? items.flatMap(item => [...item.types]) : []
}
