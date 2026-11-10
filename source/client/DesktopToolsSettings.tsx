/** 桌面工具的分区设置和功能运行状态。 */
import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { DesktopModelSelection, DesktopToolsConfig, DesktopToolsSnapshot, DesktopToolsUpdateResult } from '../apps/desktop/src/desktop-tools-types.ts'
import type { en } from './locales.ts'
import type { ShortcutBinding, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

type Copy = (key: keyof typeof en) => string
type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }
export interface DesktopToolsSettingsServices {
  snapshot(): Promise<RemoteResult<DesktopToolsSnapshot>>
  update(config: DesktopToolsConfig): Promise<RemoteResult<DesktopToolsUpdateResult>>
  restart(): Promise<RemoteResult<DesktopToolsSnapshot>>
  avatar(): Promise<RemoteResult<{ readonly dataUrl?: string }>>
  setAvatar(dataUrl: string, fileName: string): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean }>>
  restoreAvatar(): Promise<RemoteResult<{ readonly saved: boolean; readonly applied: boolean }>>
  systemPermissions(): Promise<RemoteResult<{ readonly screen?: boolean; readonly accessibility?: boolean }>>
  openSystemPermission(right: 'screen' | 'accessibility'): Promise<RemoteResult<unknown>>
  editShortcut(id: ShortcutCommandId, binding: ShortcutBinding): Promise<string | undefined>
  shortcutLabel(id: ShortcutCommandId): string
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

function ModelFields({ value, disabled, t, onChange }: {
  value: DesktopModelSelection
  disabled: boolean
  t: Copy
  onChange: (value: DesktopModelSelection) => void
}): ReactNode {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-3">
    {(['provider', 'model', 'reasoningEffort'] as const).map((field) => <label className="grid min-w-0 gap-1 text-sm" key={field}>
      <span className="text-[var(--dsw-alias-label-tertiary)]">{t(field === 'reasoningEffort' ? 'effort' : field)}</span>
      <input className="min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2 text-[var(--dsw-alias-label-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dsw-alias-brand-primary)] disabled:opacity-60"
        disabled={disabled} value={value[field] ?? ''} onChange={event => onChange({ ...value, [field]: event.currentTarget.value })} />
    </label>)}
  </div>
}

