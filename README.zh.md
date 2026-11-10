# dsh-desktop-runtime

[English](README.md) | 中文

仓库名称：`dsh-desktop-runtime`

仓库描述：面向官方 DSH 桌面应用的独立原生插件运行时。

## 仓库描述

`dsh-desktop-runtime` 让悬浮球、划词工具栏、截图录屏插件共用一个独立 Electron 辅助进程，并通过官方 DSH 服务访问会话。它不修改官方应用文件，也不要求旧版 Desktop 扩展 API。

## 功能

- 只有功能插件激活时才启动辅助进程。
- 负责已认证的 RPC 和流请求、激活回执、辅助进程生命周期和托盘菜单。
- 允许分别启用、停用或卸载每个功能。
- 关闭 Electron 前等待窗口和录屏清理完成。
- 使用官方会话、模型选择和按会话设置的权限预设。
- 每个待读取响应正文最多缓冲 8 MiB，超过上限时取消对应 Host 请求并向读取方报告错误。

安装和启动不会发送模型请求。悬浮球独立选择会话，不跟随官方主窗口当前会话。

## 安装

1. 使用满足 `>=0.2.2-rc.1 <0.3.0-0` 的 DSH Desktop 版本。
2. 在 DSH 插件管理中选择“添加插件”，填写 `https://github.com/1997liuyh-boop/dsh-desktop-runtime.git`，并选择精确标签 `0.1.1`。
3. 启用 `dsh-desktop-runtime`，再安装各功能插件的 `v0.2.1` 标签。
4. 包管理器请求构建授权时允许 Electron 安装脚本；DSH 提示时重启 Host。

`electronExecutable` 配置可以指定本机已安装且兼容 Electron 44 的可执行文件。停用或替换运行时会保留原 profile 目录中的数据。提交 Git 代码不会刷新已安装副本；升级时安装精确标签或归档。

## 构建

使用 Node 24.9 或更新版本运行 `npm install` 和 `npm run build`。仓库包含源码和预构建的 `dist` 入口。构建和协议检查不代表 GUI 已验收；仍需在每个目标系统实际操作划词、截图和录屏。

## 来源

本仓库属于 [1997liuyh-boop/deepseek-harness](https://github.com/1997liuyh-boop/deepseek-harness)，并保留 DeepSeek MIT 版权声明。

## 限制

原生功能包具有本机应用权限。定制分支的坐标模式和后台代码代理配置不可用。未配置 `electronExecutable` 时，首次安装会下载对应系统的 Electron。GUI 行为仍取决于主机系统及其截图、辅助功能和权限设置。

## 版本

本文档对应 `0.1.1` 发布版本，可复现源码为本仓库的 `0.1.1` Git 标签。
