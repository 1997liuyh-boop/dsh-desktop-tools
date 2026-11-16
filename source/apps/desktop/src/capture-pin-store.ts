/** 钉图持久化：图片与位置保存在 profile 中，保存设置或重启后恢复。不依赖 electron，便于单测。 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 最多保留的钉图数量；超出时关闭最早的钉图。 */
export const MAX_STORED_PINS = 30

/** 钉图在屏幕上的位置与尺寸（DIP）。 */
export interface PinBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 一张持久化的钉图。 */
export interface StoredPin {
  readonly id: string
  readonly createdAt: number
  readonly bounds: PinBounds
  readonly hidden: boolean
}

const INDEX_FILE = 'pins.json'
const PIN_ID = /^[a-z0-9-]{1,48}$/u

function isBounds(value: unknown): value is PinBounds {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every(key => typeof record[key] === 'number' && Number.isFinite(record[key]))
    && (record.width as number) > 0 && (record.height as number) > 0
}

function isStoredPin(value: unknown): value is StoredPin {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && PIN_ID.test(record.id) && typeof record.createdAt === 'number'
    && isBounds(record.bounds) && typeof record.hidden === 'boolean'
}

/** 钉图目录的读写；索引损坏或图片缺失的条目在读取时跳过。 */
export class PinStore {
  /** @param directory 钉图目录，通常为 profile/desktop-tools/pins。 */
  constructor(private readonly directory: string) {}

  /** @returns 按创建时间排序、图片仍存在的钉图。 */
  list(): StoredPin[] {
    const path = join(this.directory, INDEX_FILE)
    if (!existsSync(path)) return []
    let parsed: unknown
    try { parsed = JSON.parse(readFileSync(path, 'utf8')) } catch { return [] }
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    return parsed.filter((item): item is StoredPin => {
      if (!isStoredPin(item) || seen.has(item.id) || !existsSync(this.imagePath(item.id))) return false
      seen.add(item.id)
      return true
    }).sort((left, right) => left.createdAt - right.createdAt)
  }

  /** @param id 钉图 id。 @returns PNG 字节。 */
  readImage(id: string): Buffer {
    return readFileSync(this.imagePath(id))
  }

  /**
   * 保存新钉图；数量超出上限时删除最早的钉图。
   * @param pin 钉图信息。
   * @param png 图片字节。
   * @returns 因超出上限而被删除的钉图 id。
   */
  add(pin: StoredPin, png: Uint8Array): string[] {
    if (!PIN_ID.test(pin.id)) throw new Error('钉图 id 无效')
    mkdirSync(this.directory, { recursive: true })
    writeFileSync(this.imagePath(pin.id), png)
    const pins = [...this.list().filter(item => item.id !== pin.id), pin]
    const evicted = pins.length > MAX_STORED_PINS ? pins.splice(0, pins.length - MAX_STORED_PINS) : []
    for (const item of evicted) rmSync(this.imagePath(item.id), { force: true })
    this.write(pins)
    return evicted.map(item => item.id)
  }

  /** @param id 钉图 id。 @param patch 新的位置或显示状态；钉图不存在时忽略。 */
  update(id: string, patch: { readonly bounds?: PinBounds; readonly hidden?: boolean }): void {
    const pins = this.list()
    const index = pins.findIndex(item => item.id === id)
    const current = pins[index]
    if (current === undefined) return
    pins[index] = { ...current, ...(patch.bounds === undefined ? {} : { bounds: patch.bounds }), ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }) }
    this.write(pins)
  }

  /** @param id 要删除的钉图 id；不存在时忽略。 */
  remove(id: string): void {
    if (!PIN_ID.test(id)) return
    rmSync(this.imagePath(id), { force: true })
    this.write(this.list().filter(item => item.id !== id))
  }

  private imagePath(id: string): string {
    return join(this.directory, `${id}.png`)
  }

  /** 先写临时文件再改名，避免中途退出留下半个索引。 */
  private write(pins: readonly StoredPin[]): void {
    mkdirSync(this.directory, { recursive: true })
    const path = join(this.directory, INDEX_FILE)
    const temporary = `${path}.${String(process.pid)}.tmp`
    writeFileSync(temporary, JSON.stringify(pins))
    renameSync(temporary, path)
  }
}
