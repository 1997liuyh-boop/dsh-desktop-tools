/** 设置页「诊断」标签：逐项展示运行环境检查结果，提供修复入口与诊断报告复制。 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DesktopDiagnosticFix, DesktopDiagnosticId, DesktopDiagnosticItem, DesktopDiagnostics, DesktopDiagnosticStatus } from '../apps/desktop/src/desktop-tools-types.ts'
import { fillDiagnosticText, formatDiagnosticReport } from '../apps/desktop/src/desktop-diagnostics.ts'
import type { en } from './locales.ts'

type Copy = (key: keyof typeof en) => string
type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown }

/** 诊断面板用到的远程能力。 */
export interface DiagnosticsServices {
  diagnose(): Promise<RemoteResult<DesktopDiagnostics>>
  restart(): Promise<RemoteResult<unknown>>
  installVision(): Promise<RemoteResult<{ readonly restartRequired: boolean }>>
  openSystemPermission(right: 'screen' | 'accessibility'): Promise<RemoteResult<unknown>>
}

/** 诊断面板属性。 */
export interface DiagnosticsPanelProps {
  /** 设置页文案。 */
  readonly t: Copy
  /** 远程服务。 */
  readonly services: DiagnosticsServices
  /** 修复动作执行后通知设置页刷新运行状态。 */
  readonly onChanged: () => void
  /** 与设置页其他按钮一致的样式。 */
  readonly buttonClass: string
  readonly primaryButtonClass: string
  readonly rowClass: string
}

/** 检查项标题对应的文案键。 */
const TITLES: Readonly<Record<DesktopDiagnosticId, keyof typeof en>> = {
  'config': 'diagConfig', 'electron': 'diagElectron', 'electron-version': 'diagElectronVersion', 'native-module': 'diagNative',
  'runtime': 'diagRuntime', 'feature-selection': 'selection', 'feature-floatingBall': 'floating', 'feature-capture': 'diagCapture',
  'shortcuts': 'diagShortcuts', 'vision': 'diagVision', 'permission-screen': 'screenPermission', 'permission-accessibility': 'accessibilityPermission',
}

const STATUS_LABELS: Readonly<Record<DesktopDiagnosticStatus, keyof typeof en>> = { ok: 'diagOk', warn: 'diagWarn', error: 'diagError', skip: 'diagSkip' }

/** 状态圆点与文字颜色，沿用 DSH 设置页的状态色变量。 */
const STATUS_COLORS: Readonly<Record<DesktopDiagnosticStatus, string>> = {
  ok: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warning-primary, #d97706)',
  error: 'var(--dsw-alias-state-error-primary)',
  skip: 'var(--dsw-alias-label-tertiary)',
}

const FIX_LABELS: Readonly<Record<DesktopDiagnosticFix, keyof typeof en>> = {
  'restart': 'diagFixRestart', 'install-vision': 'diagFixVision', 'open-screen': 'openSettings', 'open-accessibility': 'openSettings',
}

/** 设置页「诊断」标签内容。 */
export function DiagnosticsPanel({ t, services, onChanged, buttonClass, primaryButtonClass, rowClass }: DiagnosticsPanelProps): ReactNode {
  const [result, setResult] = useState<DesktopDiagnostics>()
  const [running, setRunning] = useState(false)
  const [fixing, setFixing] = useState<DesktopDiagnosticFix>()
  const [notice, setNotice] = useState('')

  const translate = (key: string): string => t(key as keyof typeof en)

  const run = async (): Promise<void> => {
    setRunning(true)
    setNotice('')
    try {
      const response = await services.diagnose()
      if (response.ok) setResult(response.value)
      else setNotice(t('diagFailed'))
    } catch {
      setNotice(t('diagFailed'))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { void run() }, [])

  const fix = async (action: DesktopDiagnosticFix): Promise<void> => {
    if (fixing !== undefined) return
    setFixing(action)
    setNotice('')
    try {
      if (action === 'restart') await services.restart()
      else if (action === 'install-vision') {
        const response = await services.installVision()
        setNotice(!response.ok ? t('visionInstallFailed') : response.value.restartRequired ? t('visionRestart') : t('visionReady'))
      } else await services.openSystemPermission(action === 'open-screen' ? 'screen' : 'accessibility')
    } finally {
      setFixing(undefined)
    }
    onChanged()
    await run()
  }

  const copyReport = async (): Promise<void> => {
    if (result === undefined) return
    try {
      await navigator.clipboard.writeText(formatDiagnosticReport(result, translate))
      setNotice(t('diagCopied'))
    } catch {
      setNotice(t('diagCopyFailed'))
    }
  }

  const row = (item: DesktopDiagnosticItem): ReactNode => <div key={item.id} className={rowClass}>
    <div className="flex min-w-[220px] flex-1 basis-[220px] flex-col gap-1 pr-0 sm:pr-12">
      <div className="flex items-center gap-2 text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]">
        <span aria-hidden="true" className="inline-block size-2 flex-none rounded-full" style={{ background: STATUS_COLORS[item.status] }} />
        {t(TITLES[item.id])}
        <span className="text-xs" style={{ color: STATUS_COLORS[item.status] }}>{t(STATUS_LABELS[item.status])}</span>
      </div>
      <div className="whitespace-pre-line break-all text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]">{fillDiagnosticText(translate(item.message), item.values)}</div>
    </div>
    {item.fix !== undefined && <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
      <button type="button" className={buttonClass} disabled={fixing !== undefined || running} onClick={() => { void fix(item.fix!) }}>
        {fixing === item.fix ? t('diagFixing') : t(FIX_LABELS[item.fix])}
      </button>
    </div>}
  </div>

  const counts = result?.items.reduce((total, item) => ({ ...total, [item.status]: total[item.status] + 1 }), { ok: 0, warn: 0, error: 0, skip: 0 })

  return <div className="flex min-w-0 flex-col">
    <div className={rowClass}>
      <div className="flex min-w-[220px] flex-1 basis-[220px] flex-col gap-1 pr-0 sm:pr-12">
        <div className="text-sm leading-[22px] text-[var(--dsw-alias-label-primary)]">{t('diagSummary')}</div>
        <div className="text-xs leading-[18px] text-[var(--dsw-alias-label-tertiary)]">
          {running ? t('diagRunning') : counts === undefined ? t('diagDescription')
            : fillDiagnosticText(t('diagCounts'), { error: String(counts.error), warn: String(counts.warn), ok: String(counts.ok) })}
        </div>
        {notice && <div role="status" className="text-xs leading-[18px] text-[var(--dsw-alias-label-secondary,var(--dsw-alias-label-tertiary))]">{notice}</div>}
      </div>
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
        <button type="button" className={buttonClass} disabled={running || result === undefined} onClick={() => { void copyReport() }}>{t('diagCopy')}</button>
        <button type="button" className={primaryButtonClass} disabled={running || fixing !== undefined} onClick={() => { void run() }}>{running ? t('diagRunning') : t('diagRun')}</button>
      </div>
    </div>
    {result?.items.map(row)}
  </div>
}
