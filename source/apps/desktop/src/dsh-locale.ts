/** 从 DSH 设置服务的描述中取出界面语言偏好（不依赖 electron，便于单测）。 */

/** 语言 id：如 zh、en、ja，或带地区的 zh-CN。 */
const LOCALE_ID = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u

/**
 * @param descriptors `settings.describe()` 的返回值。
 * @returns `ns === 'locale'` 项中的 `value.preference`；未设置、格式不对或结构不符时返回 null（表示跟随系统语言）。
 */
export function dshLocalePreference(descriptors: unknown): string | null {
  if (!Array.isArray(descriptors)) return null
  for (const item of descriptors) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (record.ns !== 'locale') continue
    const value = record.value
    const preference = typeof value === 'object' && value !== null ? (value as Record<string, unknown>).preference : undefined
    return typeof preference === 'string' && LOCALE_ID.test(preference) ? preference : null
  }
  return null
}
