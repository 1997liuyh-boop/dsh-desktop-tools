# DSH 桌面工具套件设计

## 背景

当前桌面功能分散在 `dsh-desktop-runtime`、`dsh-selection-toolbar`、`dsh-floating-ball` 和 `dsh-capture` 四个仓库中。功能插件依赖独立运行时，用户需要分别安装多个条目，并且 `dsh-desktop-runtime` 通过安装包内的 `electron/path.txt` 查找 Electron，导致在 DSH Desktop 中启动时出现 `ENOENT`。划词工具栏还直接依赖带 `install` 脚本的 `koffi`，在 pnpm 的构建脚本审批策略下会导致安装命令以 `ERR_PNPM_IGNORED_BUILDS` 退出。

本次变更将四个仓库合并为一个 GitHub 仓库和一个公开安装包 `dsh-desktop-tools`。当前没有旧插件用户，因此不保留旧包名、旧配置文件或旧入口的迁移兼容。

## 目标

- 用户只安装一个 `dsh-desktop-tools` 条目即可获得划词工具栏、悬浮球、截屏和录屏。
- 插件直接复用 DSH Desktop 当前 Electron 可执行文件，不再安装或查找独立 Electron。
- 安装过程不要求执行 `pnpm approve-builds`，也不依赖被 pnpm 阻止的生命周期脚本。
- DSH 设置中提供一个“桌面工具”入口，下设四个独立子菜单。
- 四项功能分别启停、分别报告状态，一项失败不应使其他已启用功能失效。
- 合并完成并验证后，更新 `awesome-dsh-plugin#13763` 为一个仓库条目，最后删除三个旧功能仓库。

## 非目标

- 不保留 `dsh-desktop-runtime`、`dsh-selection-toolbar`、`dsh-floating-ball` 或 `dsh-capture` 的安装兼容入口。
- 不迁移旧插件配置；新包首次启动使用本文定义的默认值。
- 不新增划词、悬浮球、截屏或录屏之外的桌面功能。
- 不建立仓库内多包工作区，也不发布内部运行时子包。

## 架构决策

采用“单一公开包、内部功能模块”方案。仓库和 npm 包均命名为 `dsh-desktop-tools`，只有一个 Cordis 主入口和一个客户端入口。运行时、设置服务以及四项功能在源码中保持独立模块和独立生命周期，但构建和发布为一个包。

不采用多包工作区，因为 Git URL 安装仍会产生多个安装单元、版本和构建步骤。不采用单文件扁平合并，因为功能失败、资源清理和测试会互相耦合。

建议目录如下，实施时可以按现有文件职责微调文件名，但不得改变模块边界：

```text
source/
  host/
    index.ts
    config-store.ts
    remote-service.ts
    helper-controller.ts
  helper/
    index.ts
    feature-host.ts
    features/
      selection/
      floating-ball/
      screenshot/
      recording/
  client/
    index.tsx
    DesktopToolsSettings.tsx
    sections/
      SelectionSettings.tsx
      FloatingBallSettings.tsx
      ScreenshotSettings.tsx
      RecordingSettings.tsx
    locale.ts
  shared/
    config.ts
    protocol.ts
assets/
dist/
```

## 包与入口

`package.json` 使用名称 `dsh-desktop-tools`，首个合并版本为 `0.3.0`。该版本高于三个功能插件现有的 `0.2.1`，并以新标签发布，不移动或覆盖现有标签。

根导出 `.` 指向 Host 插件，`./client` 指向设置客户端，`./package.json` 保留给 DSH 插件发现。`dsh.client` 声明客户端入口，`dsh.bundle.patch` 只插入一个 `dsh-desktop-tools` 条目。平台集合为 Windows、macOS 和 Linux；不受支持的平台能力必须在设置中明确标为不可用，不能静默失败。

包不再声明 `electron` 或 `dsh-desktop-runtime` 运行时依赖。四个原仓库的内部源码和静态资源合并进入本包，重复的桌面 Host、IPC、locale、预加载和公共资源实现只保留一份。

## Host、Helper 与 Client

