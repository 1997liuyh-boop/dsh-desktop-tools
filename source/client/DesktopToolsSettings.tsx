/** 桌面工具的分区设置和功能运行状态。 */
import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { DesktopModelSelection, DesktopToolsConfig, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../apps/desktop/src/desktop-tools-types.ts'
import type { en } from './locales.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

type Copy = (key: keyof typeof en) => string
type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }
export interface DesktopToolsSettingsServices {
  snapshot(): Promise<RemoteResult<DesktopToolsSnapshot>>
  update(config: DesktopToolsConfig): Promise<RemoteResult<DesktopToolsUpdateResult>>
  restart(): Promise<RemoteResult<DesktopToolsSnapshot>>
  avatar(): Promise<RemoteResult<{ readonly dataUrl?: string; readonly defaultDataUrl?: string }>>
  setAvatar(dataUrl: string, fileName: string): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean }>>
  restoreAvatar(): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean }>>
  systemPermissions(): Promise<RemoteResult<{ readonly screen?: boolean; readonly accessibility?: boolean }>>
  openSystemPermission(right: 'screen' | 'accessibility'): Promise<RemoteResult<unknown>>
  /** 安装或启用前置插件 dsh-vision-router。 */
  installVision(): Promise<RemoteResult<{ readonly snapshot: DesktopToolsSnapshot; readonly restartRequired: boolean }>>
  /** 立即打开截图、录屏或长截图。 */
  openCapture(mode: 'image' | 'video' | 'long'): Promise<RemoteResult<{ readonly opened: true }>>
  /** DSH「模型」设置中当前可用的服务商与模型；宿主不可用时返回 undefined。 */
  modelCatalog(): Promise<ModelCatalog | undefined>
}

/** 与 DSH 模型选择器一致的目录结构（只取用到的字段）。 */
export interface ModelCatalog {
  readonly groups: readonly {
    readonly id: string
    readonly name: string
    readonly models: readonly {
      readonly id: string
      readonly name: string
      readonly reasoning?: { readonly efforts: readonly { readonly id: string; readonly name: string }[]; readonly defaultEffort?: string }
    }[]
  }[]
}

/** 划词目标语言下拉项；与划词结果窗一致，en/zh 是历史配置值。 */
const LANGUAGES: readonly (readonly [value: string, label: string])[] = [
  ['en', 'English'], ['简体中文', '简体中文'], ['繁體中文', '繁體中文'], ['日本語', '日本語'], ['한국어', '한국어'], ['Français', 'Français'],
  ['Deutsch', 'Deutsch'], ['Español', 'Español'], ['Português', 'Português'], ['Русский', 'Русский'], ['العربية', 'العربية'],
  ['हिन्दी', 'हिन्दी'], ['Italiano', 'Italiano'], ['Tiếng Việt', 'Tiếng Việt'], ['ไทย', 'ไทย'],
]
const OTHER_LANGUAGE = '__other__'
/** @param value 配置中的目标语言。 @returns 对应的下拉值；列表外为「其他语言」。 */
function languageChoice(value: string): string {
  const normalized = value === 'English' ? 'en' : value === 'zh' || value === 'Chinese' || value === '中文' ? '简体中文' : value
  return LANGUAGES.some(([key]) => key === normalized) ? normalized : OTHER_LANGUAGE
}

/** 可录制的全局快捷键字段。 */
type ShortcutField = 'screenshot.shortcut' | 'screenshot.longShortcut' | 'recording.shortcut'

const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: 'Space', Enter: 'Return', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', PrintScreen: 'PrintScreen',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`', Backslash: '\\',
}

/**
 * 把键盘事件转换为 Electron 全局快捷键字符串。
 * @param event 用户按下的组合键。
 * @returns 合法的 Accelerator；缺少修饰键或主键不受支持时为 undefined。
 */
