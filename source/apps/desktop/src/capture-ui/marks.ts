/** 截图标注：形状、画笔、箭头、文本、序号与马赛克的数据结构和绘制。 */

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; width: number; height: number }

/** 绘制工具。 */
export type Tool = 'rect' | 'ellipse' | 'line' | 'pen' | 'arrow' | 'text' | 'number' | 'mosaic'

interface Base { color: string; size: number }
export type Mark =
  | (Base & { kind: 'rect' | 'ellipse' | 'line' | 'arrow'; a: Point; b: Point })
  | (Base & { kind: 'pen'; points: Point[] })
  | (Base & { kind: 'mosaic'; points: Point[]; block: number })
  | (Base & { kind: 'text'; a: Point; text: string })
  | (Base & { kind: 'number'; a: Point; n: number })

/** 绘制马赛克时取得像素化底图的回调：返回覆盖选区的像素化画布及其左上角。 */
export type MosaicSource = (block: number) => { canvas: CanvasImageSource; box: Box } | undefined

/** @param a 起点。 @param b 终点。 @returns 规范化矩形。 */
export function area(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

/** @param point 点。 @param box 矩形。 @returns 点是否在矩形内。 */
export function inside(point: Point, box: Box): boolean {
  return point.x >= box.x && point.y >= box.y && point.x <= box.x + box.width && point.y <= box.y + box.height
}

/** Shift 约束：矩形/椭圆变为正方形/圆，直线/箭头吸附到 45° 倍数。 */
export function constrain(kind: Tool, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y
  if (kind === 'rect' || kind === 'ellipse') {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    return { x: a.x + Math.sign(dx || 1) * side, y: a.y + Math.sign(dy || 1) * side }
  }
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const length = Math.hypot(dx, dy)
  return { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length }
}

/** 文本字号与线宽档位对应的像素值。 */
export function fontSize(size: number): number { return 12 + size * 4 }

function smoothPath(context: CanvasRenderingContext2D, points: Point[]): void {
  const first = points[0]
  if (!first) return
  context.beginPath()
  context.moveTo(first.x, first.y)
  if (points.length === 1) { context.lineTo(first.x + 0.01, first.y); return }
  // 以相邻点中点作为二次曲线端点，使画笔轨迹平滑。
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]!, next = points[index + 1]!
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  const last = points[points.length - 1]!
  context.lineTo(last.x, last.y)
}

function bounds(points: Point[], pad: number): Box {
  const xs = points.map(point => point.x), ys = points.map(point => point.y)
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y }
}

/**
 * 在给定上下文中绘制一个标注（坐标为桌面 CSS 像素，上下文已完成缩放与平移）。
 * @param context 画布上下文。
 * @param mark 标注。
 * @param mosaic 马赛克底图来源。
 */
export function drawMark(context: CanvasRenderingContext2D, mark: Mark, mosaic?: MosaicSource): void {
  context.save()
  context.strokeStyle = mark.color
  context.fillStyle = mark.color
  context.lineWidth = mark.size
  context.lineCap = 'round'
  context.lineJoin = 'round'
  switch (mark.kind) {
    case 'rect': {
      const box = area(mark.a, mark.b)
      context.strokeRect(box.x, box.y, box.width, box.height)
      break
    }
    case 'ellipse': {
      const box = area(mark.a, mark.b)
      context.beginPath()
      context.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2)
      context.stroke()
      break
    }
    case 'line': {
      context.beginPath(); context.moveTo(mark.a.x, mark.a.y); context.lineTo(mark.b.x, mark.b.y); context.stroke()
      break
    }
    case 'arrow': {
      const angle = Math.atan2(mark.b.y - mark.a.y, mark.b.x - mark.a.x)
      const head = Math.max(10, mark.size * 4.5)
      const length = Math.hypot(mark.b.x - mark.a.x, mark.b.y - mark.a.y)
      const shaft = Math.max(0, length - head * 0.8)
      context.beginPath()
      context.moveTo(mark.a.x, mark.a.y)
      context.lineTo(mark.a.x + Math.cos(angle) * shaft, mark.a.y + Math.sin(angle) * shaft)
      context.stroke()
      context.beginPath()
      context.moveTo(mark.b.x, mark.b.y)
      context.lineTo(mark.b.x - head * Math.cos(angle - Math.PI / 7), mark.b.y - head * Math.sin(angle - Math.PI / 7))
      context.lineTo(mark.b.x - head * Math.cos(angle + Math.PI / 7), mark.b.y - head * Math.sin(angle + Math.PI / 7))
      context.closePath()
      context.fill()
      break
    }
    case 'pen': {
      smoothPath(context, mark.points)
      context.stroke()
      break
    }
    case 'text': {
      const size = fontSize(mark.size)
      context.font = `600 ${size}px system-ui, sans-serif`
      context.textBaseline = 'top'
      // 白色描边保证文字在任意底色上可读。
      context.lineWidth = Math.max(2, size / 7)
      context.strokeStyle = 'rgba(255,255,255,.85)'
      mark.text.split('\n').forEach((line, index) => {
        context.strokeText(line, mark.a.x, mark.a.y + index * size * 1.25)
        context.fillText(line, mark.a.x, mark.a.y + index * size * 1.25)
      })
      break
    }
    case 'number': {
      const radius = 8 + mark.size * 3
      context.beginPath()
      context.arc(mark.a.x, mark.a.y, radius, 0, Math.PI * 2)
      context.fill()
      context.lineWidth = 2
      context.strokeStyle = '#fff'
      context.stroke()
      context.fillStyle = '#fff'
      context.font = `700 ${Math.round(radius * 1.15)}px system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(String(mark.n), mark.a.x, mark.a.y + 1)
      break
    }
    case 'mosaic': {
      const source = mosaic?.(mark.block)
      if (!source || mark.points.length === 0) break
      const box = bounds(mark.points, mark.size)
      // 在离屏画布上用笔迹做遮罩，只把笔迹覆盖到的像素化区域贴回。
      const mask = document.createElement('canvas')
      const transform = context.getTransform()
      const scale = Math.max(1, Math.hypot(transform.a, transform.b))
      mask.width = Math.max(1, Math.ceil(box.width * scale)); mask.height = Math.max(1, Math.ceil(box.height * scale))
      const masker = mask.getContext('2d')!
      masker.scale(scale, scale)
      masker.translate(-box.x, -box.y)
      masker.lineCap = 'round'; masker.lineJoin = 'round'; masker.lineWidth = mark.size; masker.strokeStyle = '#000'
      smoothPath(masker, mark.points)
      masker.stroke()
      masker.globalCompositeOperation = 'source-in'
      masker.imageSmoothingEnabled = false
      masker.drawImage(source.canvas, source.box.x, source.box.y, source.box.width, source.box.height)
      context.drawImage(mask, box.x, box.y, box.width, box.height)
      break
    }
  }
  context.restore()
}

/**
 * 生成覆盖指定区域的像素化底图。
 * @param draw 把原始画面绘制到给定上下文（桌面坐标）的回调。
 * @param box 需要像素化的区域（桌面 CSS 像素）。
 * @param block 马赛克块边长（CSS 像素）。
 * @returns 像素化画布，绘制时按 box 拉伸。
 */
export function pixelate(draw: (context: CanvasRenderingContext2D) => void, box: Box, block: number): HTMLCanvasElement {
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.ceil(box.width / block))
  small.height = Math.max(1, Math.ceil(box.height / block))
  const context = small.getContext('2d')!
  context.imageSmoothingEnabled = true
  context.scale(small.width / box.width, small.height / box.height)
  context.translate(-box.x, -box.y)
  draw(context)
  return small
}