export function DesktopToolsSettings({ t, services }: DesktopToolsSettingsProps): ReactNode {
  const [tab, setTab] = useState<Tab>('selection')
  const [snapshot, setSnapshot] = useState<DesktopToolsSnapshot>()
  const [draft, setDraft] = useState<DesktopToolsConfig>()
  const [avatar, setAvatar] = useState<string>()
  const [permissions, setPermissions] = useState<{ readonly screen?: boolean; readonly accessibility?: boolean }>()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [capturing, setCapturing] = useState<'screenshot' | 'recording'>()
  const [shortcutRevision, setShortcutRevision] = useState(0)

  const load = async (): Promise<void> => {
    const result = await services.snapshot()
    if (!result.ok) { setMessage(t('loadError')); return }
    setSnapshot(result.value)
    setDraft(result.value.config)
    setMessage('')
    const image = await services.avatar()
    if (image.ok) setAvatar(image.value.dataUrl)
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
    else if (feature === 'screenshot') setDraft({ ...draft, screenshot: { enabled } })
    else setDraft({ ...draft, recording: { enabled } })
  }

  const active = snapshot?.features[tab === 'floating' ? 'floatingBall' : tab === 'selection' ? 'selection' : 'capture']
  const enabled = draft === undefined ? false : tab === 'selection' ? draft.selection.enabled
    : tab === 'floating' ? draft.floatingBall.enabled : tab === 'screenshot' ? draft.screenshot.enabled : draft.recording.enabled
  const captureShortcut = async (event: KeyboardEvent): Promise<void> => {
    if (event.key === 'Escape') { event.preventDefault(); setCapturing(undefined); return }
    if (/^(Control|Alt|Shift|Meta)$/u.test(event.key)) return
    event.preventDefault()
    const id = capturing === 'screenshot' ? 'desktop-tools.screenshot' : 'desktop-tools.recording'
    const modifiers: ShortcutBinding['modifiers'][number][] = []
    if (event.ctrlKey || event.metaKey) modifiers.push('primary')
    if (event.altKey) modifiers.push('alt')
    if (event.shiftKey) modifiers.push('shift')
    const error = await services.editShortcut(id as ShortcutCommandId, { code: event.code, modifiers })
    setMessage(error ?? '')
    if (error === undefined) setShortcutRevision(value => value + 1)
    setCapturing(undefined)
  }

  useEffect(() => {
    if (capturing === undefined) return
    const listener = (event: KeyboardEvent): void => { void captureShortcut(event) }
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
    {message ? <p role="alert" className="text-sm text-[var(--dsw-alias-state-error-primary)]">{message}</p> : <p role="status" className="text-sm text-[var(--dsw-alias-label-tertiary)]">…</p>}
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
      </div>
      {tab === 'selection' && <>
        <label className="grid gap-1 text-sm"><span>{t('language')}</span><input className="min-w-0 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.selection.targetLanguage} onChange={event => setDraft({ ...draft, selection: { ...draft.selection, targetLanguage: event.currentTarget.value } })} /></label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.selection.compatibilityCopy} onChange={event => setDraft({ ...draft, selection: { ...draft.selection, compatibilityCopy: event.currentTarget.checked } })} />{t('compatibilityCopy')}</label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.selection.model !== undefined} onChange={event => setSelectionModelEnabled(event.currentTarget.checked)} />{t('customModel')}</label>
        {draft.selection.model === undefined ? <p className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t('followSession')}</p>
          : <ModelFields value={draft.selection.model} disabled={busy} t={t} onChange={value => setModel('selection', value)} />}
      </>}
      {tab === 'floating' && <>
        <div className="flex flex-wrap items-center gap-3">{avatar === undefined ? <span aria-hidden="true" className="size-12 rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)]" />
          : <img src={avatar} alt="" className="size-12 rounded border border-[var(--dsw-alias-border-l2)] object-cover" />}
          <label className="cursor-pointer rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[var(--dsw-alias-brand-primary)]">{t('chooseAvatar')}<input className="sr-only" type="file" accept="image/gif,image/png,image/webp" onChange={uploadAvatar} /></label>
          <button type="button" className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm" onClick={() => { void services.restoreAvatar().then(result => { if (result.ok) void load() }) }}>{t('restoreAvatar')}</button>
        </div>
        <h3 className="text-sm font-medium">{t('conversationModel')}</h3><ModelFields value={draft.floatingBall.conversationModel} disabled={busy} t={t} onChange={value => setModel('conversationModel', value)} />
        <h3 className="text-sm font-medium">{t('backgroundModel')}</h3><ModelFields value={draft.floatingBall.backgroundModel} disabled={busy} t={t} onChange={value => setModel('backgroundModel', value)} />
        <label className="grid gap-1 text-sm"><span>{t('permissionPreset')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.floatingBall.permissionPreset} onChange={event => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, permissionPreset: event.currentTarget.value as DesktopToolsConfig['floatingBall']['permissionPreset'] } })}><option value="read-only">read-only</option><option value="workspace-write">workspace-write</option><option value="danger-full-access">danger-full-access</option></select></label>
        <label className="grid gap-1 text-sm"><span>{t('coordinateMode')}</span><select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-module-platform)] px-3 py-2" value={draft.floatingBall.coordinateMode} onChange={event => setDraft({ ...draft, floatingBall: { ...draft.floatingBall, coordinateMode: event.currentTarget.value as DesktopToolsConfig['floatingBall']['coordinateMode'] } })}><option value="millifraction">millifraction</option><option value="pixel">pixel</option></select></label>
        <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{t('systemPermissions')}</h3><button type="button" className="text-sm text-[var(--dsw-alias-brand-primary)]" onClick={() => { void checkPermissions() }}>{t('check')}</button></div>
          {(['screen', 'accessibility'] as const).map(right => <div key={right} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{t(right === 'screen' ? 'screenPermission' : 'accessibilityPermission')}</span><span>{permissions?.[right] === true ? t('permissionGranted') : permissions?.[right] === false ? t('permissionDenied') : t('permissionUnknown')}</span><button type="button" className="text-[var(--dsw-alias-brand-primary)]" onClick={() => { void services.openSystemPermission(right).then(() => { void checkPermissions() }) }}>{t('openSettings')}</button></div>)}
        </div>
      </>}
      {(tab === 'screenshot' || tab === 'recording') && <div className="grid gap-2"><span className="text-sm text-[var(--dsw-alias-label-tertiary)]">{t('shortcut')}</span><div className="flex flex-wrap items-center gap-2"><kbd key={shortcutRevision} className="rounded border border-[var(--dsw-alias-border-l2)] px-2 py-1 text-sm">{services.shortcutLabel(tab === 'screenshot' ? 'desktop-tools.screenshot' as ShortcutCommandId : 'desktop-tools.recording' as ShortcutCommandId)}</kbd><button type="button" className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-brand-primary)]" onClick={() => setCapturing(tab)}>{capturing === tab ? t('recordingShortcut') : t('recordShortcut')}</button></div></div>}
    </div>
    {message && <p role="status" className={message === t('saved') ? 'text-sm text-[var(--dsw-alias-state-success-primary)]' : 'text-sm text-[var(--dsw-alias-state-error-primary)]'}>{message}</p>}
    <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--dsw-alias-border-l2)] pt-3"><button type="button" disabled={busy} className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50" onClick={() => { void load() }}>{t('check')}</button>{pending && <button type="button" disabled={busy} className="rounded border border-[var(--dsw-alias-border-l2)] px-3 py-2 text-sm disabled:opacity-50" onClick={() => { void retry() }}>{t('retry')}</button>}<button type="button" disabled={busy} className="rounded bg-[var(--dsw-alias-brand-primary)] px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => { void save() }}>{busy ? t('saving') : t('save')}</button></footer>
  </section>
}
