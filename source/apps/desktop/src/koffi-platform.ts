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

/**
 * @param platform 操作系统。
 * @param arch CPU 架构。
 * @returns 对应的 Koffi 预编译包名；不支持的平台返回 undefined。
 */
export function koffiPackageName(platform: string, arch: string): string | undefined {
  return PACKAGES[`${platform}-${arch}`]
}

/**
 * 只解析当前平台 Koffi 预编译包的位置，不加载原生二进制，供诊断页使用。
 * @returns 包名与解析结果；平台不受支持时 packageName 为 undefined。
 */
export function locateKoffiPlatform(): { readonly packageName?: string; readonly path?: string; readonly error?: string } {
  const packageName = koffiPackageName(process.platform, process.arch)
  if (packageName === undefined) return {}
  try {
    return { packageName, path: createRequire(import.meta.url).resolve(packageName) }
  } catch (error: unknown) {
    return { packageName, error: error instanceof Error ? error.message : String(error) }
  }
}

/** @returns 当前受支持平台的预编译 Koffi 接口。 */
export function loadKoffiPlatform(): KoffiPlatform {
  const packageName = koffiPackageName(process.platform, process.arch)
  if (packageName === undefined) throw new Error(`Koffi 不支持当前平台: ${process.platform}-${process.arch}`)
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
