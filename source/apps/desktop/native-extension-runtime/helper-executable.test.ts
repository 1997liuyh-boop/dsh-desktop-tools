import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { resolveHelperExecutable } from './helper-executable.ts'

const installed = join('D:', 'deepseek-harness', 'DeepSeek Harness.exe')
const asar = join('D:', 'deepseek-harness', 'resources', 'app.asar')
const shared = join('C:', 'home', '.dsh', 'electron', process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? join('Electron.app', 'Contents', 'MacOS', 'Electron') : 'electron')

test('显式配置优先', () => {
  assert.equal(resolveHelperExecutable('X:/custom/electron.exe', installed, {}, () => false), 'X:/custom/electron.exe')
})

test('开发模式（无 app.asar）复用宿主可执行文件', () => {
  const dev = join('D:', 'repo', 'node_modules', 'electron', 'dist', 'electron.exe')
  assert.equal(resolveHelperExecutable(undefined, dev, {}, () => false), dev)
})

test('打包安装时改用 DSH_HOME 下共用的独立 Electron', () => {
  const files = new Set([asar, shared])
  assert.equal(resolveHelperExecutable(undefined, installed, { DSH_HOME: join('C:', 'home', '.dsh') }, path => files.has(path)), shared)
})

test('打包安装且找不到独立 Electron 时给出明确错误', () => {
  assert.throws(() => resolveHelperExecutable(undefined, installed, { DSH_HOME: join('C:', 'home', '.dsh') }, path => path === asar), /electronExecutable/)
})