Host 插件拥有配置、Remote 服务和 Helper 生命周期。它在 Helper 未启动或启动失败时仍可读取与修改设置，并返回持久化状态和实际运行状态。

Helper 是同一个 Electron 子进程，加载四个内部功能控制器。每个控制器提供 `start(config)`、`update(config)` 和 `stop()` 等价能力，并自行拥有窗口、系统钩子、快捷键、录制器和监听器的清理。Helper 只接收完整配置快照和明确的控制命令，不直接写配置文件。

Client 通过类型化 Remote 服务读取配置、保存单项修改、读取实际状态以及执行重试或重启。Client 不直接访问本地文件，不依赖 `globalThis.dshDesktop`，也不创建独立设置窗口。

数据流如下：

```text
设置界面
  -> Host Remote 服务校验修改
  -> 原子写入 desktop-tools.json
  -> Host 启动 Helper 或发送完整配置快照
  -> Helper 按功能应用配置
  -> Host 返回“已保存”及每项实际运行状态
  -> 设置界面显示最终状态
```

## 统一配置

配置保存在当前 DSH profile 下的单一 `desktop-tools.json`。Host 在加载时完成结构校验和默认值解析，并以临时文件加替换方式原子写入。无效配置必须在最早可判断的位置报告，不能用部分默认值掩盖损坏文件。

逻辑配置如下：

```ts
interface DesktopToolsConfig {
  readonly selection: {
    readonly enabled: boolean
    readonly targetLanguage: string
    readonly model: ModelSelection
    readonly compatibilityCopy: boolean
  }
  readonly floatingBall: {
    readonly enabled: boolean
    readonly avatar: AvatarSelection
    readonly conversationModel: ModelSelection
    readonly backgroundModel: ModelSelection
    readonly permissionPreset: string
    readonly coordinateMode: CoordinateMode
  }
  readonly screenshot: {
    readonly enabled: boolean
  }
  readonly recording: {
    readonly enabled: boolean
  }
}
```

快捷键由 DSH 的 `ctx.shortcuts` 系统拥有，不重复写入 `desktop-tools.json`。插件注册稳定的截屏和录屏命令标识，并提供默认绑定。设置界面使用官方快捷键编辑能力完成冲突检测、重新录制、清除和恢复默认。

首次安装默认值为：划词工具栏开启，目标语言为英语，模型跟随主窗口当前会话，兼容复制开启；悬浮球开启，头像使用包内默认头像，对话模型和后台模型均为 `deepseek-official/deepseek-flash` 且推理强度为 `max`，权限预设为 `danger-full-access`，Windows 使用 `millifraction` 坐标模式，macOS 和 Linux 使用 `pixel` 坐标模式；截屏关闭；录屏关闭。截屏快捷键为 `Ctrl/Cmd + Shift + S`，录屏快捷键为 `Ctrl/Cmd + Shift + R`。默认值集中在共享配置模块，不在控制器中重复定义。

## 设置界面

客户端在 `settings.section` 注册一个“桌面工具”一级入口，内部提供“划词工具栏”“悬浮球”“截屏”“录屏”四个子菜单。界面使用 DSH Client Slots、类型化 locale 字典、现有表单原语和 TwCSS，不硬编码产品文案。

“划词工具栏”包含启用开关、目标语言、模型和兼容复制。“悬浮球”包含启用开关、头像、对话模型、后台模型、权限预设、系统权限和坐标模式。其中系统权限展示操作系统返回的屏幕录制与辅助功能状态，并提供打开系统设置或重新检测操作；它不是可伪造的持久化配置。“截屏”和“录屏”各包含启用开关以及官方快捷键编辑器。

页面必须区分配置值与实际运行状态。保存成功但 Helper 尚未应用时，显示“已保存，当前未生效”并提供重试或重启操作；不得把持久化成功误报为功能已运行。平台不支持、权限不足、启动失败和配置保存失败分别显示可执行的本地化说明。

