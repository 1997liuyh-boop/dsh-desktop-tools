# DSH 桌面工具套件实施计划

本计划落实 `docs/superpowers/specs/2026-11-10-desktop-tools-suite-design.md`，所有代码修改均在 `codex/desktop-tools-suite` 分支完成。旧仓库只作为只读来源，直到新仓库和 PR 验证完成后才删除。

## 阶段一：合并源码和构建入口

1. 将划词工具栏、悬浮球和截屏/录屏的唯一源码、原生库和静态资源复制到运行时仓库。
2. 对重复文件按内容哈希去重，保留一份公共桌面 Host、IPC、locale、预加载和资源服务实现。
3. 将三个功能入口改为内部功能模块，创建单一 Helper 入口和单一 Cordis Host 入口。
4. 合并三个资源构建脚本与 tsdown 入口，生成 Host、Helper、preload 和 Client 产物。
5. 更新包名、版本、导出、文件列表、bundle patch 和 README 为 `dsh-desktop-tools@0.3.0`。
6. 运行类型检查与构建，先解决纯合并错误，不在本阶段增加设置行为。

## 阶段二：统一 Host 和 Helper 生命周期

1. 将原运行时改为当前包内部的 Helper 控制器，不再提供 `desktopNativeRuntime` 服务。
2. 使用 `electronExecutable ?? process.execPath` 启动 Helper；没有 Electron Host 时明确拒绝。
3. 从 Helper 环境移除 `ELECTRON_RUN_AS_NODE`、密钥、令牌、密码、`NODE_OPTIONS` 和 `NODE_PATH`。
4. 将四项功能注册为独立控制器，支持幂等启动、更新和停止。
5. 仅在至少一项功能启用时运行 Helper，全部关闭并完成活动任务后停止。
6. 增加启动、部分失败、超时、IPC 断开和资源释放测试。

## 阶段三：统一配置和 Remote 协议

1. 定义共享配置、运行状态、错误和 Remote 请求/响应类型。
2. 实现 `desktop-tools.json` 严格解析、完整默认值和临时文件替换式原子写入。
3. 实现“校验、持久化、应用”顺序，区分 `saved` 与 `applied`。
4. Helper 接收完整配置快照，Host 持有配置和实际状态。
5. 增加读取、修改、重试和重启 Remote 方法。
6. 覆盖损坏配置、写入失败、应用失败和未知状态测试。

## 阶段四：设置客户端

1. 增加 `./client` 构建和 `dsh.client` 声明。
2. 在 `settings.section` 注册一个“桌面工具”入口和四个子菜单。
3. 使用 DSH Client Slots、现有表单原语、类型化 locale 字典和 TwCSS。
4. 接入模型目录、头像选择、权限状态和坐标模式。
5. 通过 `ctx.shortcuts` 注册截屏和录屏命令，复用官方快捷键编辑器。
6. 显示加载、保存中、成功、已保存但未应用、平台不支持、权限不足和失败状态。
7. 添加组件测试和设置页面聚焦测试。

## 阶段五：移除安装脚本依赖

1. 删除 `electron`、`dsh-desktop-runtime` 和 `koffi` 主包依赖。
2. 增加窄接口 Koffi 平台加载器和四个官方平台可选包。
3. 保留无安装脚本的 `@napi-rs/canvas` 及其平台可选包。
4. 扫描最终依赖树，拒绝 `preinstall`、`install` 和 `postinstall` 运行时脚本。
5. 在干净临时项目中分别验证 tarball 安装和 Git URL 安装退出 0。

## 阶段六：产品验证

1. 运行目标仓库的聚焦测试、类型检查、构建和 `npm pack --dry-run`。
2. 将 tarball 安装到干净 DSH Desktop profile，验证单一条目激活。
3. 在 Windows 验证划词、悬浮球、截屏、录屏、快捷键和资源清理。
4. 验证没有 `desktopNativeRuntime` 等待、`electron/path.txt` 读取或构建脚本审批错误。
5. 使用 Playwright 检查 390 像素和桌面宽度、明暗主题、长文案、键盘焦点及全部状态。
6. 请求设计或产品评审明显 UI 变更。

## 阶段七：GitHub 和 PR 迁移

1. 提交并推送全部已验证代码。
2. 将 `dsh-desktop-runtime` 仓库重命名为 `dsh-desktop-tools`，更新 local remote 和所有 URL。
3. 创建并推送新的 `0.3.0` 标签，不移动旧标签。
4. 通过新 GitHub URL再次执行干净安装和 DSH Desktop 启动验证。
5. 更新 `awesome-dsh-plugin#13763` 为唯一的 `dsh-desktop-tools` 条目。
6. 检查 PR diff 和 Submission gate；仓库年龄限制只等待自动重跑。
7. 新仓库与 PR 均确认后，删除 `dsh-selection-toolbar`、`dsh-floating-ball` 和 `dsh-capture`。

## 提交策略

按可独立验证的阶段提交：设计与计划、源码合并、Host/Helper 生命周期、配置与 Remote、设置客户端、依赖和安装修复、测试与文档、仓库迁移。每个提交只包含该阶段相关文件，避免将生成产物和无关本地文件混入提交。
