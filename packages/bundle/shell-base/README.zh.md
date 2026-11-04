---
description: "提供持久化外观设置的认证浏览器外壳，默认不含 Agent、Session、模型或账户业务服务。"
kind: "package-bundle"
---

# `@deepseek-ai/dsh-shell-base`

[English](README.md) | 中文

## 摘要

此独立 bundle 提供带认证的浏览器外壳以及语言和外观偏好。其显式白名单不包含完整 base 和 Web 应用 bundle、Agent 执行、Session、模型配置、账户引导与遥测。它用于隔离的 profile，而非完整产品之上的附加层。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

通过 [profile 机制](../../boot/app-boot/README.zh.md)将此 bundle 选为 profile 的完整 bundle 列表。不要将它与完整 base 或 Web bundle 叠加。将 profile 和 Harness home 与现有产品数据隔离。

[补丁](cordis.patch.yml)绑定回环地址及操作系统分配的端口。运行时仅在启动器就绪后发布带认证的 URL，且不会自动打开浏览器。认证仍使用托管本地凭证；缺少账户业务服务不代表移除浏览器访问检查。

Profile 覆盖会替换条目的完整配置。外观和语言偏好通过 profile 设置文档持久化。默认 Root 由 [ui-shell](../../client/ui-shell/README.zh.md) 提供。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

[Host 运行时](src/index.ts)挂载带认证的前端资源和仅限设置的事件源。[Shell remotes](../../api/shell-remotes/README.zh.md) 安装 Client 配置命名空间。现有设置表单、语言、主题、模块载体和渲染器仍是独立插件；不会用占位 Agent 或 Session 服务满足其依赖。

无需密钥的[组合测试](tests/composition.e2e.ts)要求已构建 Client bundle 和前端资源，再通过真实 Loader 启动白名单，检查认证、下发模块图、激活失败及业务服务缺席；缺少产物会失败而非跳过。[事件测试](tests/settings-events.spec.ts)覆盖取消和设置失效通知合并。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [应用组合](../../../docs/architecture.zh.md)——profile 与有序 bundle 层。
- [纯净桌面计划](../../../docs/experiments/pure-desktop-base/PLAN.zh.md)——实施范围与验收条件。

<a id="model-experience"></a>
## 模型体验

无模型可见影响。此 bundle 不注册模型工具、提示词段落或 Agent 执行服务。

## 已知限制与待办工作

<a id="known-limitations-and-deferred-work"></a>

此 bundle 本身不会适配 Electron 载体、提供插件管理 UI 或从共享前端产物中移除业务代码。桌面生命周期、恢复和发行隔离需要单独验证。默认 Shell 是静态 Root，不是完整的设置应用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

安装和桌面验证属于隔离 profile 集成工作；此包本身不确立已安装 profile 或发行保证。

</details>
