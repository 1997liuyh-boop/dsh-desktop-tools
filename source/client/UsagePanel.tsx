/** 余额与本机估算分开展示，单价仅对保存后的消息生效。 */
import { useEffect, useRef, useState } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopToolsConfig, DesktopUsageTotal, DesktopWidgetSnapshot } from '../apps/desktop/src/desktop-tools-types.ts'
import type { DesktopToolsSettingsServices, ModelCatalog } from './DesktopToolsSettings.tsx'
import type { en } from './locales.ts'

interface Props {
  t(key: keyof typeof en): string
  services: Pick<DesktopToolsSettingsServices, 'widgetSnapshot'>
  value: DesktopToolsConfig['accounting']
  onChange(value: DesktopToolsConfig['accounting']): void
  disabled: boolean
  catalog: ModelCatalog | undefined
  buttonClass: string
  inputClass: string
}

export function UsagePanel({ t, services, value, onChange, disabled, catalog, buttonClass, inputClass }: Props) {
  const [snapshot, setSnapshot] = useState<DesktopWidgetSnapshot>()
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mounted = useRef(false)
  const flight = useRef(false)
  const refresh = async (force = false): Promise<void> => {
    if (flight.current) return
    flight.current = true
    setRefreshing(true)
    try {
      const result = await services.widgetSnapshot(force)
      if (!mounted.current) return
      setError(!result.ok)
      if (result.ok) setSnapshot(result.value)
    } catch { if (mounted.current) setError(true) }
    finally { flight.current = false; if (mounted.current) setRefreshing(false) }
  }
  useEffect(() => {
    mounted.current = true
    void refresh()
    const timer = setInterval(() => { void refresh() }, 5000)
    return () => { mounted.current = false; clearInterval(timer) }
  }, [services])
  const metrics = (total: DesktopUsageTotal) => <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2 text-[13px] sm:grid-cols-3">
    {(['input', 'cacheRead', 'cacheWrite', 'output', 'cost', 'unpriced'] as const).map(key => <div key={key}>
      <dt className="text-[var(--dsw-alias-label-tertiary)]">{t(key === 'input' ? 'tokenInput' : key === 'cacheRead' ? 'tokenCache' : key === 'cacheWrite' ? 'tokenCacheWrite' : key === 'output' ? 'tokenOutput' : key === 'cost' ? 'estimatedCost' : 'unpricedTokens')}</dt>
      <dd className="m-0 tabular-nums">{key === 'cost' ? `¥${total[key].toFixed(4)}` : total[key].toLocaleString()}</dd>
    </div>)}
  </dl>
  return <div className="flex min-w-0 flex-col gap-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Switch checked={value.enabled} disabled={disabled} label={t('accountingEnabled')} onChange={enabled => onChange({ ...value, enabled })} />
      <button type="button" className={buttonClass} disabled={refreshing || !value.enabled} onClick={() => { void refresh(true) }}>{refreshing ? t('loading') : t('refreshBalance')}</button>
    </div>
    <p className="m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]">{t('accountingHint')}</p>
    {(error || snapshot?.storageError) && <p role="alert" className="m-0 text-sm text-[var(--dsw-alias-state-error-primary)]">{t(snapshot?.storageError ? 'usageStorageError' : 'usageRefreshError')}</p>}
    {!snapshot && !error && <p role="status" className="m-0 text-sm">{t('loading')}</p>}
    {snapshot && <>
      <section className="rounded-xl border border-[var(--dsw-alias-border-l2)] p-4">
        <h3 className="mb-2 mt-0 text-sm font-medium">{t('actualBalance')}</h3>
        {snapshot.balance.state === 'ready'
          ? <><p className="m-0 text-xl tabular-nums">{snapshot.balance.wallets?.map(wallet => `${wallet.currency} ${wallet.balance.toFixed(4)}`).join(' · ')}</p>
            <p className="mb-0 mt-1 text-xs text-[var(--dsw-alias-label-tertiary)]">{t(snapshot.balance.source === 'api' ? 'balanceApi' : 'balanceAccount')} · {t('updatedAt')} {snapshot.balance.updatedAt ? new Date(snapshot.balance.updatedAt).toLocaleString() : '—'}</p></>
          : <p className="m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]">{t(snapshot.balance.state === 'error' ? 'balanceError' : 'balanceUnavailable')}</p>}
      </section>
      {[['todayUsage', snapshot.today], ['totalUsage', snapshot.total]].map(([label, total]) => <section key={String(label)}>
        <h3 className="mb-2 mt-0 text-sm font-medium">{t(label as 'todayUsage' | 'totalUsage')}</h3>{metrics(total as DesktopUsageTotal)}
      </section>)}
    </>}
    <label className="flex flex-wrap items-center justify-between gap-3 text-sm">{t('dailyBudget')}
      <input className={inputClass} type="number" min={0} max={1_000_000} step="any" disabled={disabled} value={value.dailyBudget}
        onChange={event => onChange({ ...value, dailyBudget: Number(event.currentTarget.value) })} />
    </label>
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="m-0 text-sm font-medium">{t('tokenRates')}</h3>
      <p className="m-0 text-[13px] text-[var(--dsw-alias-label-tertiary)]">{t('ratesHint')}</p>
      {value.rates.map((rate, index) => <div key={index} className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-[var(--dsw-alias-border-l2)] p-3 sm:grid-cols-3">
        {(['provider', 'model', 'input', 'cacheRead', 'cacheWrite', 'output'] as const).map(field => <label key={field} className="flex min-w-0 flex-col gap-1 text-xs">
          {t(field === 'input' ? 'tokenInput' : field === 'cacheRead' ? 'tokenCache' : field === 'cacheWrite' ? 'tokenCacheWrite' : field === 'output' ? 'tokenOutput' : field)}
          <input className={`${inputClass} !w-full !min-w-0`} disabled={disabled} type={field === 'model' || field === 'provider' ? 'text' : 'number'}
            min={0} max={1_000_000} step="any" maxLength={200} value={rate[field] ?? ''} list={field === 'provider' ? 'usage-providers' : field === 'model' ? `usage-models-${index}` : undefined}
            onChange={event => onChange({ ...value, rates: value.rates.map((item, position) => position === index
              ? { ...item, [field]: field === 'provider' || field === 'model' ? event.currentTarget.value : field === 'cacheWrite' && event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) } : item) })} />
        </label>)}
        <datalist id={`usage-models-${index}`}>{catalog?.groups.find(group => group.id === rate.provider)?.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist>
        <button type="button" className={`${buttonClass} self-end`} disabled={disabled} onClick={() => onChange({ ...value, rates: value.rates.filter((_, position) => position !== index) })}>{t('removeRate')}</button>
      </div>)}
      <datalist id="usage-providers">{catalog?.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</datalist>
      <button type="button" className={`${buttonClass} w-fit`} disabled={disabled || value.rates.length >= 100}
        onClick={() => onChange({ ...value, rates: [...value.rates, { provider: '', model: '', input: 0, cacheRead: 0, output: 0 }] })}>{t('addRate')}</button>
    </section>
    {!!snapshot?.days.length && <details><summary className="cursor-pointer text-sm">{t('usageDays')}</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[13px] tabular-nums"><thead><tr>
        <th className="py-2 font-medium">{t('usageDate')}</th><th className="font-medium">{t('tokenInput')}</th><th className="font-medium">{t('tokenCache')}</th><th className="font-medium">{t('tokenOutput')}</th><th className="font-medium">{t('estimatedCost')}</th>
      </tr></thead><tbody>{snapshot.days.map(day => <tr key={day.day}><td className="py-1">{day.day}</td><td>{day.input.toLocaleString()}</td><td>{day.cacheRead.toLocaleString()}</td><td>{day.output.toLocaleString()}</td><td>¥{day.cost.toFixed(4)}</td></tr>)}</tbody></table></div>
    </details>}
  </div>
}