function acceleratorOf(event: KeyboardEvent): string | undefined {
  const code = event.code
  const key = /^Key[A-Z]$/u.test(code) ? code.slice(3) : /^Digit\d$/u.test(code) ? code.slice(5) : /^F([1-9]|1\d|2[0-4])$/u.test(code) ? code : KEY_NAMES[code]
  if (key === undefined) return undefined
  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0 && key !== 'PrintScreen') return undefined
  return [...modifiers, key].join('+')
}

/** @param value Accelerator。 @param platform 当前平台。 @returns 便于阅读的按键文本。 */
function acceleratorLabel(value: string, platform: string | undefined): string {
  if (value === '') return '—'
  const mac = platform === 'darwin'
  return value.split('+').map(part => part === 'CommandOrControl' ? (mac ? '⌘' : 'Ctrl') : mac && part === 'Alt' ? '⌥' : mac && part === 'Shift' ? '⇧' : part).join(' + ')
}

interface DesktopToolsSettingsInjected { readonly services: DesktopToolsSettingsServices }
export type DesktopToolsSettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'desktopTools'>
  & InjectFace<DesktopToolsSettingsInjected>

const tabs = ['selection', 'floating', 'screenshot', 'recording'] as const
type Tab = typeof tabs[number]

function statusLabel(phase: string, t: Copy): string {
  if (phase === 'active') return t('featureActive')
  if (phase === 'starting') return t('featureStarting')
  if (phase === 'error') return t('featureError')
  return t('featureDisabled')
}

function applicationMatches(snapshot: DesktopToolsSnapshot): boolean {
  const expected = {
    selection: snapshot.config.selection.enabled,
    floatingBall: snapshot.config.floatingBall.enabled,
    capture: snapshot.config.screenshot.enabled || snapshot.config.recording.enabled,
  } as const
  return (Object.keys(expected) as Array<keyof typeof expected>).every((id) => {
    const phase = snapshot.features[id].phase
    return expected[id] ? phase === 'active' : phase === 'disabled'
  })
}

const FIELD_CLASS = 'min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2 text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60'

/**
 * 服务商 / 模型 / 推理强度三级下拉，选项与 DSH「模型」设置保持一致。
 * 目录不可用时退回文本输入；当前值不在目录中时仍作为选项保留并标注不可用。
 */