页面在 390 像素宽度下保持可用，长语言文本可换行，不产生水平滚动。交付前检查明暗主题、键盘焦点、加载、禁用、错误、保存中和成功状态。明显 UI 变更在合并前安排设计或产品评审。

## 功能生命周期

Host 根据四项 `enabled` 值决定是否需要 Helper。至少一项启用时启动 Helper；全部关闭且没有正在结束的截屏或录屏任务时停止 Helper。启用状态变化必须串行化，避免重复启动或停止同一资源。

Helper 为每项功能维护 `disabled`、`starting`、`running`、`stopping` 和 `failed` 状态。重复启用和停用必须幂等。停止操作必须等待本功能拥有的窗口、钩子、快捷键和录制资源释放后才完成。

一项功能启动失败时，Helper 保持进程和其他功能运行，并向 Host 返回该项结构化失败。只有 Helper 进程、公共 IPC 或共享预加载等基础设施失败时，才将所有功能标记为不可用并重启 Helper。

正在录屏时关闭录屏功能，先执行已有的安全结束流程并确认文件状态，再释放资源。结果未知时显示“录制结束状态未知”，不得声称文件已经保存或删除。

## Electron 可执行文件

Host 启动 Helper 时使用 `electronExecutable ?? process.execPath`。DSH Desktop 已由 Electron 可执行文件启动，`process.execPath` 是当前受支持 Host 的可执行文件来源。没有覆盖值且 `process.versions.electron` 不存在时，Host 在启动前返回“仅支持 DSH Desktop”的明确错误，不尝试用普通 Node 可执行文件启动 Helper。

启动子进程时必须从环境中移除 `ELECTRON_RUN_AS_NODE`，以便同一可执行文件按 Electron GUI 模式启动 Helper。继续过滤密钥、令牌、密码、`NODE_OPTIONS` 和 `NODE_PATH`。高级 `electronExecutable` 覆盖仅用于诊断或受控部署，配置为空时不解析 `electron/package.json`，也不读取 `path.txt`。

验收测试必须在没有 `electron` 依赖和没有 `node_modules/electron/path.txt` 的安装树中启动 Helper，覆盖用户报告的 `ENOENT` 回归。

## 原生依赖分发

不得在运行时依赖中保留 `koffi` 主包，因为其 `install` 脚本会触发 pnpm 构建审批。代码改为一个小型平台加载器，按 `process.platform` 和 `process.arch` 加载 Koffi 官方预编译平台包。支持范围至少包含 `@koromix/koffi-win32-x64`、`@koromix/koffi-win32-arm64`、`@koromix/koffi-darwin-x64` 和 `@koromix/koffi-darwin-arm64`，这些包放入 `optionalDependencies`，只安装当前平台匹配项。

平台加载器只暴露划词实现实际使用的窄接口，并在平台包缺失或架构不受支持时返回可定位的启动错误。不得复制 Koffi 主包安装器，也不得在用户机器上编译原生模块。平台包继续使用上游 MIT 许可证和版本 `3.1.1`，发布包的第三方声明中保留许可证信息。

`@napi-rs/canvas` 可继续作为运行时依赖，因为其发布包没有 `install`、`postinstall` 或 `preinstall` 脚本，并通过无生命周期脚本的平台可选包提供预编译二进制。发布检查仍需扫描完整依赖树，任何新增生命周期脚本都视为失败。

## 错误与状态保证

配置修改按“校验、原子持久化、应用到 Helper”顺序执行。持久化失败时不修改内存配置，也不向 Helper发送新值。持久化成功而应用失败时保留新配置，并返回 `saved: true`、`applied: false` 及对应功能错误；不执行无法保证正确的伪回滚。

Remote 响应使用结构化结果，至少包含配置版本、保存结果、每项功能状态、最近错误和是否可重试。日志记录技术原因，界面显示本地化且可执行的说明。未知结果、IPC 断开和超时均作为失败处理，不能推断成功。

Helper 启动或公共 IPC 失败时，Host 终止失效子进程并允许显式重试。功能控制器停止失败时标记该功能状态未知；若残留资源可能影响其他功能，则升级为 Helper 重启，而不是继续在不可信状态下操作。

