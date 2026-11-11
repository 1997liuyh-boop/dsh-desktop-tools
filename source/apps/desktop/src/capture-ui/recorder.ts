/** 录屏：区域 / 窗口 / 全屏采集，MP4 / WebM / GIF 编码，系统声音与麦克风混音，关键帧抽取。 */
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { canvasPng, request } from './dom.ts'
import type { Box } from './marks.ts'

/** 录屏格式。 */
export type RecordingFormat = 'mp4' | 'webm' | 'gif'
/** 清晰度档位。 */
export type RecordingQuality = 'sd' | 'hd' | 'original'

/** 开始录制所需的参数。 */
export interface RecordingOptions {
  /** desktopCapturer 来源 id（屏幕或窗口）。 */
  readonly source: string
  /** 来源对应的显示器在覆盖层中的范围（窗口来源为 undefined）。 */
  readonly screen?: Box
  /** 需要裁剪的区域（覆盖层坐标）；undefined 表示整个来源。 */
  readonly crop?: Box
  readonly format: RecordingFormat
  readonly quality: RecordingQuality
  readonly systemAudio: boolean
  readonly microphone: boolean
  /** 是否抽取关键帧用于知识图谱。 */
  readonly keyframes: boolean
}

/** 录制过程中的通知。 */
export interface RecordingEvents {
  onTick(seconds: number): void
  onWarning(message: string): void
  /** 录制结束：stopped 为用户停止，failed 为出错。 */
  onEnd(result: { readonly cancelled: boolean; readonly error?: Error }): void
}

/** 关键帧。 */
export interface Keyframe { readonly data: Uint8Array; readonly at: number }

const PROFILES: Readonly<Record<RecordingQuality, { height: number; fps: number; bitrate: number; gifWidth: number }>> = {
  sd: { height: 720, fps: 24, bitrate: 2_500_000, gifWidth: 640 },
  hd: { height: 1080, fps: 30, bitrate: 6_000_000, gifWidth: 960 },
  original: { height: 4320, fps: 30, bitrate: 12_000_000, gifWidth: 1280 },
}
const GIF_FPS = 10
const MAX_SECONDS = 15 * 60
const MAX_GIF_SECONDS = 3 * 60
const MAX_KEYFRAMES = 12

/**
 * 选出浏览器支持的 MediaRecorder 类型；MP4 不可用时回退 WebM。
 * @param format 期望格式。
 * @returns 实际格式与 mimeType。
 */
export function recorderType(format: RecordingFormat): { format: RecordingFormat; mimeType?: string } {
  if (format === 'gif') return { format }
  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type))
  if (mimeType) return { format, mimeType }
  if (format === 'mp4') return recorderType('webm')
  return { format: 'webm' }
}

/** 单次录制会话；同一时间只有一个。 */
export class ScreenRecorder {
  private stream: MediaStream | undefined
  private microphone: MediaStream | undefined
  private output: MediaStream | undefined
  private audioContext: AudioContext | undefined
  private video: HTMLVideoElement | undefined
  private recorder: MediaRecorder | undefined
  private gif: ReturnType<typeof GIFEncoder> | undefined
  private frameTimer: ReturnType<typeof setInterval> | undefined
  private tickTimer: ReturnType<typeof setInterval> | undefined
  private keyTimer: ReturnType<typeof setInterval> | undefined
  private queue: Promise<void> = Promise.resolve()
  private failure: Error | undefined
  private cancelled = false
  private ended = false
  private paused = false
  private started = 0
  private elapsed = 0
  private lastKey: Uint8ClampedArray | undefined
  readonly keyframes: Keyframe[] = []
  /** 实际使用的格式（MP4 不受支持时为 WebM）。 */
  format: RecordingFormat = 'mp4'

  constructor(private readonly events: RecordingEvents) {}

  /** @returns 已录制的秒数（不含暂停）。 */
  seconds(): number { return (this.elapsed + (this.paused || this.started === 0 ? 0 : performance.now() - this.started)) / 1000 }

  /** @returns 是否处于暂停。 */
  isPaused(): boolean { return this.paused }

