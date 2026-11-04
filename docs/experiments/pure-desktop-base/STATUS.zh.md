# 纯净桌面底座执行进度

[English](STATUS.md) | 中文

## 范围

本记录跟踪 [V0.2 计划](PLAN.zh.md)。实施分支为 `feat/pure-desktop-base`。开发验证环境为 macOS arm64、Node 24.17.0、pnpm 11.28.5 和 Electron 44.7.0（内置 Node 24.21.0）。开发桌面可以运行，不等于已经形成可独立分发的产品。

## 进度

| 阶段 | 状态 | 证据或剩余工作 |
|---|---|---|
| 0：隔离与基线 | 开发基线已验证 | 独立数据、独立开发身份、单个可见 Electron 窗口、正常退出与冷重开 |
| 1：白名单组合 | Web smoke 通过 | 18 个 Host 条目激活、认证页面、精简 Remotes 和可见 Root |
| 2：Desktop 解耦 | 开发 smoke 通过 | 显式 shell 模式跳过账户/模型引导、Office 载荷和 Agent 任务检查；原生故障恢复实测仍待执行 |
| 3：通用 Client 与 Shell | 设置已验证 | Root、主题呈现和主题/语言设置面板；已证明跨冷启动持久化。原生窗口交互覆盖仍部分完成 |
| 4：插件样例 | 未开始 | 两个样例与管理流程待实现 |
| 5：发行 | 未开始 | 开发应用仍依赖源码目录；生产依赖闭包、身份和打包待完成 |
| 6：验收 | 进行中 | 开发证据尚未完成发行产物级别的 P01–P12 矩阵 |

## 环境与隔离

锁定依赖安装已成功。之后从本地缓存更新了工作区链接；此前队友的一次 pnpm 测试调用也曾触发依赖自动下载，随后已取消。未覆盖依赖版本或供应链策略。后续聚焦命令直接调用 Node，避免隐式安装。

本地证据保存在 Git 忽略的 `.artifacts/pure-desktop-base/` 下。Electron 测试使用其中独立的 `desktop-home` 和 `electron-user-data` 目录，调试端口为 Main 19329、Renderer 19322、Host 19330。生成的开发项目和应用位于 `apps/desktop/.desktop-build/shell-development/`。未停止或重新配置用户已安装的 DSH 应用。

开发包不声明 URL handlers，也不显式注册 Launch Services。Shell 模式使用独立 macOS bundle 身份，并在冷启动脚本中保存模式和 runtime 路径。运行时只有打包的 product 模式注册官方协议。未来 Shell 打包元数据仍需移除该协议；本次工作不修复历史系统注册。

## 已实现组合

[shell 组合包](../../../packages/bundle/shell-base/README.zh.md)包含凭证、配置、设置、类型化通信、认证页面服务和[精简设置 Remote assembly](../../../packages/api/shell-remotes/README.zh.md)，以及[最小 Root](../../../packages/client/ui-shell/README.zh.md)。它不继承 agent base 或完整 Web 应用组合。源码和开发安装中仍保留其他仓库包；运行时排除不等于发行依赖已收敛。

Renderer 允许纯 root 树不存在 Session binding，不提供假 adapter。真正的 scoped 消费者仍拒绝缺失 binding。回归套件覆盖 root 子插槽、factory、local slot 和 adapter 生命周期，同时保留已有 Session adoption 和 identity 行为。

Desktop 在写入 profile 前验证模式。开发版读取 `DSH_DESKTOP_MODE`；打包应用读取自身 `dshDesktopMode` 元数据，模式选择不接受环境覆盖。Shell profile 初始化和恢复到 shell base。跨模式复用 profile 会被拒绝，且不替换原文件。未声明模式时仍默认 product。

## 运行证据

真实 Loader 测试观察到全部 18 个 Host 条目激活、无警告、无 Agent、Session、模型或 Job 服务。认证检查通过：无凭证 HTTP 401、token 交换 303、已认证页面 200。选定 Client 条目不包含完整业务 Remote assembly 和对话 UI。

