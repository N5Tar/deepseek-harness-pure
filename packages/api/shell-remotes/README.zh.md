---
description: "为不含完整业务 API 组合的外壳提供设置和凭证管理 Remote 方法。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-api-shell-remotes`

[English](README.md) | 中文

## 摘要

此插件让独立外壳通过 Host 配置 API 读取和保存偏好，无需加载完整业务 API 组合。它包含设置和凭证管理方法，但不包含 Session、Agent、模型、账户或任务命名空间。Host 必须另行提供配置服务和设置通知。

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

[shell-base 组合](../../bundle/shell-base/README.zh.md)将此插件与 Gateway、设置控制器及本地设置提供者一起挂载。它不接受插件配置。不要将其与完整 Remote 组合同时挂载：两者选择相同的配置命名空间。

Client 入口需要 `remote` 服务。Host 标记不执行业务工作；模块发现通过正常的双入口包机制发布其浏览器入口。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

[Client 入口](src/client/index.ts)挂载设置控制器的生成贡献并返回撤销函数。[事件类型](src/types.ts)选择设置失效通知。shell-base Host 拥有该通知的流和真实配置提供者；此包不模拟缺失服务。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Gateway](../gateway/README.zh.md)——方法分发与认证流。
- [设置控制器](../settings-controller/README.zh.md)——配置读写。
- Web Client——模块发现与激活。

<a id="model-experience"></a>
## 模型体验

无模型可见影响。此插件安装浏览器 Remote 方法，而非模型工具或提示词段落。

## 已知限制与待办工作

<a id="known-limitations-and-deferred-work"></a>

生成的 settings-controller 贡献也包含凭证管理方法。此插件不拆分该现有所有者，也不为已安装代码提供权限沙箱。额外业务 API 需要显式修改组合。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