  private send(data: Uint8Array): void {
    if (this.cancelled || data.byteLength === 0) return
    // 主进程限制单块 4 MB，超出时拆分顺序写入。
    for (let offset = 0; offset < data.byteLength; offset += 3_500_000) {
      const part = data.slice(offset, Math.min(data.byteLength, offset + 3_500_000))
      this.queue = this.queue.then(async () => { await request('chunk', { data: part }) }).catch((error: unknown) => {
        this.failure ??= error instanceof Error ? error : new Error(String(error))
        this.stop(true)
      })
    }
  }

  /** 混合系统声音与麦克风为单条音轨。 */
  private audioTracks(): MediaStreamTrack[] {
    const sources = [this.stream, this.microphone].filter((item): item is MediaStream => item !== undefined && item.getAudioTracks().length > 0)
    if (sources.length === 0) return []
    if (sources.length === 1) return sources[0]!.getAudioTracks()
    this.audioContext = new AudioContext()
    const destination = this.audioContext.createMediaStreamDestination()
    for (const source of sources) this.audioContext.createMediaStreamSource(source).connect(destination)
    return destination.stream.getAudioTracks()
  }

  /**
   * 申请采集并开始录制。主进程必须已通过 begin 选定来源。
   * @param options 录制参数。
   * @param messages 警告文案。
   */
  async start(options: RecordingOptions, messages: { audioFallback: string; micFailed: string }): Promise<void> {
    this.format = options.format
    const profile = PROFILES[options.quality]
    // 麦克风必须在屏幕来源交付前申请，主进程只在这段时间内放行媒体权限。
    if (options.microphone && options.format !== 'gif') {
      try { this.microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) }
      catch { this.events.onWarning(messages.micFailed) }
    }
    const wantsAudio = options.systemAudio && options.format !== 'gif'
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: profile.fps }, audio: wantsAudio })
    } catch (error) {
      if (!wantsAudio) throw error
      // 部分平台不支持系统声音回环：重新授权来源后只录画面。
      await request('rearm', { source: options.source })
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: profile.fps }, audio: false })
      this.events.onWarning(messages.audioFallback)
    }
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = this.stream
    await video.play()
    this.video = video
    const sourceWidth = video.videoWidth, sourceHeight = video.videoHeight
    // 区域录制：按显示器的实际视频像素换算裁剪框。
    const scaleX = options.screen ? sourceWidth / options.screen.width : 1
    const scaleY = options.screen ? sourceHeight / options.screen.height : 1
    const crop = options.crop && options.screen
      ? { x: (options.crop.x - options.screen.x) * scaleX, y: (options.crop.y - options.screen.y) * scaleY, width: options.crop.width * scaleX, height: options.crop.height * scaleY }
      : { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
    const limit = options.format === 'gif' ? profile.gifWidth / crop.width : profile.height / crop.height
    const ratio = Math.min(1, limit)
    // 编码器要求偶数尺寸。
    const width = Math.max(2, Math.round(crop.width * ratio / 2) * 2), height = Math.max(2, Math.round(crop.height * ratio / 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: options.format === 'gif' })!
    const frame = (): void => {
      // 窗口来源尺寸会随窗口变化，按当前视频尺寸等比铺满。
      if (!options.crop && (video.videoWidth !== sourceWidth || video.videoHeight !== sourceHeight)) {
        context.fillStyle = '#000'; context.fillRect(0, 0, width, height)
        const fit = Math.min(width / video.videoWidth, height / video.videoHeight)
        const w = video.videoWidth * fit, h = video.videoHeight * fit
        context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h)
      } else context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
    }
    frame()
    const fps = options.format === 'gif' ? GIF_FPS : profile.fps
    if (options.format === 'gif') {
      const gif = GIFEncoder()
      this.gif = gif
      this.frameTimer = setInterval(() => {
        if (this.paused || this.ended) return
        frame()
        const { data } = context.getImageData(0, 0, width, height)
        const palette = quantize(data, 256, { format: 'rgb444' })
        gif.writeFrame(applyPalette(data, palette, 'rgb444'), width, height, { palette, delay: 1000 / GIF_FPS })
        // 每帧编码后立即取走字节流并落盘，不在内存中积累整段 GIF。
        this.send(gif.bytes())
        gif.stream.reset()
      }, 1000 / fps)
    } else {
      this.frameTimer = setInterval(frame, 1000 / fps)
      this.output = canvas.captureStream(fps)
      for (const track of this.audioTracks()) this.output.addTrack(track)
      const type = recorderType(options.format)
      const recorder = new MediaRecorder(this.output, {
        ...(type.mimeType ? { mimeType: type.mimeType } : {}), videoBitsPerSecond: profile.bitrate, audioBitsPerSecond: 128_000,
      })
      this.recorder = recorder
      recorder.ondataavailable = event => {
        if (!event.data.size || this.cancelled) return
        void event.data.arrayBuffer().then(buffer => { this.send(new Uint8Array(buffer)) })
      }
      recorder.onstop = () => { void this.finish() }
      recorder.onerror = () => { this.failure ??= new Error('MediaRecorder failed'); this.stop(true) }
      recorder.start(1000)
    }
    for (const track of this.stream.getVideoTracks()) track.onended = () => { this.stop() }
    if (options.keyframes) this.keyTimer = setInterval(() => { void this.keyframe(canvas) }, 2000)
    this.started = performance.now()
    this.tickTimer = setInterval(() => {
      const seconds = this.seconds()
      this.events.onTick(seconds)
      if (seconds >= (options.format === 'gif' ? MAX_GIF_SECONDS : MAX_SECONDS)) this.stop()
    }, 250)
  }

  /** 画面变化明显时保存一张关键帧（PNG），供录屏转知识图谱识别。 */
  private async keyframe(source: HTMLCanvasElement): Promise<void> {
    if (this.paused || this.ended) return
    const probe = document.createElement('canvas')
    probe.width = 64; probe.height = 36
    const context = probe.getContext('2d', { willReadFrequently: true })!
    context.drawImage(source, 0, 0, 64, 36)
    const pixels = context.getImageData(0, 0, 64, 36).data
    if (this.lastKey) {
      let difference = 0
      for (let index = 0; index < pixels.length; index += 4) difference += Math.abs(pixels[index]! - this.lastKey[index]!)
      if (difference / (pixels.length / 4) < 10) return
    }
    this.lastKey = pixels
    const copy = document.createElement('canvas')
    const ratio = Math.min(1, 1600 / source.width)
    copy.width = Math.round(source.width * ratio); copy.height = Math.round(source.height * ratio)
    copy.getContext('2d')!.drawImage(source, 0, 0, copy.width, copy.height)
    const frame = { data: await canvasPng(copy), at: this.seconds() }
    // 超出上限时隔一张丢一张，保持整段时间的覆盖。
    if (this.keyframes.length >= MAX_KEYFRAMES) this.keyframes.splice(0, this.keyframes.length, ...this.keyframes.filter((_item, index) => index % 2 === 0))
    this.keyframes.push(frame)
  }

  /** 暂停或继续。 */
  togglePause(): void {
    if (this.ended) return
    if (!this.paused) {
      this.recorder?.state === 'recording' && this.recorder.pause()
      this.elapsed += performance.now() - this.started
      this.paused = true
    } else {
      this.recorder?.state === 'paused' && this.recorder.resume()
      this.started = performance.now()
      this.paused = false
    }
  }

  /**
   * 停止录制。
   * @param cancel 是否放弃本次录制。
   */
  stop(cancel = false): void {
    this.cancelled ||= cancel
    if (this.ended) return
    if (this.recorder && this.recorder.state !== 'inactive') { this.recorder.stop(); return }
    void this.finish()
  }

  private async finish(): Promise<void> {
    if (this.ended) return
    this.ended = true
    if (!this.paused && this.started > 0) this.elapsed += performance.now() - this.started
    this.paused = false
    if (this.gif && !this.cancelled) {
      this.gif.finish()
      this.send(this.gif.bytes())
    }
    this.release()
    await this.queue
    this.events.onEnd({ cancelled: this.cancelled, ...(this.failure === undefined ? {} : { error: this.failure }) })
  }

  /** 释放所有媒体轨道与定时器。 */
  release(): void {
    for (const timer of [this.frameTimer, this.tickTimer]) clearInterval(timer)
    clearInterval(this.keyTimer)
    for (const media of [this.stream, this.output, this.microphone]) for (const track of media?.getTracks() ?? []) { track.onended = null; track.stop() }
    void this.audioContext?.close().catch(() => { /* 音频上下文可能已关闭。 */ })
    if (this.video) { this.video.pause(); this.video.srcObject = null }
    this.stream = undefined; this.output = undefined; this.microphone = undefined
  }
}
