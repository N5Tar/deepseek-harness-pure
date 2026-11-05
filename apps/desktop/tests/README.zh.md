---
description: "不依赖会话的 Desktop 底座验证地图，说明源码测试、构建后 Host 与发行证据的边界。"
kind: "package-reference"
---

# Desktop 底座验证

[English](README.md) | 中文

## 概述

本目录验证原生载体、隔离 preload、经过认证的 Host、shell profile 与恢复。源码测试和构建后 Host 验收分别覆盖不同层次。它们不代表依赖最小化的安装包已验证，也不能替代真实 Electron 和跨平台发行验收。产品账号、Welcome、更新弹窗与 Agent 任务场景不是 shell 底座的验收标准。

## 目录

- [源码层覆盖](#source-level-coverage)
- [构建后 Host 验收](#built-host-acceptance)
- [聚焦检查](#focused-checks)
- [失败与恢复检查](#failure-and-recovery-checks)
- [证据边界](#evidence-limits)

<a id="source-level-coverage"></a>
## 源码层覆盖

| 所有者 | 覆盖行为 | 证据边界 |
|---|---|---|
| [Main 启动](main-startup.spec.ts) | 应用启动、原生菜单与窗口决策、所属渲染器 IPC、backend 协调及退出/恢复接线。 | Electron 与 Host 适配器是测试替身；不展示真实可见窗口。 |
| [应用 preload](preload-app.spec.ts) | 只在本地应用主 frame 暴露 boot 和目录选择 API；受限快捷键操作与订阅释放。 | jsdom 与模拟 Electron IPC 不验证打包后的 preload bundle。 |
| [Web 文档](web-document.spec.ts) | 本地文档交付、Host 认证与 HTTP 转发行为。 | 请求/响应检查不同于真实 Electron WebSocket 与浏览器 session 行为。 |
| [Host 进程](host-process.spec.ts) | 就绪 URL、进程生命周期、有界诊断、操作 IPC、fatal 报告与优雅关闭。 | 夹具子进程验证进程控制器，不验证完整 shell 组合。 |
| [Backend 控制器](backend-controller.spec.ts) | 启动、关闭、失败及所属 backend 协调。 | 控制器测试不替代真实进程验收。 |
| [Profile 管理器](project-manager.spec.ts) | Shell-base 初始化/恢复、已安装文件保留、锁，以及拒绝改写不兼容产品 profile。 | 临时文件系统夹具不迁移或验收已有用户数据。 |
| [开发项目](development-project.spec.ts)与[开发应用](development-app.spec.ts) | 工作区依赖投影、隔离 shell 身份、冷启动字面路径与运行时元数据。 | 生成的夹具不认证目标平台原生签名或完整交互式开发启动。 |
| [Fatal 恢复](fatal-recovery.spec.ts) | 首次失败归属、报告期限、本地化恢复选项、报告获取与清理失败。 | 模拟原生弹窗验证控制流和文案，不验证窗口焦点或视觉效果。 |
| [崩溃报告](crash-report.spec.ts)与[报告 Worker](operation-report-job.spec.ts) | 有界诊断输出、报告持久化、取消与 Worker 完成。 | 这些检查不能复现所有内核或文件系统停滞。 |

下述构建后 Host 验收通过真实 settings Remote 验证 shell 设置持久化。保留的独立 settings、签名、安装器或 updater 库测试只验证各自库；它们存在不表示 Main 安装了对应产品 UI 或原生桥。

<a id="built-host-acceptance"></a>
## 构建后 Host 验收

[Shell Host 验收测试](shell-host.e2e.ts)需要当前已构建的工作区产物。它创建私有 home 与 profile 目录，启动真实私有 Host，并删除夹具中的 CLI 链接，使启动必须使用 Host 自身的安装锚点。它不打开 Electron，也不调用模型 API。

测试检查真实服务存储，不提供空业务服务。它验证 shell 组合不依赖 Agent、Session、LLM、job、产品 session-controller、账号或工作区依赖服务即可启动；认证 settings RPC；写入语言偏好并在优雅重启后读取；检查没有安装 primary runtime。损坏的 profile patch 覆盖真实启动诊断路径。

此测试通过只能证明受测的 Node Host 组合，不能证明真实原生窗口、目标平台 Electron 二进制、安装器或发行依赖闭包。运行前应重建受影响产物；过时输出不能验证当前源码变化。

<a id="focused-checks"></a>
## 聚焦检查

按变更所属模块选择测试，并限制本地 worker 数量。Profile 与开发启动变更的纯源码检查为：

```sh
node node_modules/vitest/vitest.mjs run apps/desktop/tests/project-manager.spec.ts apps/desktop/tests/development-app.spec.ts apps/desktop/tests/development-project.spec.ts --maxWorkers=1
```

Main/preload、HTTP 认证、Host 进程与 fatal 恢复变更需要运行表中对应套件，不能只运行此 profile 命令。不得将源码测试结果改称构建后 Host 或 Electron 验收。在当前变更报告中记录准确命令、源码版本、失败与平台跳过项；历史通过数量不是当前证据。

<a id="failure-and-recovery-checks"></a>
## 失败与恢复检查

真实应用检查使用可丢弃的 shell profile 和独立 Electron `userData`。覆盖必需 shell 插件导入失败、初始化失败、异步 fatal 错误及 Host 意外退出。不要通过移除 Agent 或模型服务探测缺失服务：此组合刻意不包含它们。

验证原始错误与进程身份、诊断持久化和遗漏提示、原生报告操作，以及允许的恢复后能成功启动。Profile 不兼容必须失败，且不改变现有 manifest、patch、包管理器设置或 lockfile；应使用独立 home，而非把恢复当作产品数据转换。

退出与重启需要检查所属 Host 已停止，诊断清理仍有界，且不查询产品任务服务。实际客户端就绪与窗口可见性应独立于 Host 就绪检查。清理所有所属子进程和临时 profile，保留无关用户状态。[恢复参考](../docs/diagnostics/README.zh.md)维护行为与报告限制。

<a id="evidence-limits"></a>
## 证据边界

- 真实 Electron 窗口展示、原生菜单、焦点、托盘行为及 sandboxed preload 加载需要平台应用运行；模拟适配器测试不提供这些证据。
- Windows 和 macOS 签名、安装、替换/回滚、安装后启动与真实数据保留仍是发行验收工作。保留的 updater/签名辅助测试只是工具库验证，不表示应用更新功能正在使用。
- 源码隔离和业务服务缺席不代表最小包集合已建立。Primary-runtime/原生载荷清理与最终依赖闭包检查是独立且尚未完成的发行工作。
- 失败或跳过的检查必须在当前报告中可见。本参考列出测试职责与限制，不长期认证所有套件或平台均通过。
