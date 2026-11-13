/** 桌面工具的分区设置和功能运行状态。 */
import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { DesktopModelSelection, DesktopToolsConfig, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../apps/desktop/src/desktop-tools-types.ts'
import type { en } from './locales.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutlineRegular, Menu, Switch, type MenuItem } from '@deepseek-ai/dsh-client-ui-primitives'

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

/*
 * 设置面板外观对照 DSH 自带设置页：
 * - 行：「通用设置」的设置行，左侧标题 + 描述，右侧控件，行间 0.5px 分隔线；
 * - 页签：「内置插件」的「插件列表 / 插件市场」页签；
 * - 下拉：「通用设置 → 权限」，宿主 Menu 原语挂在圆角选择按钮上；
 * - 按钮：「账号与余额 → 更多」的「查询用量 / 充值」两种按钮；
 * - 开关：「通用设置 → 显示代码工作视图」的宿主 Switch 原语。
 */
const ROW_CLASS = 'flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-[0.5px] border-[var(--dsw-alias-border-l2)] py-4 last:border-b-0'
const SELECTOR_CLASS = 'inline-flex h-9 max-w-full min-w-0 cursor-pointer items-center gap-3 rounded-[var(--dsw-radius-md)] border-0 bg-[var(--dsw-alias-bg-module-platform)] px-3.5 text-sm leading-[22px] text-[var(--dsw-alias-label-primary)] hover:enabled:bg-[var(--dsw-alias-interactive-bg-hover)] disabled:cursor-default disabled:opacity-60'
const INPUT_CLASS = 'h-9 min-w-0 rounded-[var(--dsw-radius-md)] border-0 bg-[var(--dsw-alias-bg-module-platform)] px-3.5 text-sm leading-[22px] text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60'
const BUTTON_BASE = 'inline-flex h-9 min-w-[58px] flex-none cursor-pointer items-center justify-center whitespace-nowrap rounded-[var(--dsw-radius-md)] border-[0.5px] border-solid px-3.5 text-sm leading-[22px] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] disabled:cursor-default disabled:opacity-50'
/** 次要按钮：「查询用量」，透明底 + 0.5px 描边。 */
const BUTTON_CLASS = `${BUTTON_BASE} border-[var(--dsw-alias-border-l3)] bg-transparent text-[var(--dsw-alias-label-primary)] hover:enabled:bg-[var(--dsw-alias-interactive-bg-hover)]`
/** 主按钮：「充值」，品牌色实底、无描边、字重 500。 */
const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} border-transparent bg-[var(--dsw-alias-button-primary-fill)] font-medium text-[var(--dsw-alias-label-primary-foreground)] hover:enabled:bg-[var(--dsw-alias-button-primary-hover)]`

/** 设置行：左侧标题与描述，右侧控件；控件多时在窄面板里换到下一行。 */
function Row({ title, description, children, alert }: { title: ReactNode; description?: ReactNode; children?: ReactNode; alert?: ReactNode }): ReactNode {
  return <div className={ROW_CLASS}>
    <div className="flex min-w-[220px] flex-1 basis-[220px] flex-col gap-1 pr-0 sm:pr-12">
      <div className="text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]">{title}</div>
      {description !== undefined && <div className="text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]">{description}</div>}
      {alert !== undefined && <div role="alert" className="text-xs leading-[18px] text-[var(--dsw-alias-state-error-primary)]">{alert}</div>}
    </div>
    {children !== undefined && <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">{children}</div>}
  </div>
}

/** 下拉选择：宿主 Menu 原语 + 「权限」行同款选择按钮，选中项带对勾。 */
function Select({ value, options, onChange, disabled = false, label }: {
  value: string
  options: readonly MenuItem[]
  onChange: (value: string) => void
  disabled?: boolean
  label: string
}): ReactNode {
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.id === value)
  return <Menu
    open={open}
    onClose={() => setOpen(false)}
    items={options}
    selectedId={value}
    onSelect={(id) => { setOpen(false); if (id !== value) onChange(id) }}
    align="end"
    portal
    anchor={<button type="button" className={SELECTOR_CLASS} aria-haspopup="menu" aria-expanded={open} aria-label={label} disabled={disabled || options.length === 0} onClick={() => setOpen(previous => !previous)}>
      <span className="min-w-0 truncate">{current?.label ?? value}</span>
      <IconChevronDownOutlineRegular className="flex-none" />
    </button>}
  />
}

/**
 * 服务商 / 模型 / 推理强度三个下拉，选项与 DSH「模型」设置保持一致，作为一行右侧的控件组。
 * 目录不可用时退回三个文本框；当前值不在目录中时仍作为选项保留并标注不可用。
 */
function ModelRows({ heading, description, value, disabled, t, catalog, onChange }: {
  heading?: string
  description?: string
  value: DesktopModelSelection
  disabled: boolean
  t: Copy
  catalog: ModelCatalog | undefined
  onChange: (value: DesktopModelSelection) => void
}): ReactNode {
  const title = heading ?? t('model')
  if (catalog === undefined || catalog.groups.length === 0) {
    return <Row title={title} description={description}>
      {(['provider', 'model', 'reasoningEffort'] as const).map(field => <input key={field} className={`${INPUT_CLASS} w-36`} disabled={disabled}
        aria-label={t(field === 'reasoningEffort' ? 'effort' : field)} placeholder={t(field === 'reasoningEffort' ? 'effort' : field)}
        value={value[field] ?? ''} onChange={event => onChange({ ...value, [field]: event.currentTarget.value })} />)}
    </Row>
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
  const providerOptions: MenuItem[] = [...(group === undefined ? [{ id: value.provider, label: unavailable(value.provider) }] : []), ...catalog.groups.map(item => ({ id: item.id, label: item.name }))]
  const modelOptions: MenuItem[] = [...(model === undefined ? [{ id: value.model, label: unavailable(value.model) }] : []), ...(group?.models.map(item => ({ id: item.id, label: item.name })) ?? [])]
  const effortOptions: MenuItem[] = efforts.length === 0 ? [{ id: '', label: t('effortNone') }]
    : [...(value.reasoningEffort !== undefined && !efforts.some(item => item.id === value.reasoningEffort) ? [{ id: value.reasoningEffort, label: unavailable(value.reasoningEffort) }] : []), ...efforts.map(item => ({ id: item.id, label: item.name }))]
  return <Row title={title} description={description ?? `${t('provider')} / ${t('model')} / ${t('effort')}`}>
    <Select label={t('provider')} value={value.provider} options={providerOptions} disabled={disabled} onChange={id => pickModel(id, undefined)} />
    <Select label={t('model')} value={value.model} options={modelOptions} disabled={disabled || group === undefined} onChange={id => pickModel(value.provider, id)} />
    <Select label={t('effort')} value={value.reasoningEffort ?? ''} options={effortOptions} disabled={disabled || efforts.length === 0}
      onChange={(effort) => { const { reasoningEffort: _effort, ...rest } = value; onChange(effort === '' ? rest : { ...rest, reasoningEffort: effort }) }} />
  </Row>
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

  if (draft === undefined) return <section className="flex min-w-0 flex-col gap-3 text-[var(--dsw-alias-label-primary)]" aria-busy="true">
    <h2 className="m-0 text-lg font-semibold">{t('title')}</h2>
    {message
      ? <><p role="alert" className="m-0 text-sm text-[var(--dsw-alias-state-error-primary)]">{message}</p>
        <button type="button" className={`${BUTTON_CLASS} w-fit`} onClick={() => { void load() }}>{t('retryLoad')}</button></>
      : <p role="status" className="m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]">{t('loading')}</p>}
  </section>

  const enableKey = tab === 'selection' ? 'enableSelection' : tab === 'floating' ? 'enableFloating' : tab === 'screenshot' ? 'enableScreenshot' : 'enableRecording'
  const languageOptions: MenuItem[] = [...LANGUAGES.map(([id, label]) => ({ id, label })), { id: OTHER_LANGUAGE, label: t('otherLanguage') }]
  const permissionText = (right: 'screen' | 'accessibility'): string => permissions?.[right] === true ? t('permissionGranted') : permissions?.[right] === false ? t('permissionDenied') : t('permissionUnknown')
  const shortcutRow = (field: ShortcutField): ReactNode => <Row key={field} title={t(field === 'screenshot.longShortcut' ? 'longShortcut' : 'shortcut')}
    description={capturing === field ? t('recordingShortcut') : t('shortcutDescription')}>
    <kbd className="inline-flex h-9 min-w-[58px] items-center justify-center rounded-[var(--dsw-radius-md)] bg-[var(--dsw-alias-bg-module-platform)] px-3 font-[inherit] text-sm">{acceleratorLabel(shortcutValue(field), snapshot?.platform)}</kbd>
    <button type="button" className={BUTTON_CLASS} onClick={() => setCapturing(capturing === field ? undefined : field)}>{capturing === field ? t('cancelRecording') : t('recordShortcut')}</button>
    {shortcutValue(field) !== '' && <button type="button" className={BUTTON_CLASS} onClick={() => setShortcut(field, '')}>{t('clearShortcut')}</button>}
    <button type="button" className={BUTTON_CLASS} disabled={active?.phase !== 'active'} onClick={() => { void services.openCapture(field === 'recording.shortcut' ? 'video' : field === 'screenshot.longShortcut' ? 'long' : 'image') }}>{t('tryNow')}</button>
  </Row>

  return <section className="flex min-w-0 flex-col gap-3 text-[var(--dsw-alias-label-primary)]" aria-busy={busy}>
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="m-0 text-lg font-semibold">{t('title')}</h2>
      <p className="m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]">{t('intro')} · {snapshot?.runtime === 'running' ? t('runtimeRunning') : snapshot?.runtime === 'degraded' ? t('runtimeDegraded') : t('runtimeStopped')}</p>
    </div>

    {/* 页签：与「内置插件 → 插件列表 / 插件市场」一致，13px 文字、当前项 2px 下划线 */}
    <div role="tablist" aria-label={t('title')} className="mt-0.5 flex flex-wrap items-end gap-x-[22px] border-b-[0.5px] border-[var(--dsw-alias-border-l2)]">
      {tabs.map((item, index) => <button key={item} id={`desktop-tools-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls="desktop-tools-panel"
        tabIndex={tab === item ? 0 : -1} data-active={tab === item ? 'true' : undefined}
        onClick={() => setTab(item)}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : undefined
          if (next === undefined) return
          event.preventDefault()
          setTab(tabs[next]!)
          document.getElementById(`desktop-tools-tab-${tabs[next]}`)?.focus()
        }}
        className="relative flex-none cursor-pointer border-0 bg-transparent px-px pb-[9px] pt-[7px] font-[inherit] text-[13px] leading-5 text-[var(--dsw-alias-label-tertiary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] data-[active=true]:text-[var(--dsw-alias-label-primary)] data-[active=true]:after:absolute data-[active=true]:after:inset-x-0 data-[active=true]:after:-bottom-px data-[active=true]:after:h-0.5 data-[active=true]:after:rounded-t-[2px] data-[active=true]:after:bg-[var(--dsw-alias-label-primary)] data-[active=true]:after:content-['']">
        {t(item)}
      </button>)}
    </div>

    <div id="desktop-tools-panel" role="tabpanel" aria-labelledby={`desktop-tools-tab-${tab}`} className="flex min-w-0 flex-col pt-0.5">
      <Row title={t(enableKey)} description={enabled ? statusLabel(active?.phase ?? 'disabled', t) : t('featureDisabled')} alert={active?.phase === 'error' && active.error ? active.error : undefined}>
        <Switch checked={enabled} disabled={busy} label={t(enableKey)} onChange={next => setFeature(tab, next)} />
      </Row>

      {tab === 'selection' && <>
        <Row title={t('language')} description={t('languageDescription')}>
          {customLanguage && <input className={`${INPUT_CLASS} w-40`} aria-label={t('otherLanguage')} placeholder={t('otherLanguagePlaceholder')} maxLength={80}
            value={languageChoice(draft.selection.targetLanguage) === OTHER_LANGUAGE ? draft.selection.targetLanguage : ''}
            onChange={event => setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: event.currentTarget.value } })} />}
          <Select label={t('language')} value={customLanguage ? OTHER_LANGUAGE : languageChoice(draft.selection.targetLanguage)} options={languageOptions}
            onChange={(value) => {
              setCustomLanguage(value === OTHER_LANGUAGE)
              if (value !== OTHER_LANGUAGE) setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: value } })
            }} />
        </Row>
        <Row title={t('compatibilityCopy')} description={t('compatibilityCopyDescription')}>
          <Switch checked={draft.selection.compatibilityCopy} disabled={busy} label={t('compatibilityCopy')} onChange={next => setDraft({ ...draft, selection: { ...draft.selection, compatibilityCopy: next } })} />
        </Row>
        <Row title={t('customModel')} description={draft.selection.model === undefined ? t('followSession') : t('customModelDescription')}>
          <Switch checked={draft.selection.model !== undefined} disabled={busy} label={t('customModel')} onChange={setSelectionModelEnabled} />
        </Row>
        {draft.selection.model !== undefined && <ModelRows value={draft.selection.model} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('selection', value)} />}
      </>}

      {tab === 'floating' && <>
        <Row title={t('avatar')} description={avatar === undefined && defaultAvatar !== undefined ? `${t('avatarDescription')} ${t('defaultAvatar')}` : t('avatarDescription')}>
          {(avatar ?? defaultAvatar) === undefined ? <span aria-hidden="true" className="size-9 rounded-[var(--dsw-radius-md)] bg-[var(--dsw-alias-bg-module-platform)]" />
            : <img src={avatar ?? defaultAvatar} alt={t('avatar')} className="size-9 rounded-[var(--dsw-radius-md)] object-cover" />}
          <label className={`${BUTTON_CLASS} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--dsw-alias-state-business-primary)]`}>{t('chooseAvatar')}<input className="sr-only" type="file" accept="image/gif,image/png,image/webp" onChange={uploadAvatar} /></label>
          <button type="button" className={BUTTON_CLASS} onClick={() => { void services.restoreAvatar().then(result => { if (result.ok) void load() }) }}>{t('restoreAvatar')}</button>
        </Row>
        <ModelRows heading={t('conversationModel')} description={t('conversationModelDescription')} value={draft.floatingBall.conversationModel} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('conversationModel', value)} />
        <ModelRows heading={t('backgroundModel')} description={t('backgroundModelDescription')} value={draft.floatingBall.backgroundModel} disabled={busy} t={t} catalog={catalog} onChange={value => setModel('backgroundModel', value)} />
        <Row title={t('permissionPreset')} description={t('permissionPresetDescription')}>
          <Select label={t('permissionPreset')} value={draft.floatingBall.permissionPreset} disabled={busy}
            options={[{ id: 'read-only', label: 'read-only' }, { id: 'workspace-write', label: 'workspace-write' }, { id: 'danger-full-access', label: 'danger-full-access' }]}
            onChange={value => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, permissionPreset: value as DesktopToolsConfig['floatingBall']['permissionPreset'] } })} />
        </Row>
        <Row title={t('coordinateMode')} description={t('coordinateModeDescription')}>
          <Select label={t('coordinateMode')} value={draft.floatingBall.coordinateMode} disabled={busy}
            options={[{ id: 'millifraction', label: 'millifraction' }, { id: 'pixel', label: 'pixel' }]}
            onChange={value => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, coordinateMode: value as DesktopToolsConfig['floatingBall']['coordinateMode'] } })} />
        </Row>
        <Row title={t('systemPermissions')} description={t('systemPermissionsDescription')}>
          <button type="button" className={BUTTON_CLASS} onClick={() => { void checkPermissions() }}>{t('check')}</button>
        </Row>
        {(['screen', 'accessibility'] as const).map(right => <Row key={right} title={t(right === 'screen' ? 'screenPermission' : 'accessibilityPermission')} description={permissionText(right)}>
          <button type="button" className={BUTTON_CLASS} onClick={() => { void services.openSystemPermission(right).then(() => { void checkPermissions() }) }}>{t('openSettings')}</button>
        </Row>)}
      </>}

      {tab === 'screenshot' && <>
        {shortcutRow('screenshot.shortcut')}
        {shortcutRow('screenshot.longShortcut')}
        <Row title={t('visionTitle')} description={<>{t('visionDescription')}<br />{t(snapshot?.vision.state === 'ready' ? 'visionStateReady' : snapshot?.vision.state === 'missing' ? 'visionStateMissing' : snapshot?.vision.state === 'disabled' ? 'visionStateDisabled' : snapshot?.vision.state === 'tool-off' ? 'visionStateToolOff' : 'visionStateUnknown')}</>}>
          {snapshot?.vision.state !== 'ready' && snapshot?.vision.state !== 'tool-off'
            && <button type="button" disabled={installing} className={PRIMARY_BUTTON_CLASS} onClick={() => { void installVision() }}>{installing ? t('visionInstalling') : snapshot?.vision.state === 'disabled' ? t('visionEnable') : t('visionInstall')}</button>}
        </Row>
      </>}

      {tab === 'recording' && <>
        {shortcutRow('recording.shortcut')}
        <Row title={t('recordingFormat')} description={t('recordingFormatDescription')}>
          <Select label={t('recordingFormat')} value={draft.recording.format} disabled={busy}
            options={[{ id: 'mp4', label: 'MP4' }, { id: 'gif', label: 'GIF' }, { id: 'webm', label: 'WebM' }]}
            onChange={value => setDraft({ ...draft, recording: { ...draft.recording, format: value as DesktopToolsConfig['recording']['format'] } })} />
        </Row>
        <Row title={t('recordingQuality')} description={t('recordingQualityDescription')}>
          <Select label={t('recordingQuality')} value={draft.recording.quality} disabled={busy}
            options={[{ id: 'sd', label: t('qualitySd') }, { id: 'hd', label: t('qualityHd') }, { id: 'original', label: t('qualityOriginal') }]}
            onChange={value => setDraft({ ...draft, recording: { ...draft.recording, quality: value as DesktopToolsConfig['recording']['quality'] } })} />
        </Row>
        {(['systemAudio', 'microphone', 'knowledgeGraph'] as const).map(field => {
          const label = t(field === 'systemAudio' ? 'recordingSystemAudio' : field === 'microphone' ? 'recordingMicrophone' : 'recordingGraph')
          return <Row key={field} title={label} description={field === 'knowledgeGraph' ? t('recordingGraphHint') : undefined}>
            <Switch checked={draft.recording[field]} disabled={busy || (field === 'systemAudio' && snapshot?.platform === 'linux')} label={label}
              onChange={next => setDraft({ ...draft, recording: { ...draft.recording, [field]: next } })} />
          </Row>
        })}
      </>}
    </div>

    {message && <p role="status" className={message === t('saved') ? 'm-0 text-[13px] text-[var(--dsw-alias-state-success-primary)]' : 'm-0 text-[13px] text-[var(--dsw-alias-state-error-primary)]'}>{message}</p>}
    <footer className="flex flex-wrap justify-end gap-2 border-t-[0.5px] border-[var(--dsw-alias-border-l2)] pt-4">
      <button type="button" disabled={busy} className={BUTTON_CLASS} onClick={() => { void load() }}>{t('check')}</button>
      {pending && <button type="button" disabled={busy} className={BUTTON_CLASS} onClick={() => { void retry() }}>{t('retry')}</button>}
      <button type="button" disabled={busy} className={PRIMARY_BUTTON_CLASS} onClick={() => { void save() }}>{busy ? t('saving') : t('save')}</button>
    </footer>
  </section>
}