Web smoke 渲染了恰好一个 Root 和一个原生菜单标记，在本次有界加载期间没有 console/page 错误或页面外部请求。首次失败运行发现 Renderer 的隐式 `session-maybe` 依赖；通过的运行使用了解耦后重建的 Renderer。

真实 Electron smoke 在 Electron 44.7.0 中渲染 `dsh-app://app/`，只有一个可见应用窗口，没有 Welcome 窗口。刷新后 Root 正常渲染，观察期间没有 console/page 错误或页面外部请求。通过 Main inspector 核对 shell 模式和独立 userData 路径后，调用真实 `app.quit()`，启动进程以 0 退出。随后在移除继承的模式、home、runtime 和模型密钥环境变量后，生成的应用仍成功冷启动，再次原生退出后退出码为 0。此次冷重开检查期间，Office/Python primary-runtime 目录不存在。

私有 Desktop Host e2e 单独验证了无 Office 载荷启动、业务服务缺席、更新/文件拖拽请求不可用、设置跨 Host 重启持久化、正常关闭确认和非法模式拒绝。单元测试覆盖同模式恢复及模式不匹配时保留 profile；它们不能代替真实原生故障恢复实测。

Shell 设置面板在同一 Electron 实例中实测。打开时应用根变为 inert，焦点进入对话框；用 Escape 或关闭按钮退出后焦点回到触发按钮。选择主题会调用主题服务并立即重绘；选择语言会切换文案与文档语言。取值由既有设置作用域写入 profile，而不是由 shell 自己持久化。完整验证两轮：深色/英文在冷启动后保留，随后浅色/中文在又一次冷启动后保留，每次均从运行中的窗口读回两项偏好。某次退出时观察到一次非致命的 fetch 失败日志，后续运行未复现，仍列入生命周期加固项。

面板截图保存在本地证据（`shell-settings-light.png`、`shell-settings-dark.png`）。面板列出语言服务发布的全部语言；基础 shell 只随附英文和中文词典，因此其他内置语言目前回退到英文，直到有插件注册对应词典。

## 检查

| 检查 | 已观察结果 |
|---|---|
| Profile/可达性聚焦测试 | 39 项通过 |
| Shell 事件及已构建 Loader 组合 | 3 项单元测试、1 项 e2e 通过 |
| Root 测试及 Renderer 回归套件 | 2 项 Root、145 项 Renderer 测试通过 |
| Shell 设置面板测试 | 8 项 ui-shell 测试通过（含三条关闭路径、焦点恢复、写入委托与卸载清理） |
| 原生启动/Welcome 回归 | 177 项通过；后续协议专项子集 5 项通过 |
| 模式/profile/开发 fixture | 57 项通过，1 项既有平台相关跳过 |
| Desktop Host 模式/退出测试及真实 e2e | 18 项单元测试、1 项 e2e 通过，e2e 禁用重试 |
| 新 Client 依赖策略检查 | 两个新 Client 包通过既有验证器的聚焦检查 |
| 包级编译与打包 | 新包、Renderer、Desktop Host 和 Electron main 均已成功构建 |
| 聚合构建与仓库检查 | 产物构建通过8项检查，修正测试引用后串行build check两个聚合均通过；后续lint清理通过31文件聚焦lint，并重建两个受影响UI包；完整文档复验仍待执行 |

此前完整文档检查在新增包期间有 4 项失败，包括 CLI help 超时。长时间运行的旧聚合类型/lint 和依赖扫描已取消，未记为通过。集成稳定后仍需补齐最终检查。

## 下一检查点

增加两个独立业务插件样例，实测原生故障恢复，并补齐剩余仓库检查。之后生成不依赖源码、依赖闭包收敛、具有独立产品元数据的 Shell 产物。运行时、安装包、网络观察和跨平台结论均须限定在实际已收集的证据范围内。
