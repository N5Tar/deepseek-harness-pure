---
description: "私有 Desktop Host 组合、认证就绪和关闭行为。"
---

# Desktop Host

[English](README.md) | 中文

## 摘要

Desktop Host 是 Electron 启动的私有 Node 进程。它通过共享 profile 启动器引导所选私有 profile，通过 IPC 发布认证就绪信息，并在确认关闭前释放 Cordis 树。它不是独立应用入口。

## 目录

- [Host 组合](#host-composition)
- [生命周期与控制](#lifecycle-and-control)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="host-composition"></a>
## Host 组合

Host 仅运行包含独立 shell 组合的私有 `desktop` profile。它使用空参数列表调用 app-boot 的已解析 profile 启动器，并以自身包而非产品 CLI 为运行时解析锚点。Electron 负责私有 profile 目录和依赖安装。

Host 不安装 Agent 任务控制、账户发布者、Office 提供者或 Session 文件解析器。其私有协议包含启动身份、认证就绪、致命诊断、插件操作记录、关闭与关闭确认；产品任务检查和文件拖拽消息不属于此协议。

<a id="lifecycle-and-control"></a>
## 生命周期与控制

Host 保留操作诊断、带认证的就绪信息和有界 Cordis 关闭。Electron 通过关闭确认与子进程退出状态验证成功释放；失败或强制停止不算正常完成。

Host 在分发前校验私有消息字段。关闭等待 profile 释放后再确认完成。启动期间收到关闭请求会抑制就绪消息。启动失败保留诊断 IPC 报告和非零退出状态。

<a id="verification"></a>
## 验证

无需密钥的[已构建 Host 测试](../desktop/tests/shell-host.e2e.ts)使用私有临时 home 和已移除的产品 CLI 链接检查就绪、真实服务缺席、设置持久化、正常重启和致命配置错误诊断。测试要求已构建产物，不打开 Electron 或联系模型。[隔离测试](tests/dependency-isolation.spec.ts)拒绝产品依赖及过时的源码入口。

<a id="dev-note"></a>
## 开发备注

[Desktop 应用](../desktop/README.zh.md)负责 profile 选择、恢复和环境传递。
