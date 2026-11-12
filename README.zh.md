# dsh-desktop-tools

[English](README.md) | 中文

`dsh-desktop-tools` 将划词工具栏、悬浮球、截图、长截图和录屏合并为一个 DSH Desktop 插件。

## 安装

使用满足 `>=0.2.2-rc.1 <0.3.0-0` 的 DSH Desktop，在插件管理器中添加：

```text
https://github.com/1997liuyh-boop/dsh-desktop-tools.git
```

选择精确标签 `0.4.7`。插件已经包含辅助进程、预加载脚本、原生功能模块、静态资源和设置页，不需要再安装 `dsh-desktop-runtime`、`dsh-selection-toolbar`、`dsh-floating-ball` 或 `dsh-capture`。

安装不依赖 Electron 的 `path.txt`，也不使用 `koffi` 安装脚本。辅助进程使用 DSH Desktop 当前的 Electron 可执行文件，并加载对应平台的 Koffi 预编译包。

## 前置插件：dsh-vision-router

截图与长截图的「提取文字」「翻译」「知识图谱」，以及「录屏转知识图谱」，都通过 [`dsh-vision-router`](https://github.com/ysr666/dsh-vision-router)（`>=3.2.0`）的 OCR 工具识别文字，需要先安装并启用它，并保持其设置中的「工具」开关打开。其余功能（标注、钉图、保存、转发、录屏、长截图拼接）不依赖它。

DSH 插件管理器不支持插件之间的自动联动安装，可以用以下任一方式安装：

- 在「设置 → 桌面工具 → 截图」的前置插件卡片中点击「一键安装 dsh-vision-router」（已安装但停用时为「启用」），安装后按提示重启 DSH；
- 截图工具栏中点击这三个功能时，如果尚未安装，结果窗口会显示同样的一键安装按钮；
- 或在终端执行 `dsh plugin add dsh-vision-router`。

`package.json` 以可选 `peerDependencies` 声明了该依赖，插件市场的检查会在版本不满足时给出提示。默认 OCR 引擎为 `auto`：本地 Tesseract 优先，不可用时回退到 vision-router 配置的视觉模型（图片会发送给该模型服务）；如需纯本地，请在 vision-router 设置中把 OCR 默认引擎改为仅 Tesseract。

## 截图、长截图与录屏

按下快捷键（系统级，DSH 在后台也能唤起）后，屏幕顶部出现工具栏，可在「截图 / 录屏 / 长截图」三种模式间切换。

截图：框选区域后可使用

- 形状（矩形 / 椭圆 / 直线，按住 Shift 约束为正方形、圆或 45°）、画笔、箭头、文本（文本 / 自动递增的序号）、马赛克（涂抹，可调强度），以及颜色、粗细、字号；
- 钉在桌面（置顶浮窗，可拖动、滚轮缩放，双击或 Esc 关闭，右键复制 / 保存 / 原始大小）；
- 长截图（以当前选区为范围开始滚动截取）；
- 知识图谱转换、翻译、提取文字（需要 dsh-vision-router）：在独立结果窗口中显示，翻译与知识图谱会在「截图录屏」工作区新建 DSH 会话，知识图谱以 Mermaid 关系图加节点、关系清单呈现，可保存为 Markdown 或导出 PNG；
- 撤回（Ctrl/Cmd + Z）、转发（发送到新的 DSH 对话，可附言；或调用系统分享面板）、保存到本地（Ctrl/Cmd + S）、取消（Esc）、完成（复制到剪贴板，Enter）。

录屏：

- 录制范围：框选区域、选择应用窗口或全屏；
- 格式 MP4 / GIF / WebM（Chromium 不支持 MP4 编码时自动改用 WebM），清晰度 标清 720p / 高清 1080p / 原画；
- 系统声音、麦克风（两路同时开启时混为一条音轨），GIF 不含声音；
- 录屏转知识图谱：录制中自动抽取画面明显变化的关键帧（最多 12 张），结束后识别文字并生成知识图谱；不转写语音；
- 开始录制后变为顶部控制条，可暂停 / 继续（空格）、停止并保存（Enter）、放弃（Esc）。MP4 / WebM 最长 15 分钟、500 MB，GIF 最长 3 分钟。

长截图：框选需要滚动的区域，点「开始」后在框内用鼠标滚轮向下滚动，插件按行比对自动拼接并排除固定的顶栏和底栏；也可点「自动滚动」。完成后可复制、保存、钉图、提取文字、翻译、生成知识图谱或转发。最大高度 30000 像素。

平台限制：

| 功能 | Windows | macOS | Linux |
| --- | --- | --- | --- |
| 系统声音 | 支持 | macOS 13+，不可用时自动改为只录画面 | 不支持 |
| 长截图自动滚动 | 支持 | 需要辅助功能权限 | 不支持（可手动滚动） |
| 系统分享 | 资源管理器「共享」面板 | 系统共享菜单 | 不支持 |

## 替换旧插件

如果 profile 中已经安装了旧插件，请先移除 `dsh-selection-toolbar`、`dsh-floating-ball`、`dsh-capture` 和 `dsh-desktop-runtime`，再安装 `dsh-desktop-tools@0.4.7` 并重启 Host。新插件将配置保存在 `desktop-tools.json`，不会导入旧插件各自的配置文件。默认启用划词工具栏和悬浮球，关闭截图和录屏。

## 设置

DSH 设置中会增加一个“桌面工具”入口，下设四个子菜单：

- 划词工具栏：启用状态、目标语言、模型和兼容复制。
- 悬浮球：启用状态、头像、对话和后台模型、权限预设、坐标模式及系统权限。
- 截图：启用状态、截图快捷键（默认 `Ctrl/Cmd + Shift + S`）、长截图快捷键（默认不设置）以及 dsh-vision-router 状态与一键安装。
- 录屏：启用状态、录屏快捷键（默认 `Ctrl/Cmd + Shift + R`），以及默认格式、清晰度、系统声音、麦克风和是否生成知识图谱。

快捷键为系统级全局快捷键，被其他程序占用时不会注册，请换一个组合。首次安装默认启用划词工具栏和悬浮球，关闭截图和录屏。配置保存在 profile 的 `desktop-tools.json` 中，每次保存都会分别报告持久化结果和辅助进程的实际应用状态。

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
