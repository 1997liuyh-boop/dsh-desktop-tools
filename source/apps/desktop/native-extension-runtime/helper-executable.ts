/** 桌面工具辅助进程的可执行文件选择（独立模块，便于单测）。 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * 选出启动辅助进程的 Electron 可执行文件。
 * 打包安装的 DSH（如 D:\deepseek-harness\DeepSeek Harness.exe）同级 resources 下有 app.asar，
 * 这类可执行文件总是启动自带应用、忽略脚本参数，不能用来跑 helper.js；此时改用独立 Electron：
 * 依次尝试 DSH_DESKTOP_TOOLS_ELECTRON 环境变量与 $DSH_HOME/electron（dsh-pet 等插件共用的落地目录）。
 * 开发模式下 DSH 由裸 electron.exe 启动，直接复用 process.execPath。
 * @param configured 插件设置中显式指定的路径。
 * @param execPath 当前宿主进程的可执行文件。
 * @param env 环境变量。
 * @param exists 文件存在判断（测试可替换）。
 * @returns 可用的可执行文件路径。
 */
export function resolveHelperExecutable(configured: string | undefined, execPath: string, env: NodeJS.ProcessEnv,
  exists: (path: string) => boolean = existsSync): string {
  if (configured) return configured
  const packaged = exists(join(dirname(execPath), 'resources', 'app.asar'))
  if (!packaged) return execPath
  const binary = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? join('Electron.app', 'Contents', 'MacOS', 'Electron') : 'electron'
  const candidates = [env.DSH_DESKTOP_TOOLS_ELECTRON, join(env.DSH_HOME ?? join(homedir(), '.dsh'), 'electron', binary)]
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
  const found = candidates.find(item => exists(item))
  if (found) return found
  throw new Error('当前 DSH 为打包安装，不能直接用宿主程序启动桌面工具辅助进程；请在插件设置 electronExecutable 中填写独立 Electron 的路径，'
    + '或设置环境变量 DSH_DESKTOP_TOOLS_ELECTRON。已尝试：' + candidates.join('、'))
}
