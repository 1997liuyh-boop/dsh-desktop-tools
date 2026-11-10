# dsh-desktop-tools

[English](README.md) | 中文

`dsh-desktop-tools` 将划词工具栏、悬浮球、截屏和录屏合并为一个 DSH Desktop 插件。

## 安装

使用满足 `>=0.2.2-rc.1 <0.3.0-0` 的 DSH Desktop，在插件管理器中添加：

```text
https://github.com/1997liuyh-boop/dsh-desktop-tools.git
```

选择精确标签 `0.3.0`。插件已经包含辅助进程、预加载脚本、原生功能模块、静态资源和设置页，不需要再安装 `dsh-desktop-runtime`、`dsh-selection-toolbar`、`dsh-floating-ball` 或 `dsh-capture`。

安装不依赖 Electron 的 `path.txt`，也不使用 `koffi` 安装脚本。辅助进程使用 DSH Desktop 当前的 Electron 可执行文件，并加载对应平台的 Koffi 预编译包。

## 替换旧插件

如果 profile 中已经安装了旧插件，请先移除 `dsh-selection-toolbar`、`dsh-floating-ball`、`dsh-capture` 和 `dsh-desktop-runtime`，再安装 `dsh-desktop-tools@0.3.0` 并重启 Host。新插件将配置保存在 `desktop-tools.json`，不会导入旧插件各自的配置文件。默认启用划词工具栏和悬浮球，关闭截屏和录屏。

## 设置

DSH 设置中会增加一个“桌面工具”入口，下设四个子菜单：

- 划词工具栏：启用状态、目标语言、模型和兼容复制。
- 悬浮球：启用状态、头像、对话和后台模型、权限预设、坐标模式及系统权限。
- 截屏：启用状态和可编辑的 `Ctrl/Cmd + Shift + S` 快捷键。
- 录屏：启用状态和可编辑的 `Ctrl/Cmd + Shift + R` 快捷键。

首次安装默认启用划词工具栏和悬浮球，关闭截屏和录屏。配置保存在 profile 的 `desktop-tools.json` 中，每次保存都会分别报告持久化结果和辅助进程的实际应用状态。

## 构建

使用 Node 24.9 或更新版本：

```sh
npm install --ignore-scripts
npm test
npm run build
```

构建会生成 Host、辅助进程、预加载、Remote 描述、Client 设置包和基于 TwCSS 的资源。在 macOS 上构建时会编译 macOS 原生模块；Windows 和 Linux 会保持这些 Darwin 专用模块不可用。

## 许可证

MIT。仓库保留 DeepSeek MIT 声明和第三方依赖许可证信息。
