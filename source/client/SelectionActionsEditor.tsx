/** 设置页「划词工具栏」中的按钮顺序、显示开关与自定义动作编辑。 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopSelectionCustomAction } from '../apps/desktop/src/desktop-tools-types.ts'
import type { en } from './locales.ts'

type Copy = (key: keyof typeof en) => string

/** 与 Host 端校验一致的上限。 */
const LIMITS = { count: 10, name: 20, prompt: 4000 } as const
const BUILTIN_IDS = ['search', 'translate', 'note', 'wechat', 'explain', 'send-to-agent'] as const
const BUILTIN_LABELS: Readonly<Record<typeof BUILTIN_IDS[number], keyof typeof en>> = {
  'search': 'itemSearch', 'translate': 'itemTranslate', 'note': 'itemNote', 'wechat': 'itemWechat', 'explain': 'itemExplain', 'send-to-agent': 'itemSendToAgent',
}

/** 编辑器的取值：自定义动作与工具栏按钮顺序。 */
export interface SelectionActionsValue {
  readonly customActions: readonly DesktopSelectionCustomAction[]
  readonly toolbarItems: readonly string[]
}

/** 编辑器属性。 */
export interface SelectionActionsEditorProps {
  readonly t: Copy
  readonly value: SelectionActionsValue
  readonly disabled: boolean
  readonly onChange: (value: SelectionActionsValue) => void
  readonly rowClass: string
  readonly buttonClass: string
  readonly primaryButtonClass: string
  readonly inputClass: string
}

interface Draft { readonly id?: string; readonly name: string; readonly prompt: string }

/** @returns 新自定义动作的 id，满足 `[a-z0-9-]{1,32}`。 */
function newActionId(existing: readonly DesktopSelectionCustomAction[]): string {
  for (;;) {
    const id = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    if (!existing.some(action => action.id === id)) return id
  }
}

/** 设置页中的划词按钮与自定义动作编辑器。 */
export function SelectionActionsEditor({ t, value, disabled, onChange, rowClass, buttonClass, primaryButtonClass, inputClass }: SelectionActionsEditorProps): ReactNode {
  const [draft, setDraft] = useState<Draft>()
  const [error, setError] = useState('')
  const custom = new Map(value.customActions.map(action => [`custom:${action.id}`, action]))
  const labelOf = (id: string): string => custom.get(id)?.name ?? (id in BUILTIN_LABELS ? t(BUILTIN_LABELS[id as typeof BUILTIN_IDS[number]]) : id)
  // 先列出显示中的按钮（按顺序），再列出隐藏的按钮。
  const hidden = [...BUILTIN_IDS, ...value.customActions.map(action => `custom:${action.id}`)].filter(id => !value.toolbarItems.includes(id))
  const rows = [...value.toolbarItems.map(id => ({ id, visible: true })), ...hidden.map(id => ({ id, visible: false }))]

  const setVisible = (id: string, visible: boolean): void => {
    onChange({ ...value, toolbarItems: visible ? [...value.toolbarItems, id] : value.toolbarItems.filter(item => item !== id) })
  }
  const move = (id: string, offset: -1 | 1): void => {
    const items = [...value.toolbarItems]
    const index = items.indexOf(id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target]!, items[index]!]
    onChange({ ...value, toolbarItems: items })
  }
  const remove = (action: DesktopSelectionCustomAction): void => {
    onChange({
      customActions: value.customActions.filter(item => item.id !== action.id),
      toolbarItems: value.toolbarItems.filter(item => item !== `custom:${action.id}`),
    })
  }
  const commit = (): void => {
    if (draft === undefined) return
    const name = draft.name.trim()
    const prompt = draft.prompt.trim()
    if (name === '' || name.length > LIMITS.name || prompt === '' || prompt.length > LIMITS.prompt) { setError(t('actionInvalid')); return }
    if (draft.id !== undefined) {
      onChange({ ...value, customActions: value.customActions.map(item => item.id === draft.id ? { id: item.id, name, prompt } : item) })
    } else {
      const id = newActionId(value.customActions)
      // 新动作默认显示在工具栏末尾。
      onChange({ customActions: [...value.customActions, { id, name, prompt }], toolbarItems: [...value.toolbarItems, `custom:${id}`] })
    }
    setDraft(undefined)
    setError('')
  }

  return <>
    <div className={rowClass}>
      <div className="flex min-w-[220px] flex-1 basis-[220px] flex-col gap-1 pr-0 sm:pr-12">
        <div className="text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]">{t('toolbarItems')}</div>
        <div className="text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]">{t('toolbarItemsDescription')}</div>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={buttonClass} disabled={disabled || draft !== undefined || value.customActions.length >= LIMITS.count}
          title={value.customActions.length >= LIMITS.count ? t('actionLimit') : undefined}
          onClick={() => { setDraft({ name: '', prompt: '' }); setError('') }}>{t('addAction')}</button>
      </div>
    </div>

    {draft !== undefined && <div className={`${rowClass} flex-col items-stretch`}>
      <label className="flex flex-col gap-1 text-sm">
        {t('actionName')}
        <input className={inputClass} maxLength={LIMITS.name} value={draft.name} disabled={disabled}
          onChange={event => setDraft({ ...draft, name: event.currentTarget.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t('actionPrompt')}
        <textarea className={`${inputClass} h-auto min-h-[96px] py-2`} maxLength={LIMITS.prompt} value={draft.prompt} disabled={disabled}
          placeholder={t('actionPromptPlaceholder')} onChange={event => setDraft({ ...draft, prompt: event.currentTarget.value })} />
        <span className="text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]">{t('actionPromptHint')}</span>
      </label>
      {error && <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={() => { setDraft(undefined); setError('') }}>{t('actionCancel')}</button>
        <button type="button" className={primaryButtonClass} disabled={disabled} onClick={commit}>{t('actionConfirm')}</button>
      </div>
    </div>}

    {rows.map(({ id, visible }, index) => {
      const action = custom.get(id)
      const label = labelOf(id)
      return <div key={id} className={rowClass}>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <div className="text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]">{label}</div>
          {action !== undefined && <div className="truncate text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]" title={action.prompt}>{action.prompt}</div>}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {visible && <>
            <button type="button" className={buttonClass} aria-label={`${t('moveUp')} ${label}`} disabled={disabled || index === 0} onClick={() => move(id, -1)}>↑</button>
            <button type="button" className={buttonClass} aria-label={`${t('moveDown')} ${label}`} disabled={disabled || index >= value.toolbarItems.length - 1} onClick={() => move(id, 1)}>↓</button>
          </>}
          {action !== undefined && <>
            <button type="button" className={buttonClass} disabled={disabled || draft !== undefined}
              onClick={() => { setDraft({ id: action.id, name: action.name, prompt: action.prompt }); setError('') }}>{t('editAction')}</button>
            <button type="button" className={buttonClass} disabled={disabled} onClick={() => remove(action)}>{t('deleteAction')}</button>
          </>}
          <Switch checked={visible} disabled={disabled} label={label} onChange={next => setVisible(id, next)} />
        </div>
      </div>
    })}
  </>
}
