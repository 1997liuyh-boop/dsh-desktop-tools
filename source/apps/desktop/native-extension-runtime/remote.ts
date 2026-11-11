/** 桌面工具的 Client Remote 描述，由 DSH Gateway 挂载。 */
import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'
import type { TypertRemoteCodecSpec, TypertRemoteMethodSpec, TypertRemoteSpec } from '@deepseek-ai/dsh-typert-protocol'

function codec(typeSymbol: string, schema: z.ZodType): TypertRemoteCodecSpec {
  return { mode: 'strict', typeSymbol, create: () => schema }
}

function parameter(name: string, schema: z.ZodType): TypertRemoteMethodSpec['parameters'][number] {
  const value = codec(`dsh-desktop-tools#desktopTools:${name}`, schema)
  return { name, source: 'json', codec: value, strictCodec: value }
}

function method(name: string, parameters: readonly TypertRemoteMethodSpec['parameters'][number][], result: z.ZodType): TypertRemoteMethodSpec {
  return {
    service: 'desktopTools', invocation: { kind: 'direct' }, parameters,
    result: codec(`dsh-desktop-tools#desktopTools:${name}:result`, result),
  }
}

const json = z.json()
const spec = {
  package: 'dsh-desktop-tools',
  methods: {
    'desktopTools/snapshot': method('snapshot', [], json),
    'desktopTools/update': method('update', [parameter('config', json)], json),
    'desktopTools/restart': method('restart', [], json),
    'desktopTools/installVision': method('installVision', [], json),
    'desktopTools/openCapture': method('openCapture', [parameter('mode', z.enum(['image', 'video', 'long']))], z.object({ opened: z.literal(true) })),
    'desktopTools/avatar': method('avatar', [], z.object({ dataUrl: z.string().optional() })),
    'desktopTools/setAvatar': method('setAvatar', [parameter('dataUrl', z.string()), parameter('fileName', z.string())], json),
    'desktopTools/restoreAvatar': method('restoreAvatar', [], json),
    'desktopTools/systemPermissions': method('systemPermissions', [], json),
    'desktopTools/openSystemPermission': method('openSystemPermission', [parameter('right', z.enum(['screen', 'accessibility']))], json),
  },
} satisfies TypertRemoteSpec

const remote = createTypertRemoteInfo(spec, z)

export default remote
