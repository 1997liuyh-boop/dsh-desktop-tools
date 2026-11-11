/** Host 侧对前置插件 dsh-vision-router 的检测、一键安装与 OCR 调用。 */
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DesktopVisionStatus } from '../src/desktop-tools-types.ts'

/** 前置插件的 npm 包名。 */
export const VISION_ROUTER_PACKAGE = 'dsh-vision-router'

/** 只使用工具注册表的查询与执行能力。 */
export interface CaptureToolsService {
  get(name: string): unknown
  execute(input: {
    readonly calls: readonly { readonly type: 'tool-call'; readonly id: string; readonly name: string; readonly arguments: string }[]
    readonly signal: AbortSignal
  }): Promise<{ readonly results: readonly { readonly result: unknown }[] }>
}

/** 只使用插件管理器的列表、安装与启用能力。 */
export interface CapturePluginManager {
  listBundles(): Promise<readonly { readonly name: string; readonly enabled: boolean; readonly installed: boolean; readonly version?: string }[]>
  installBundle(spec: string): Promise<{ readonly changed: boolean; readonly application: string }>
  setBundleEnabled(name: string, enabled: boolean): Promise<{ readonly changed: boolean; readonly application: string }>
}

/** 视觉能力所需的可选 Host 服务。 */
export interface CaptureVisionContext {
  readonly profileContext: { readonly dir: string }
  get(name: 'tools'): CaptureToolsService | undefined
  get(name: 'pluginManager'): CapturePluginManager | undefined
}

/** OCR 返回给采集窗口的结果。 */
export interface CaptureOcrResult {
  readonly text: string
  readonly engine: string
  readonly uncertain: boolean
}

const MAX_OCR_BYTES = 30_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读取 vision-router 当前状态。
 * @param ctx Host 上下文。
 * @returns 可调用、未安装、未启用或视觉工具关闭。
 */
export async function captureVisionStatus(ctx: CaptureVisionContext): Promise<DesktopVisionStatus> {
  if (ctx.get('tools')?.get('vision_ocr') !== undefined) return { state: 'ready' }
  const manager = ctx.get('pluginManager')
  if (manager === undefined) return { state: 'unknown' }
  try {
    const bundle = (await manager.listBundles()).find(item => item.name === VISION_ROUTER_PACKAGE)
    const version = bundle?.version === undefined ? {} : { version: bundle.version }
    if (bundle === undefined || !bundle.installed) return { state: 'missing' }
    // 已启用却没有 vision_ocr，说明插件设置里关闭了视觉工具或加载失败。
    return { state: bundle.enabled ? 'tool-off' : 'disabled', ...version }
  } catch {
    return { state: 'unknown' }
  }
}

/**
 * 用户确认后安装并启用 vision-router。
 * @param ctx Host 上下文。
 * @returns 是否需要重启 DSH 才能生效。
 */
export async function installCaptureVision(ctx: CaptureVisionContext): Promise<{ readonly status: DesktopVisionStatus; readonly restartRequired: boolean }> {
  const manager = ctx.get('pluginManager')
  if (manager === undefined) throw new Error(`当前 DSH 未提供插件管理器，请在终端运行 dsh plugin add ${VISION_ROUTER_PACKAGE}`)
  const before = await captureVisionStatus(ctx)
  const result = before.state === 'disabled'
    ? await manager.setBundleEnabled(VISION_ROUTER_PACKAGE, true)
    : before.state === 'missing' || before.state === 'unknown' ? await manager.installBundle(VISION_ROUTER_PACKAGE) : undefined
  if (result !== undefined && (result.application === 'failed' || result.application === 'cancelled')) {
    throw new Error(`安装 ${VISION_ROUTER_PACKAGE} 未完成（${result.application}），请在 DSH 插件管理中查看原因`)
  }
  const status = await captureVisionStatus(ctx)
  // 插件层在下次启动才挂载时，工具注册表里仍然没有 vision_ocr。
  return { status, restartRequired: status.state !== 'ready' }
}

/** 从工具结果中取出 vision-router 的 JSON 文本。 */
function ocrPayload(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) throw new Error('OCR 工具没有返回结果')
  if (result.isError === true) {
    const error = isRecord(result.error) && typeof result.error.message === 'string' ? result.error.message : 'OCR 工具执行失败'
    throw new Error(error)
  }
  const candidates: unknown[] = [result.value]
  if (Array.isArray(result.content)) {
    candidates.push(result.content.map(block => isRecord(block) && typeof block.text === 'string' ? block.text : '').join(''))
  }
  for (const candidate of candidates) {
    if (isRecord(candidate)) return candidate
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(candidate)
        if (isRecord(parsed)) return parsed
      } catch {
        return { text: candidate, engine: 'unknown' }
      }
    }
  }
  throw new Error('OCR 工具返回了无法识别的结果')
}

/**
 * 调用 vision-router 识别 PNG 中的文字；临时文件写在 profile 内并在结束后删除。
 * @param ctx Host 上下文。
 * @param png 图片字节。
 * @param long 是否为长截图（使用分片识别）。
 * @param signal 取消信号。
 * @returns 识别文本。
 */
export async function runCaptureOcr(ctx: CaptureVisionContext, png: Uint8Array, long: boolean, signal: AbortSignal): Promise<CaptureOcrResult> {
  if (png.byteLength === 0 || png.byteLength > MAX_OCR_BYTES) throw new Error('待识别图片为空或超过 30 MB')
  const tools = ctx.get('tools')
  const name = long ? 'vision_long_screenshot_ocr' : 'vision_ocr'
  if (tools?.get(name) === undefined) throw new Error(`需要启用 ${VISION_ROUTER_PACKAGE} 并打开其视觉工具`)
  const directory = join(ctx.profileContext.dir, 'desktop-tools', 'ocr')
  await mkdir(directory, { recursive: true })
  const path = join(directory, `capture-${randomUUID()}.png`)
  try {
    await writeFile(path, png, { flag: 'wx' })
    const batch = await tools.execute({
      calls: [{ type: 'tool-call', id: randomUUID(), name, arguments: JSON.stringify({ image: path, engine: 'auto' }) }],
      signal,
    })
    const payload = ocrPayload(batch.results[0]?.result)
    if (payload.ok === false) {
      throw new Error(typeof payload.message === 'string' ? payload.message : typeof payload.code === 'string' ? payload.code : 'OCR 识别失败')
    }
    const text = typeof payload.text === 'string' ? payload.text : typeof payload.markdown === 'string' ? payload.markdown : ''
    return { text: text.trim(), engine: typeof payload.engine === 'string' ? payload.engine : 'unknown', uncertain: payload.uncertain === true }
  } finally {
    await rm(path, { force: true }).catch(() => { /* 临时文件清理失败不影响识别结果。 */ })
  }
}
