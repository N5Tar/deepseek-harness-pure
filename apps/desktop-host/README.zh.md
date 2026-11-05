---
description: "私有 Desktop Host 进程模式、认证就绪和关闭行为。"
---

# Desktop Host

[English](README.md) | 中文

## 摘要

Desktop Host 是 Electron 启动的私有 Node 进程。它通过共享 profile 启动器引导所选私有 profile，通过 IPC 发布认证就绪信息，并在确认关闭前释放 Cordis 树。它不是独立应用入口。

## 目录

- [启动模式](#launch-modes)
- [生命周期与控制](#lifecycle-and-control)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="launch-modes"></a>
## 启动模式

Electron 通过进程边界传入 `DSH_DESKTOP_MODE`。缺省值选择 `product`；仅接受显式值 `product` 和 `shell`。无效值在 profile 引导前失败。模式不会由账户状态或缺少服务推断。

两种模式都使用 profile 名称 `desktop` 和启动器解析的私有 profile 目录。Host 直接调用 app-boot 的已解析 profile 启动器，并以自身包而非产品 CLI 为运行时解析锚点。Product 模式转发旧 Web 参数；shell 模式不传参数，要求独立 shell 组合。Profile 选择仍由 Electron 负责。

Host 不安装 Agent 任务控制、账户发布者、Office 提供者或 Session 文件解析器，也不要求主要 Office 载荷。随桌面分发的产品命令桥属于 CLI 包。Electron 应用及发行产物仍包含产品组件；此 Host 包不构成完整独立发行版。

<a id="lifecycle-and-control"></a>
## 生命周期与控制

Host 保留操作诊断、带认证的就绪信息和有界 Cordis 关闭。Shell 退出检查报告没有 Agent 或计划任务，不创建占位服务。产品 profile 的检查以错误报告未知状态，使 Electron 在退出前询问。更新任务控制与 Session 文件拖拽在两种模式中均返回不支持错误。

Host 在分发前校验私有消息字段。关闭等待 profile 释放后再确认完成。启动期间收到关闭请求会抑制就绪消息。启动失败保留诊断 IPC 报告和非零退出状态。

<a id="verification"></a>
## 验证

[模式测试](tests/launch-mode.spec.ts)覆盖缺省、支持和非法环境值。无需密钥的[已构建 Host 测试](../desktop/tests/shell-host.e2e.ts)使用私有临时 home、shell profile、不存在的 Office 载荷和已移除的产品 CLI 链接检查就绪、真实服务缺席、不支持操作、设置持久化、正常重启和致命配置错误诊断。测试要求已构建产物，不打开 Electron 或联系模型。

<a id="dev-note"></a>
## 开发备注

[Desktop 应用](../desktop/README.zh.md)负责 profile 选择、恢复和环境传递。不要在业务提供者内推断启动模式。
