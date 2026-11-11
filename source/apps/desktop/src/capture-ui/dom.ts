/** 采集界面共用的 DOM、IPC 与文案工具。 */

/** 预加载脚本暴露的采集接口。 */
interface CaptureBridge {
  result(operation: string, input?: object): Promise<{ ok: true; value: unknown } | { ok: false; error: string; details: string }>
  onEvent(listener: (event: unknown) => void): () => void
}

declare global {
  interface Window {
    dshDesktop: {
      capture: CaptureBridge
      locale(): Promise<{ readonly id: string; readonly messages: Readonly<Record<string, string>> }>
    }
  }
}

/** 当前界面文案（主进程 locale.ts 的 capture* 键）。 */
export type Messages = Readonly<Record<string, string>>

/**
 * 调用主进程采集操作，失败时抛出带诊断信息的错误。
 * @param operation 操作名称。
 * @param input 参数对象。
 * @returns 主进程返回值。
 */
export async function request<T = unknown>(operation: string, input?: object): Promise<T> {
  const response = await window.dshDesktop.capture.result(operation, input)
  if (!response.ok) throw new Error(response.details || response.error)
  return response.value as T
}

/** @param id 元素 id。 @returns 必须存在的元素。 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`缺少界面元素: ${id}`)
  return element as T
}

/**
 * 创建元素并设置属性与子节点。
 * @param tag 标签名。
 * @param props 属性；以 on 开头的函数作为事件监听。
 * @param children 子节点或文本。
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Record<string, unknown> = {}, ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    else if (key === 'className') element.className = String(value)
    // CSP 禁止 style 属性，改用 CSSOM 写入（自定义属性也可用）。
    else if (key === 'style') element.style.cssText = String(value)
    else if (key === 'html') element.innerHTML = String(value)
    else if (value === true) element.setAttribute(key, '')
    else element.setAttribute(key, String(value))
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child)
  return element
}

/**
 * 替换文案中的 {name} 占位符。
 * @param template 文案模板。
 * @param values 占位值。
 */
export function format(template: string | undefined, values: Readonly<Record<string, string | number>>): string {
  return (template ?? '').replace(/\{(\w+)\}/gu, (_match, key: string) => String(values[key] ?? ''))
}

/** 跟随系统深浅色主题。 */
export function followTheme(): void {
  const theme = matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => { document.body.toggleAttribute('data-ds-dark-theme', theme.matches) }
  apply()
  theme.addEventListener('change', apply)
}

/** @param canvas 画布。 @returns PNG 字节。 */
export async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>(resolveBlob => { canvas.toBlob(resolveBlob, 'image/png') })
  if (!blob) throw new Error('无法生成图片')
  return new Uint8Array(await blob.arrayBuffer())
}

/** @param seconds 秒数。 @returns mm:ss。 */
export function clock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds))
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0')
}