## 安全与权限

Host 到 Helper 的消息必须校验类型、功能标识和配置字段。渲染窗口只允许现有预加载接口，继续验证 IPC sender 所属窗口。外部 URL 仅通过受控 `shell.openExternal` 路径打开。

系统权限按功能按需申请。关闭功能后不得继续保留不必要的全局钩子、屏幕采集或辅助功能访问。设置界面展示权限状态和打开系统设置的动作，但不得把系统权限状态写成用户可伪造的配置值。

## 构建与测试

实现至少包含以下验证：

1. 配置解析、默认值、原子写入和损坏文件失败测试。
2. Host 的 Helper 启停、并发更新、超时、IPC 断开和部分功能失败测试。
3. 四个控制器的独立启动、更新、停止、重复操作和资源释放测试。
4. 快捷键默认值、冲突、清除、恢复默认和禁用功能不触发测试。
5. `process.execPath` 启动回归测试，确认不读取 `electron/path.txt`。
6. Windows x64 和 macOS x64/arm64 的 Koffi 平台加载测试；不受支持架构返回明确错误。
7. `npm pack --dry-run` 检查发布内容，只包含所需入口、资源、源码声明和许可证。
8. 在干净临时项目中执行 Git URL 和打包文件安装，命令必须退出 0，输出不得包含 `ERR_PNPM_IGNORED_BUILDS`，依赖树不得要求 `pnpm approve-builds`。
9. 在真实 DSH Desktop profile 中安装并启动单一条目，验证四项功能和卸载清理。
10. 使用 Playwright 检查设置页面的 390 像素宽度、桌面宽度、长文案、明暗主题、键盘焦点、加载、错误、禁用和保存状态。

构建后运行目标仓库的类型检查、构建、包内容检查和聚焦测试。发布前还要检查最终 tarball 中所有动态入口、原生二进制和静态资源均可从安装位置解析，不能依赖源码仓库外的工作区路径。

## 发布与仓库迁移

破坏性操作按以下顺序执行：

1. 在保留 `dsh-desktop-runtime` Git 历史的当前仓库中完成合并、测试和发布包验证。
2. 将 GitHub 仓库从 `dsh-desktop-runtime` 重命名为 `dsh-desktop-tools`，更新本地 remote、`package.json`、README、徽章和所有仓库 URL。
3. 推送最终提交并创建新的 `0.3.0` 标签；不覆盖 `0.1.0`、`0.1.1` 或其他旧标签。
4. 验证通过新 GitHub URL 的干净安装和 DSH Desktop 启动。
5. 更新 `awesome-dsh-plugin/awesome-dsh-plugin#13763`，删除三个旧条目，只保留 `https://github.com/1997liuyh-boop/dsh-desktop-tools`。
6. 确认 PR diff、Submission gate 和仓库链接均指向新仓库。
7. 最后删除 `dsh-selection-toolbar`、`dsh-floating-ball` 和 `dsh-capture` 三个 GitHub 仓库。

旧仓库删除前不得只依赖 GitHub 重定向。新仓库、标签和 PR 条目必须先可访问并通过安装验证。若 PR gate 仅因仓库年龄限制等待，则不重复推送或重开 PR，等待自动重跑。

## 完成标准

- 用户只需安装 `dsh-desktop-tools`，安装命令退出 0。
- 启动日志不再出现 `waiting for service: desktopNativeRuntime` 或 `electron/path.txt` 的 `ENOENT`。
- 设置中存在一个“桌面工具”入口和四个子菜单，字段、默认值和快捷键符合本文。
- 四项功能可独立启停，失败状态与实际运行状态一致。
- Windows 划词功能无需 `pnpm approve-builds` 即可加载 Koffi 预编译模块。
- 本地构建、聚焦测试、打包安装、真实 DSH Desktop 和 Playwright 设置页验证全部通过。
- PR `#13763` 只包含新仓库条目，并且 Submission gate 除可能的仓库年龄等待外无其他失败。
- 三个旧功能仓库仅在以上条件满足后删除。
