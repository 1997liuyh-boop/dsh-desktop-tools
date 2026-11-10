/** Koffi 平台二进制提供的划词钩子所需最小接口。 */
import { createRequire } from 'node:module'

export type KoffiFunction = (...args: unknown[]) => unknown

export interface KoffiLibrary {
  func(declaration: string): KoffiFunction
}
export interface KoffiPlatform {
  struct(name: string, fields: Readonly<Record<string, unknown>>): unknown
  proto(declaration: string): unknown
  pointer(type: unknown): unknown
  sizeof(type: unknown): number
  load(filename: string): KoffiLibrary
  register(callback: KoffiFunction, type: unknown): unknown
  unregister(callback: unknown): void
  decode(value: unknown, type: unknown): unknown
}

interface KoffiNativePlatform extends Omit<KoffiPlatform, 'sizeof'> {
  type(type: unknown): { size: number }
}

const PACKAGES: Readonly<Record<string, string>> = {
  'darwin-arm64': '@koromix/koffi-darwin-arm64',
  'darwin-x64': '@koromix/koffi-darwin-x64',
  'win32-arm64': '@koromix/koffi-win32-arm64',
  'win32-x64': '@koromix/koffi-win32-x64',
}

function isKoffiPlatform(value: unknown): value is KoffiNativePlatform {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return ['struct', 'proto', 'pointer', 'type', 'load', 'register', 'unregister', 'decode']
    .every(name => typeof record[name] === 'function')
}

/** @returns 当前受支持平台的预编译 Koffi 接口。 */
export function loadKoffiPlatform(): KoffiPlatform {
  const key = `${process.platform}-${process.arch}`
  const packageName = PACKAGES[key]
  if (packageName === undefined) throw new Error(`Koffi 不支持当前平台: ${key}`)
  const value: unknown = createRequire(import.meta.url)(packageName)
  if (!isKoffiPlatform(value)) throw new Error(`Koffi 平台包接口无效: ${packageName}`)
  return {
    struct: value.struct,
    proto: value.proto,
    pointer: value.pointer,
    sizeof: type => value.type(type).size,
    load: value.load,
    register: value.register,
    unregister: value.unregister,
    decode: value.decode,
  }
}
