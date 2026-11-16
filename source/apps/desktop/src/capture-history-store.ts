/** 截图 / 录屏历史：图片与记录保存在 profile 中，可列出、删除、清空。不依赖 electron，便于单测。 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 最多保留的历史条数；超出时删除最早的记录。 */
export const MAX_HISTORY_ENTRIES = 100
/** 识别结果、回答等文字的保存上限。 */
export const MAX_HISTORY_TEXT = 100_000

/** 历史记录类型：截图、长截图、录屏，以及提取文字、翻译、知识图谱、提问的结果。 */
export type HistoryKind = 'image' | 'long' | 'recording' | 'ocr' | 'translate' | 'graph' | 'ask'
const KINDS: readonly HistoryKind[] = ['image', 'long', 'recording', 'ocr', 'translate', 'graph', 'ask']

/** 一条历史记录。 */
export interface HistoryEntry {
  readonly id: string
  readonly createdAt: number
  readonly kind: HistoryKind
  /** 是否保存了图片（`<id>.png`）。 */
  readonly image: boolean
  readonly width?: number
  readonly height?: number
  /** 识别文字、翻译或图谱结果、提问的回答。 */
  readonly text?: string
  /** 提问的问题。 */
  readonly question?: string
  /** 用户保存到磁盘的文件（录屏或另存的截图），用于「打开所在文件夹」。 */
  readonly file?: string
}

const INDEX_FILE = 'history.json'
const ENTRY_ID = /^[a-z0-9-]{1,48}$/u

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const optional = (key: string, type: 'string' | 'number'): boolean => record[key] === undefined || typeof record[key] === type
  return typeof record.id === 'string' && ENTRY_ID.test(record.id) && typeof record.createdAt === 'number'
    && KINDS.includes(record.kind as HistoryKind) && typeof record.image === 'boolean'
    && optional('width', 'number') && optional('height', 'number') && optional('text', 'string')
    && optional('question', 'string') && optional('file', 'string')
}

/** @returns 新历史记录的 id。 */
export function newHistoryId(): string {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 历史目录的读写；索引损坏、图片缺失或录屏文件已删除的记录在读取时跳过。 */
export class HistoryStore {
  /** @param directory 历史目录，通常为 profile/desktop-tools/history。 */
  constructor(private readonly directory: string) {}

  /** @returns 按时间倒序（最新在前）的有效记录。 */
  list(): HistoryEntry[] {
    const path = join(this.directory, INDEX_FILE)
    if (!existsSync(path)) return []
    let parsed: unknown
    try { parsed = JSON.parse(readFileSync(path, 'utf8')) } catch { return [] }
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    return parsed.filter((item): item is HistoryEntry => {
      if (!isEntry(item) || seen.has(item.id)) return false
      if (item.image && !existsSync(this.imagePath(item.id))) return false
      // 只有文件、没有图片的录屏，文件被删掉后这条记录也没有意义了。
      if (!item.image && item.kind === 'recording' && (item.file === undefined || !existsSync(item.file))) return false
      seen.add(item.id)
      return true
    }).sort((left, right) => right.createdAt - left.createdAt)
  }

  /** @param id 记录 id。 @returns 图片字节。 */
  readImage(id: string): Buffer {
    if (!ENTRY_ID.test(id)) throw new Error('历史记录 id 无效')
    return readFileSync(this.imagePath(id))
  }

  /**
   * 追加一条记录；超出上限时删除最早的记录及其图片。
   * @param entry 记录；`image` 为 true 时必须同时提供 png。
   * @param png 图片字节。
   * @returns 因超出上限被删除的记录 id。
   */
  add(entry: HistoryEntry, png?: Uint8Array): string[] {
    if (!ENTRY_ID.test(entry.id)) throw new Error('历史记录 id 无效')
    if (entry.image && png === undefined) throw new Error('历史记录缺少图片')
    mkdirSync(this.directory, { recursive: true })
    if (entry.image && png !== undefined) writeFileSync(this.imagePath(entry.id), png)
    const trimmed: HistoryEntry = {
      ...entry,
      ...(entry.text === undefined ? {} : { text: entry.text.slice(0, MAX_HISTORY_TEXT) }),
      ...(entry.question === undefined ? {} : { question: entry.question.slice(0, MAX_HISTORY_TEXT) }),
    }
    const entries = [trimmed, ...this.list().filter(item => item.id !== entry.id)]
    const evicted = entries.length > MAX_HISTORY_ENTRIES ? entries.splice(MAX_HISTORY_ENTRIES) : []
    for (const item of evicted) rmSync(this.imagePath(item.id), { force: true })
    this.write(entries)
    return evicted.map(item => item.id)
  }

  /** @param id 要删除的记录 id；不存在时忽略。不会删除用户保存的文件。 */
  remove(id: string): void {
    if (!ENTRY_ID.test(id)) return
    rmSync(this.imagePath(id), { force: true })
    this.write(this.list().filter(item => item.id !== id))
  }

  /** 删除全部历史记录与图片。不会删除用户保存的文件。 */
  clear(): void {
    rmSync(this.directory, { recursive: true, force: true })
  }

  private imagePath(id: string): string {
    return join(this.directory, `${id}.png`)
  }

  /** 先写临时文件再改名，避免中途退出留下半个索引。 */
  private write(entries: readonly HistoryEntry[]): void {
    mkdirSync(this.directory, { recursive: true })
    const path = join(this.directory, INDEX_FILE)
    const temporary = `${path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, JSON.stringify(entries))
    renameSync(temporary, path)
  }
}
