---
description: "不依赖会话的 Electron 桌面底座：经过认证的 Host 启动、profile 归属、恢复、开发与尚未收敛的发行依赖。"
kind: "package-reference"
---

# DeepSeek Harness 桌面端

[English](README.md) | 中文

## 概述

Desktop 是独立 shell 底座的 Electron 载体。它启动一个私有 Host，加载 shell 客户端，并持有原生窗口、本地认证、profile 准备与恢复。启动不选择产品模式，也不依赖 Session、Agent、模型凭证、Welcome、账号状态、分析上报或更新服务。这种运行时隔离不等于依赖最小化的发行包：现有 CLI、包准备流程与原生载荷仍保留更广的发行依赖闭包。

## 目录

- [应用概览](#application-overview)
- [认证与进程归属](#authentication-and-process-ownership)
- [Profile 与兼容性](#profiles-and-compatibility)
- [关闭窗口与退出](#closing-the-window-and-quitting)
- [恢复与诊断](#recovery-and-diagnostics)
- [开发](#develop)
- [安装归属](#installation-ownership)
- [终端命令](#terminal-command)
- [打包](#package)
- [已知限制](#known-limitations)
- [开发备注](#dev-note)

<a id="application-overview"></a>
## 应用概览

[Electron 主进程](src/main.ts)通过 Electron RunAsNode 启动[私有 Desktop Host](../desktop-host/README.zh.md)。Host 通过共享应用 runner 启动保留名称为 `desktop` 的 profile。Profile 初始化、运行时项目元数据与恢复都选择 [`@deepseek-ai/dsh-shell-base`](../../packages/bundle/shell-base/README.zh.md)，不存在另一个产品组合。

应用从 `dsh-app://app/` 加载打包的 Web 资源。加载文档等待经过认证的 Host 就绪与启动注入，然后在同一文档中启动客户端，不发生页面跳转。窗口在 Host 启动后显示。设置通过 shell Host 持久化；原生目录选择器和键盘集成继续可用。

应用菜单保留关于、macOS 和 Windows 上的命令注册、DevTools 与退出。开发环境还提供重新加载页面和重启应用与 Host。Windows 通过所属应用窗口提供原生 Application 与 Edit 弹出菜单。此启动路径不包含账号、引导、检查更新或安装更新操作。

<a id="authentication-and-process-ownership"></a>
## 认证与进程归属

Host 默认绑定 `127.0.0.1` 上由操作系统分配的端口。Electron 使用 Host 启动凭据交换认证 Cookie，并在主进程保留该 Cookie。HTTP 转发显式携带它；WebSocket 凭据只附加给所属应用窗口，且要求 Host authority 与 scheme 匹配。移除产品集成不会移除 Host 认证或 Host/Origin 检查。

渲染器使用隔离 preload，启用 sandbox、context isolation 与 Web security，禁用 Node integration。应用 IPC 同时检查来源与主 frame 归属。任意页面及子 frame 不能调用原生应用处理器。外部 HTTP(S) 导航在应用文档外打开。

静态资源来自安装目录。其他应用请求转发到经过认证的 Host，移除连接专属响应头，并将插件响应标记为 `no-store`。就绪与关闭使用私有 Node IPC。[Host 参考](../desktop-host/README.zh.md)与 [Connection 参考](../../packages/client/connection/README.zh.md)维护进程和认证细节。

<a id="profiles-and-compatibility"></a>
## Profile 与兼容性

外部 profile 位于 `$DSH_HOME/profiles/desktop`。初始化创建缺失的 profile 文件，不安装包。普通启动校验运行时元数据，保留已安装插件与 lockfile，并只移除旧 loader 持有的过时模块链接投影。包安装仍是显式插件管理操作。

**兼容性破坏：** Desktop 只有一条 shell 启动路径。`DSH_DESKTOP_MODE`、manifest 的 `dshDesktopMode` 与 product/shell 启动参数不再选择行为。产品 Welcome、账号与模型密钥启动检查、分析上报、更新控制和 Agent 任务退出提示均不属于此应用。不会用宽松的替身服务替代它们。

现有 profile 必须以 `@deepseek-ai/dsh-shell-base` 开头，且所选 bundle 中不能包含 `@deepseek-ai/dsh-base` 或 `@deepseek-ai/dsh-web-app`。不兼容的 profile 在初始化或恢复改写文件前以 `DesktopProfileCompatibilityError`（`desktop-profile-incompatible`）失败。Desktop 不转换产品 profile，也不删除其数据。请为 shell 底座选择独立 `DSH_HOME`，并为原本持有数据的安装保留原 home。

原生恢复会备份用户 profile patch，禁用第三方 bundle 选择，但保留其已安装文件。恢复只还原 shell base，不改动 home 级 patch。不能通过此恢复操作接管不兼容的产品 profile。

<a id="closing-the-window-and-quitting"></a>
## 关闭窗口与退出

关闭应用窗口通常隐藏窗口，而不关闭 Host。Windows 保留托盘及其后台关闭提示；重新打开会聚焦现有窗口。macOS 保留普通应用激活行为。操作系统会话终止与显式退出走关闭流程，而非普通隐藏路径。

退出、托盘退出操作与开发重启直接进入清理，不查询 Agent 或定时任务服务。Main 防止重复关闭，隐藏窗口，释放原生关闭提示和托盘状态，中止登录 shell 探测与诊断工作，关闭 backend，并排空待写诊断记录。Host 的关闭处理有界；诊断 Worker 与日志等待也有界。失败会被报告，不会描述为成功清理，随后进程完成退出。重启通过同一关闭路径请求重新启动。

<a id="recovery-and-diagnostics"></a>
## 恢复与诊断

启动、Host、preload 与渲染器失败进入原生恢复。可用操作包括退出、重启、备份 profile patch 后禁用第三方 bundle，以及获取诊断报告。恢复在修改 profile 前停止所属 backend。无法安全应用恢复时，损坏或不兼容的 profile 保持原样。

Electron 在 `userData/desktop/locale-cache` 缓存最近确认的界面语言，用于 Host 设置可用前的失败提示。缓存缺失或无效时回退到系统语言。崩溃报告和有界插件操作记录独立于产品账号或更新服务继续可用。报告位置、数据限制和失败处理见[恢复与诊断](docs/diagnostics/README.zh.md)。

<a id="develop"></a>
<a id="shell-development"></a>
## 开发

受支持的开发启动器构建当前产物并启动唯一的 shell 应用。显式构建后，第二条命令会重新生成一次性运行时项目，并使用已有产物启动而不重新构建：

```sh
pnpm run dev:desktop
pnpm run start:desktop
```

启动器在本包下保留隔离的 `.desktop-build/shell-development` 目录：`project` 保存生成的运行时元数据和工作区链接，`home` 是默认 Harness home，`electron-user-data` 保存浏览器状态。它不复用原产品开发目录。显式 home 与 userData 覆盖值仍由调用方负责；不要将其指向产品数据以绕过 profile 检查。

macOS 生成的 `Harness Shell Dev.app` 使用工作区专属的 `com.deepseek.harness.shell.dev.*` 标识，不注册 URL handler。其启动器记录字面路径与调试设置供冷启动使用，但不记录模式选择。Main、Renderer 与 Host 调试端口默认为 9329、9322 和 9330。除非显式禁用，否则自动打开 Renderer DevTools。重新加载和重启不重新构建源码。

开发启动跳过 primary-runtime 准备，不需要 Python 或 Office 载荷即可启动 shell。Electron 自身可执行文件及已构建的 Host、client 和 main 产物仍必须存在。生成的项目目前链接 CLI、Host 工作区包及其声明依赖；更广的开发依赖集合不表示产品服务已挂载。

<a id="low-level-development-overrides"></a>
### 开发覆盖项

| 变量 | 作用 |
|---|---|
| `DSH_HOME` | 替换默认开发 Harness home。 |
| `DSH_DESKTOP_USER_DATA_DIR` | 替换开发 Electron 浏览器数据目录。 |
| `DSH_DESKTOP_DSH_DIR` | 替换未打包的运行时项目路径。 |
| `DSH_DESKTOP_PNPM_ENTRY` | 替换未打包的包管理器入口。 |
| `DSH_DESKTOP_MAIN_INSPECT_PORT` | 替换 Main 调试端口。 |
| `DSH_DESKTOP_RENDERER_DEBUG_PORT` | 替换 Renderer 调试端口。 |
| `DSH_DESKTOP_HOST_INSPECT_PORT` | 替换 Host 调试端口。 |
| `DSH_DESKTOP_OPEN_DEVTOOLS=0` | 不自动打开分离的 Renderer DevTools。 |

调试端口必须是 1 到 65535 之间的整数。打包运行时路径来自安装目录，不使用未打包运行时的覆盖值。不存在启动模式环境变量或 manifest 选择项。

<a id="installation-ownership"></a>
## 安装归属

Electron 持有运行时资源；用户持有外部 profile 与插件。应用版本、Node 版本或目标变化时，启动不会替换插件文件。原生不兼容在加载时报告，需显式修复。Profile 包操作使用安装版 Node 模式可执行文件与包管理器，不要求用户 PATH 中存在 pnpm。

macOS 和 Linux 在启动 Host 前读取用户账号的登录 shell 环境；Windows 保留继承的用户和系统环境。启动器持有的 `DSH_*` 与 `ELECTRON_*` 值继续受保护。探测失败或超时会警告并回退，退出会中止当前探测。此环境处理不选择产品组合。

打包的 main bundle 必须从已分发依赖解析其裸导入；渲染器 preload 保持 sandbox 兼容的模块集合。[Bundle 检查](scripts/desktop-bundle-imports.mjs)与[运行时文件筛选](packaging/README.zh.md#runtime-file-selection)覆盖这些产物要求。设置、profile 文件和原生浏览器状态继续由不同所有者持有。

<a id="terminal-command"></a>
<a id="bundled-command-runtime"></a>
## 终端命令

现有 **Manage dsh Command…** 菜单在 macOS 和 Windows 上继续可用。它注册、修复或移除安装版终端启动器，并报告命令冲突，不会静默替换无关安装。命令注册独立于 shell profile，仍为可选操作。

安装后的命令运行 [`@deepseek-ai/dsh` 的 Desktop CLI 桥](../cli/src/desktop-cli.ts)，而非私有 Host 入口。CLI 包持有解包 Office 引擎解析与 Windows 控制台信号交付。其公开 CLI 命令及 Desktop profile 包操作仍具备产品能力；保留的命令不是不依赖会话的 CLI。替换或移除安装前，应先结束正在运行的命令。

<a id="package"></a>
## 打包

运行时纯净与发行包纯净是两件事。本地打包流水线仍准备更广的 CLI 和包依赖闭包及原生资源，包括现有 primary-runtime 与 Office 载荷处理。保留的 pnpm 路径是 `resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs`；其存在不表示 shell 启动会安装 Office 或 Agent 服务。打包输入与输出依赖仍需完成计划中的载荷及发行闭包清理；不能将当前安装包宣传为最小纯底座包。

安装与发行操作请使用仍维护的所属参考文档。它们描述保留的基础设施，不保证其他文档所述的每项产品集成都在 shell 中激活：

- [Desktop 打包](packaging/README.zh.md)：本地构建输入、目标选择、产物、签名集成与运行时检查。
- [Windows 签名](windows-signing/README.zh.md)：工具链、凭据、已接受的隔离限制与 runner 维护。
- [Desktop 发布](publishing/README.zh.md)：产物上传、发布标识与发布恢复。

保留的 Windows 安装程序仅面向当前用户，在解压或替换应用前校验安装路径。签名、载荷完整性、目标架构与替换/回滚检查仍是发行要求。从 Main 移除账号或更新桥不会退役这些安装检查，也不代表新的最小发行包已完成验收。

<a id="known-limitations"></a>
## 已知限制

- 原生启动与 profile 归属仅面向 shell，但生成的开发项目和打包依赖/载荷闭包仍更广。载荷清理与最终发行验证尚待完成。
- 安装版终端命令管理、CLI 能力与打包资源各有独立生命周期；它们继续存在不等于自动恢复产品启动。
- 单元测试覆盖 profile 保留、隔离开发身份与启动/清理决策。真实 Electron、目标平台原生签名与打包资源检查仍是独立证据；仅源码重构不足以完成发行验收。

<a id="dev-note"></a>
## 开发备注

[Desktop Host](../desktop-host/README.zh.md)持有 profile 进程生命周期；[shell bundle](../../packages/bundle/shell-base/README.zh.md)持有组合。将账号、Session、Agent、Office 与 updater 行为留在 Electron 启动路径之外。
