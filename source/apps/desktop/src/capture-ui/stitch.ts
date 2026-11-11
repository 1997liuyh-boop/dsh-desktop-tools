/** 长截图拼接：逐行签名比对求滚动位移，自动排除固定的顶栏与底栏。 */

/** 拼接器单次输入帧后的结果。 */
export interface StitchUpdate {
  /** 新增的像素行数；0 表示画面未滚动。 */
  readonly added: number
  /** 当前拼接总高度（物理像素）。 */
  readonly height: number
  /** 达到高度上限后不再追加。 */
  readonly full: boolean
}

/**
 * 每行一个签名：横向抽样像素的量化亮度做 FNV 混合，容忍极小的采集噪声。
 * @param data RGBA 像素。
 * @param width 宽度。
 * @param height 高度。
 */
export function rowSignatures(data: Uint8ClampedArray, width: number, height: number): Uint32Array {
  const rows = new Uint32Array(height)
  const step = Math.max(1, Math.floor(width / 256))
  for (let y = 0; y < height; y += 1) {
    let hash = 2166136261
    const offset = y * width * 4
    for (let x = 0; x < width; x += step) {
      const index = offset + x * 4
      const value = ((data[index]! * 3 + data[index + 1]! * 6 + data[index + 2]!) / 10) >> 3
      hash = Math.imul(hash ^ value, 16777619)
    }
    rows[y] = hash >>> 0
  }
  return rows
}

/**
 * 在 [top, bottom) 区间内寻找向上滚动的位移 d：next[i] ≈ previous[i + d]。
 * @returns 最佳位移；0 表示未滚动，-1 表示无法可靠匹配。
 */
export function findShift(previous: Uint32Array, next: Uint32Array, top: number, bottom: number): number {
  const span = bottom - top
  if (span < 16) return -1
  let same = 0
  for (let y = top; y < bottom; y += 1) if (previous[y] === next[y]) same += 1
  if (same / span > 0.97) return 0
  const minimumOverlap = Math.max(12, Math.floor(span * 0.08))
  let best = -1, bestScore = 0
  for (let shift = 1; shift <= span - minimumOverlap; shift += 1) {
    const overlap = span - shift
    let matched = 0
    for (let y = top; y < bottom - shift; y += 1) if (next[y] === previous[y + shift]) matched += 1
    // 纯色行在任意位移都会匹配，按非空白行占比要求更高的可信度。
    const score = matched / overlap
    if (score > bestScore + 1e-6) { bestScore = score; best = shift }
    if (score >= 0.995) break
  }
  return bestScore >= 0.9 ? best : -1
}

/** 增量拼接器：首帧完整保留，之后只追加新滚入的内容行。 */
export class LongStitcher {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private previous: { rows: Uint32Array; image: ImageData } | undefined
  private contentHeight = 0
  private footer: ImageData | undefined
  private footerChecked = false
  /** 帧宽（物理像素）。 */
  readonly width: number
  /** 帧高（物理像素）。 */
  readonly height: number
  private readonly maxHeight: number

  /**
   * @param width 帧宽（物理像素）。
   * @param height 帧高（物理像素）。
   * @param maxHeight 拼接总高度上限。
   */
  constructor(width: number, height: number, maxHeight = 30_000) {
    this.width = width
    this.height = height
    this.maxHeight = maxHeight
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = Math.min(maxHeight, height * 4)
    this.context = this.canvas.getContext('2d', { willReadFrequently: true })!
  }

  /** @returns 当前拼接内容高度（不含底栏）。 */
  get length(): number { return this.contentHeight + (this.footer?.height ?? 0) }

  private ensure(height: number): void {
    if (height <= this.canvas.height) return
    const next = Math.min(this.maxHeight, Math.max(height, this.canvas.height * 2))
    const copy = this.context.getImageData(0, 0, this.width, this.contentHeight)
    this.canvas.height = next
    this.context.putImageData(copy, 0, 0)
  }

  /**
   * 输入一帧。
   * @param image 当前帧像素。
   */
  push(image: ImageData): StitchUpdate {
    const rows = rowSignatures(image.data, image.width, image.height)
    if (!this.previous) {
      this.context.putImageData(image, 0, 0)
      this.contentHeight = image.height
      this.previous = { rows, image }
      return { added: image.height, height: this.length, full: false }
    }
    const previous = this.previous.rows
    const limit = Math.floor(image.height / 3)
    // 固定顶栏 / 底栏：同一位置签名一致的连续行。
    let top = 0
    while (top < limit && previous[top] === rows[top]) top += 1
    let bottom = 0
    while (bottom < limit && previous[image.height - 1 - bottom] === rows[image.height - 1 - bottom]) bottom += 1
    if (top >= limit && bottom >= limit) return { added: 0, height: this.length, full: false }
    const shift = findShift(previous, rows, top, image.height - bottom)
    if (shift <= 0) {
      // 无法匹配时保留上一帧作为基准，等待下一次稳定画面。
      return { added: 0, height: this.length, full: false }
    }
    if (!this.footerChecked) {
      // 首次确认滚动后，把首帧里的底栏截下来，最后再拼回末尾。
      this.footerChecked = true
      if (bottom > 0) {
        this.footer = this.previous.image.height === image.height
          ? new ImageData(this.previous.image.data.slice((image.height - bottom) * image.width * 4), image.width, bottom)
          : undefined
        this.contentHeight -= bottom
      }
    }
    const bandEnd = image.height - bottom
    let added = shift
    if (this.contentHeight + added + (this.footer?.height ?? 0) > this.maxHeight) {
      added = Math.max(0, this.maxHeight - this.contentHeight - (this.footer?.height ?? 0))
    }
    if (added > 0) {
      this.ensure(this.contentHeight + added)
      this.context.putImageData(image, 0, this.contentHeight - (bandEnd - added), 0, bandEnd - added, image.width, added)
      this.contentHeight += added
    }
    this.previous = { rows, image }
    return { added, height: this.length, full: added < shift }
  }

  /** @returns 拼接完成的整张长图。 */
  result(): HTMLCanvasElement {
    const output = document.createElement('canvas')
    output.width = this.width
    output.height = Math.max(1, this.length)
    const context = output.getContext('2d')!
    context.drawImage(this.canvas, 0, 0, this.width, this.contentHeight, 0, 0, this.width, this.contentHeight)
    if (this.footer) context.putImageData(this.footer, 0, this.contentHeight)
    return output
  }

  /** 把拼接结果的末尾部分缩放画到预览画布。 */
  preview(target: HTMLCanvasElement): void {
    const context = target.getContext('2d')!
    const scale = target.width / this.width
    const visible = Math.min(this.contentHeight, Math.ceil(target.height / scale))
    context.clearRect(0, 0, target.width, target.height)
    context.drawImage(this.canvas, 0, this.contentHeight - visible, this.width, visible, 0, 0, target.width, visible * scale)
  }
}
