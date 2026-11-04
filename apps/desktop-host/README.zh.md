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

两种模式都使用 profile 名称 `desktop` 和启动器解析的私有 profile 目录。Product 模式传递现有 Web 启动参数，并安装 Office 依赖解析、Office 提供者、账户会话发布和 Agent 任务检查。Shell 模式不传 Web 参数且省略这些集成；其 profile 必须包含独立 shell 组合。

Shell 模式不要求主要 Office 载荷。此运行时区别不会从应用包移除产品依赖，也不代表已建立单独打包的桌面发行版。

<a id="lifecycle-and-control"></a>
## 生命周期与控制

两种模式都保留操作诊断、带认证的 Host 就绪信息和正常 Cordis 关闭。Shell 退出检查按显式模式策略报告没有 Agent 或计划任务，不创建占位服务。产品更新任务控制和会话文件拖拽请求在 shell 模式返回不支持错误，而非静默成功。

Host 在分发前校验私有消息字段。关闭会取消已接收的拖拽读取、等待其任务和 profile 关闭，然后确认完成。Product 模式行为仍由其任务、Office 和账户模块负责。

<a id="verification"></a>
## 验证

[模式测试](tests/launch-mode.spec.ts)覆盖缺省、支持和非法环境值。无需密钥的[已构建 Host 测试](../desktop/tests/shell-host.e2e.ts)使用私有临时 home、shell profile 和不存在的 Office 载荷检查就绪、真实服务缺席、不支持操作、设置持久化和正常重启。测试要求已构建产物，不打开 Electron 或联系模型。

<a id="dev-note"></a>
## 开发备注

[Desktop 应用](../desktop/README.zh.md)负责 profile 选择、恢复和环境传递。不要在业务提供者内推断启动模式。