function ModelFields({ value, disabled, t, catalog, onChange }: {
  value: DesktopModelSelection
  disabled: boolean
  t: Copy
  catalog: ModelCatalog | undefined
  onChange: (value: DesktopModelSelection) => void
}): ReactNode {
  if (catalog === undefined || catalog.groups.length === 0) {
    return <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      {(['provider', 'model', 'reasoningEffort'] as const).map((field) => <label className="grid min-w-0 gap-1 text-sm" key={field}>
        <span className="text-[var(--dsw-alias-label-tertiary)]">{t(field === 'reasoningEffort' ? 'effort' : field)}</span>
        <input className={FIELD_CLASS} disabled={disabled} value={value[field] ?? ''} onChange={event => onChange({ ...value, [field]: event.currentTarget.value })} />
      </label>)}
    </div>
  }
  const group = catalog.groups.find(item => item.id === value.provider)
  const model = group?.models.find(item => item.id === value.model)
  const efforts = model?.reasoning?.efforts ?? []
  const pickModel = (providerId: string, modelId: string | undefined): void => {
    const nextGroup = catalog.groups.find(item => item.id === providerId)
    const nextModel = nextGroup?.models.find(item => item.id === modelId) ?? nextGroup?.models[0]
    if (nextGroup === undefined || nextModel === undefined) return
    const nextEfforts = nextModel.reasoning?.efforts ?? []
    // 换模型时保留仍受支持的推理强度，否则用模型默认值。
    const effort = nextEfforts.some(item => item.id === value.reasoningEffort) ? value.reasoningEffort
      : nextModel.reasoning?.defaultEffort ?? nextEfforts[0]?.id
    onChange({ provider: nextGroup.id, model: nextModel.id, ...(effort === undefined ? {} : { reasoningEffort: effort }) })
  }
  const unavailable = (label: string): string => `${label}（${t('modelUnavailable')}）`
  return <div className="grid min-w-0 gap-3 sm:grid-cols-3">
    <label className="grid min-w-0 gap-1 text-sm"><span className="text-[var(--dsw-alias-label-tertiary)]">{t('provider')}</span>
      <select className={FIELD_CLASS} disabled={disabled} value={value.provider} onChange={event => pickModel(event.currentTarget.value, undefined)}>
        {group === undefined && <option value={value.provider}>{unavailable(value.provider)}</option>}
        {catalog.groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    <label className="grid min-w-0 gap-1 text-sm"><span className="text-[var(--dsw-alias-label-tertiary)]">{t('model')}</span>
      <select className={FIELD_CLASS} disabled={disabled || group === undefined} value={value.model} onChange={event => pickModel(value.provider, event.currentTarget.value)}>
        {model === undefined && <option value={value.model}>{unavailable(value.model)}</option>}
        {group?.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    <label className="grid min-w-0 gap-1 text-sm"><span className="text-[var(--dsw-alias-label-tertiary)]">{t('effort')}</span>
      <select className={FIELD_CLASS} disabled={disabled || efforts.length === 0} value={value.reasoningEffort ?? ''}
        onChange={event => { const effort = event.currentTarget.value; const { reasoningEffort: _effort, ...rest } = value; onChange(effort === '' ? rest : { ...rest, reasoningEffort: effort }) }}>
        {efforts.length === 0 && <option value="">{t('effortNone')}</option>}
        {value.reasoningEffort !== undefined && efforts.length > 0 && !efforts.some(item => item.id === value.reasoningEffort)
          && <option value={value.reasoningEffort}>{unavailable(value.reasoningEffort)}</option>}
        {efforts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
  </div>
}

export function DesktopToolsSettings({ t, services }: DesktopToolsSettingsProps): ReactNode {
  const [tab, setTab] = useState<Tab>('selection')
  const [snapshot, setSnapshot] = useState<DesktopToolsSnapshot>()
  const [draft, setDraft] = useState<DesktopToolsConfig>()
  const [avatar, setAvatar] = useState<string>()
  const [defaultAvatar, setDefaultAvatar] = useState<string>()
  const [catalog, setCatalog] = useState<ModelCatalog>()
  const [customLanguage, setCustomLanguage] = useState(false)
  const [permissions, setPermissions] = useState<{ readonly screen?: boolean; readonly accessibility?: boolean }>()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [capturing, setCapturing] = useState<ShortcutField>()
  const [installing, setInstalling] = useState(false)

  const load = async (): Promise<void> => {
    setMessage('')
    // 后端未就绪时远程调用可能抛错或一直不返回：限时 15 秒并把原因显示出来，避免页面只剩省略号
    let result: Awaited<ReturnType<DesktopToolsSettingsServices['snapshot']>>
    try {
      result = await Promise.race([services.snapshot(), new Promise<never>((_, reject) => { setTimeout(() => { reject(new Error('timeout')) }, 15_000) })])
    } catch (error) {
      setMessage(t('loadError') + '（' + (error instanceof Error ? error.message : String(error)) + '）')
      return
    }
    if (!result.ok) { setMessage(t('loadError') + '（' + String((result.error as { message?: unknown } | undefined)?.message ?? result.error) + '）'); return }
    setSnapshot(result.value)
    setDraft(result.value.config)
    setMessage('')
    setCustomLanguage(languageChoice(result.value.config.selection.targetLanguage) === OTHER_LANGUAGE)
    const image = await services.avatar()
    if (image.ok) { setAvatar(image.value.dataUrl); setDefaultAvatar(image.value.defaultDataUrl) }
    // 模型目录读取失败不影响其余设置，模型选择退回文本输入。
    void services.modelCatalog().then(setCatalog, () => { setCatalog(undefined) })
  }

  useEffect(() => { void load() }, [])

  const save = async (): Promise<void> => {
    if (draft === undefined || busy) return
    setBusy(true)
    setMessage('')
    const result = await services.update(draft)
    setBusy(false)
    if (!result.ok) { setMessage(t('saveError')); return }
    setSnapshot(result.value.snapshot)
    setDraft(result.value.snapshot.config)
    setPending(!result.value.applied)
    setMessage(result.value.applied ? t('saved') : t('pending'))
  }

  const retry = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    const result = await services.restart()
    setBusy(false)
    if (!result.ok) { setMessage(t('pending')); return }
    setSnapshot(result.value)
    const applied = applicationMatches(result.value)
    setPending(!applied)
    setMessage(applied ? t('saved') : t('pending'))
  }

  const setFeature = (feature: Tab, enabled: boolean): void => {
    if (draft === undefined) return
    if (feature === 'selection') setDraft({ ...draft, selection: { ...draft.selection, enabled } })
    else if (feature === 'floating') setDraft({ ...draft, floatingBall: { ...draft.floatingBall, enabled } })
    else if (feature === 'screenshot') setDraft({ ...draft, screenshot: { ...draft.screenshot, enabled } })
    else setDraft({ ...draft, recording: { ...draft.recording, enabled } })
  }

  const active = snapshot?.features[tab === 'floating' ? 'floatingBall' : tab === 'selection' ? 'selection' : 'capture']
  const enabled = draft === undefined ? false : tab === 'selection' ? draft.selection.enabled
    : tab === 'floating' ? draft.floatingBall.enabled : tab === 'screenshot' ? draft.screenshot.enabled : draft.recording.enabled
  const setShortcut = (field: ShortcutField, value: string): void => {
    if (draft === undefined) return
    if (field === 'screenshot.shortcut') setDraft({ ...draft, screenshot: { ...draft.screenshot, shortcut: value } })
    else if (field === 'screenshot.longShortcut') setDraft({ ...draft, screenshot: { ...draft.screenshot, longShortcut: value } })
    else setDraft({ ...draft, recording: { ...draft.recording, shortcut: value } })
  }
  const shortcutValue = (field: ShortcutField): string => draft === undefined ? '' : field === 'screenshot.shortcut' ? draft.screenshot.shortcut
    : field === 'screenshot.longShortcut' ? draft.screenshot.longShortcut : draft.recording.shortcut
  const captureShortcut = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); setCapturing(undefined); return }
    if (/^(Control|Alt|Shift|Meta)$/u.test(event.key)) return
    event.preventDefault()
    const accelerator = acceleratorOf(event)
    if (accelerator === undefined || capturing === undefined) { setMessage(t('shortcutInvalid')); return }
    setShortcut(capturing, accelerator)
    setMessage('')
    setCapturing(undefined)
  }

  const installVision = async (): Promise<void> => {
    if (installing) return
    setInstalling(true)
    setMessage(t('visionInstalling'))
    const result = await services.installVision()
    setInstalling(false)
    if (!result.ok) { setMessage(t('visionInstallFailed')); return }
    setSnapshot(result.value.snapshot)
    setMessage(result.value.restartRequired ? t('visionRestart') : t('visionReady'))
  }

  useEffect(() => {
    if (capturing === undefined) return
    const listener = (event: KeyboardEvent): void => { captureShortcut(event) }
    document.addEventListener('keydown', listener, true)
    return () => document.removeEventListener('keydown', listener, true)
  }, [capturing])

  const uploadAvatar = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file === undefined || !file.type.match(/^image\/(gif|png|webp)$/u)) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      void services.setAvatar(reader.result, file.name).then(result => {
        if (result.ok && typeof reader.result === 'string') setAvatar(reader.result)
        else setMessage(t('saveError'))
      })
    }
    reader.readAsDataURL(file)
  }

  const checkPermissions = async (): Promise<void> => {
    const result = await services.systemPermissions()
    if (result.ok) setPermissions(result.value)
    else setMessage(t('pending'))
  }

  const setModel = (key: 'selection' | 'conversationModel' | 'backgroundModel', value: DesktopModelSelection): void => {
    if (draft === undefined) return
    if (key === 'selection') setDraft({ ...draft, selection: { ...draft.selection, model: value } })
    else if (key === 'conversationModel') setDraft({ ...draft, floatingBall: { ...draft.floatingBall, conversationModel: value } })
    else setDraft({ ...draft, floatingBall: { ...draft.floatingBall, backgroundModel: value } })
  }

  const setSelectionModelEnabled = (enabled: boolean): void => {
    if (draft === undefined) return
    if (enabled) setDraft({ ...draft, selection: { ...draft.selection, model: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'max' } } })
    else {
      const { model: _model, ...selection } = draft.selection
      setDraft({ ...draft, selection })
    }
  }

  if (draft === undefined) return <section className="grid gap-4" aria-busy="true">
    <h2 className="text-base font-semibold text-[var(--dsw-alias-label-primary)]">{t('title')}</h2>
    {message
      ? <><p role="alert" className="text-sm text-[var(--dsw-alias-state-error-primary)]">{message}</p>
        <button type="button" className="w-fit rounded border border-[var(--dsw-alias-border-l2)] px-3 py-1.5 text-sm" onClick={() => { void load() }}>{t('retryLoad')}</button></>
      : <p role="status" className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t('loading')}</p>}
  </section>

  return <section className="grid min-w-0 gap-4 text-[var(--dsw-alias-label-primary)]" aria-busy={busy}>
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{snapshot?.runtime === 'running' ? t('runtimeRunning') : snapshot?.runtime === 'degraded' ? t('runtimeDegraded') : t('runtimeStopped')}</span>
    </header>
    <nav className="flex flex-wrap gap-1 border-b border-[var(--border-subtle)]" aria-label={t('title')}>
      {tabs.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
        className="max-w-full border-b-2 border-transparent px-3 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)] aria-selected:border-[var(--dsw-alias-brand-primary)] aria-selected:text-[var(--dsw-alias-label-primary)]">
        {t(item)}
      </button>)}
    </nav>
    <div className="grid min-w-0 gap-4" role="tabpanel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setFeature(tab, event.currentTarget.checked)} />{t('enabled')}</label>
        <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{statusLabel(active?.phase ?? 'disabled', t)}</span>
        {active?.phase === 'error' && active.error && <span role="alert" className="basis-full text-xs text-[var(--dsw-alias-state-error-primary)]">{active.error}</span>}
      </div>
      {tab === 'selection' && <>
        <div className="grid gap-1 text-sm"><label htmlFor="desktop-tools-language">{t('language')}</label>
          <div className="flex min-w-0 flex-wrap gap-2">
            <select id="desktop-tools-language" className={FIELD_CLASS} value={customLanguage ? OTHER_LANGUAGE : languageChoice(draft.selection.targetLanguage)}
              onChange={event => {
                const value = event.currentTarget.value
                setCustomLanguage(value === OTHER_LANGUAGE)
                if (value !== OTHER_LANGUAGE) setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: value } })
              }}>
              {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value={OTHER_LANGUAGE}>{t('otherLanguage')}</option>
            </select>
            {customLanguage && <input className={`${FIELD_CLASS} flex-1`} aria-label={t('otherLanguage')} placeholder={t('otherLanguagePlaceholder')} maxLength={80}
              value={languageChoice(draft.selection.targetLanguage) === OTHER_LANGUAGE ? draft.selection.targetLanguage : ''}
              onChange={event => setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: event.currentTarget.value } })} />}
          </div>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.selection.compatibilityCopy} onChange={event => setDraft({ ...draft, selection: { ...draft.selection, compatibilityCopy: event.currentTarget.checked } })} />{t('compatibilityCopy')}</label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.selection.model !== undefined} onChange={event => setSelectionModelEnabled(event.currentTarget.checked)} />{t('customModel')}</label>
        {draft.selection.model === undefined ? <p className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t('followSession')}</p>
          : <ModelFields value={draft.selection.model} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('selection', value)} />}
      </>}
      {tab === 'floating' && <>
        <div className="flex flex-wrap items-center gap-3">{(avatar ?? defaultAvatar) === undefined ? <span aria-hidden="true" className="size-12 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)]" />
          : <img src={avatar ?? defaultAvatar} alt={t('avatar')} className="size-12 rounded border border-[var(--dsw-alias-border-l2)] object-cover" />}
          {avatar === undefined && defaultAvatar !== undefined && <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{t('defaultAvatar')}</span>}
          <label className="cursor-pointer rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[var(--dsw-alias-brand-primary)]">{t('chooseAvatar')}<input className="sr-only" type="file" accept="image/gif,image/png,image/webp" onChange={uploadAvatar} /></label>
          <button type="button" className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm" onClick={() => { void services.restoreAvatar().then(result => { if (result.ok) void load() }) }}>{t('restoreAvatar')}</button>
        </div>
        <h3 className="text-sm font-medium">{t('conversationModel')}</h3><ModelFields value={draft.floatingBall.conversationModel} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('conversationModel', value)} />
        <h3 className="text-sm font-medium">{t('backgroundModel')}</h3><ModelFields value={draft.floatingBall.backgroundModel} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('backgroundModel', value)} />
        <label className="grid gap-1 text-sm"><span>{t('permissionPreset')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.floatingBall.permissionPreset} onChange={event => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, permissionPreset: event.currentTarget.value as DesktopToolsConfig['floatingBall']['permissionPreset'] } })}><option value="read-only">read-only</option><option value="workspace-write">workspace-write</option><option value="danger-full-access">danger-full-access</option></select></label>
        <label className="grid gap-1 text-sm"><span>{t('coordinateMode')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.floatingBall.coordinateMode} onChange={event => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, coordinateMode: event.currentTarget.value as DesktopToolsConfig['floatingBall']['coordinateMode'] } })}><option value="millifraction">millifraction</option><option value="pixel">pixel</option></select></label>
        <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{t('systemPermissions')}</h3><button type="button" className="text-sm text-[var(--dsw-alias-brand-primary)]" onClick={() => { void checkPermissions() }}>{t('check')}</button></div>
          {(['screen', 'accessibility'] as const).map(right => <div key={right} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{t(right === 'screen' ? 'screenPermission' : 'accessibilityPermission')}</span><span>{permissions?.[right] === true ? t('permissionGranted') : permissions?.[right] === false ? t('permissionDenied') : t('permissionUnknown')}</span><button type="button" className="text-[var(--dsw-alias-brand-primary)]" onClick={() => { void services.openSystemPermission(right).then(() => { void checkPermissions() }) }}>{t('openSettings')}</button></div>)}
        </div>
      </>}
      {(tab === 'screenshot' || tab === 'recording') && <div className="grid gap-3">
        {(tab === 'screenshot' ? ['screenshot.shortcut', 'screenshot.longShortcut'] as const : ['recording.shortcut'] as const).map(field => <div key={field} className="grid gap-1">
          <span className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t(field === 'screenshot.longShortcut' ? 'longShortcut' : 'shortcut')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <kbd className="rounded border border-[var(--dsw-alias-border-l2)] px-2 py-1 text-sm">{acceleratorLabel(shortcutValue(field), snapshot?.platform)}</kbd>
            <button type="button" className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)]" onClick={() => setCapturing(field)}>{capturing === field ? t('recordingShortcut') : t('recordShortcut')}</button>
            {shortcutValue(field) !== '' && <button type="button" className="px-2 py-2 text-sm text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)]" onClick={() => setShortcut(field, '')}>{t('clearShortcut')}</button>}
            <button type="button" className="px-2 py-2 text-sm text-[var(--dsw-alias-brand-primary)] disabled:opacity-50" disabled={active?.phase !== 'active'} onClick={() => { void services.openCapture(field === 'recording.shortcut' ? 'video' : field === 'screenshot.longShortcut' ? 'long' : 'image') }}>{t('tryNow')}</button>
          </div>
        </div>)}
        <p className="text-xs text-[var(--dsw-alias-label-tertiary)]">{t('globalShortcutHint')}</p>
      </div>}
      {tab === 'screenshot' && <div className="grid gap-2 rounded border border-[var(--dsw-alias-border-l2)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t('visionTitle')}</h3>
          <span className={snapshot?.vision.state === 'ready' ? 'text-xs text-[var(--dsw-alias-state-success-primary)]' : 'text-xs text-[var(--dsw-alias-label-tertiary)]'}>{t(snapshot?.vision.state === 'ready' ? 'visionStateReady' : snapshot?.vision.state === 'missing' ? 'visionStateMissing' : snapshot?.vision.state === 'disabled' ? 'visionStateDisabled' : snapshot?.vision.state === 'tool-off' ? 'visionStateToolOff' : 'visionStateUnknown')}</span>
        </div>
        <p className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t('visionDescription')}</p>
        {snapshot?.vision.state !== 'ready' && snapshot?.vision.state !== 'tool-off' && <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={installing} className="rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => { void installVision() }}>{installing ? t('visionInstalling') : snapshot?.vision.state === 'disabled' ? t('visionEnable') : t('visionInstall')}</button>
          <code className="text-xs text-[var(--dsw-alias-label-tertiary)]">dsh plugin add dsh-vision-router</code>
        </div>}
      </div>}
      {tab === 'recording' && <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm"><span>{t('recordingFormat')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.recording.format} onChange={event => setDraft({ ...draft, recording: { ...draft.recording, format: event.currentTarget.value as DesktopToolsConfig['recording']['format'] } })}><option value="mp4">MP4</option><option value="gif">GIF</option><option value="webm">WebM</option></select></label>
          <label className="grid gap-1 text-sm"><span>{t('recordingQuality')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.recording.quality} onChange={event => setDraft({ ...draft, recording: { ...draft.recording, quality: event.currentTarget.value as DesktopToolsConfig['recording']['quality'] } })}><option value="sd">{t('qualitySd')}</option><option value="hd">{t('qualityHd')}</option><option value="original">{t('qualityOriginal')}</option></select></label>
        </div>
        {(['systemAudio', 'microphone', 'knowledgeGraph'] as const).map(field => <label key={field} className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.recording[field]} disabled={field === 'systemAudio' && snapshot?.platform === 'linux'} onChange={event => setDraft({ ...draft, recording: { ...draft.recording, [field]: event.currentTarget.checked } })} />
          {t(field === 'systemAudio' ? 'recordingSystemAudio' : field === 'microphone' ? 'recordingMicrophone' : 'recordingGraph')}
        </label>)}
        <p className="text-xs text-[var(--dsw-alias-label-tertiary)]">{t('recordingGraphHint')}</p>
      </div>}
    </div>
    {message && <p role="status" className={message === t('saved') ? 'text-sm text-[var(--dsw-alias-state-success-primary)]' : 'text-sm text-[var(--dsw-alias-state-error-primary)]'}>{message}</p>}
    <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--dsw-alias-border-l2)] pt-3"><button type="button" disabled={busy} className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50" onClick={() => { void load() }}>{t('check')}</button>{pending && <button type="button" disabled={busy} className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50" onClick={() => { void retry() }}>{t('retry')}</button>}<button type="button" disabled={busy} className="rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => { void save() }}>{busy ? t('saving') : t('save')}</button></footer>
  </section>
}
