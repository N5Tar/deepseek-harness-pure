---
description: "构建支持本地化内容和主题的无会话插件应用。"
kind: package-reference
---

# 无会话应用底座

[English](README.md) | 中文

## 概述

构建不包含对话、侧边栏、Session 或 Agent 的插件应用。通过 root 作用域的扩展位置添加内容，并在标题栏设置面板中选择主题和语言。此底座不提供模型或 Session 设置，也不提供插件管理器。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用此包

组合时用 `@deepseek-ai/dsh-client-ui-shell` 替代 `ui-layout`，并提供 `slots`、`locale` 和 `theme` 服务。插件没有配置字段或 Host 行为。它占据内建 `root`，并声明 root 作用域的列表 `shell.content`。内容插件通过 `ctx.slots.inject('shell.content', ...)` 注册唯一的列表 id。移除根节点会移除其子插槽声明和贡献。卸载唯一占用者之前，应停止渲染或替换根节点。

框架提供中英文文案、带有 160px 水平原生控件避让的 56px 可拖拽标题带、可滚动的主区域，以及 Desktop 原生菜单适配器所需的 `data-shell-overlay` 标记。标题带使用共享的 `data-window-drag` 规则；inert 背景不贡献拖拽区域。控件使用中性细线边框和共享焦点环 token，抬升的设置面板同时重绑两种滚动条颜色。不要激活另一个声明相同子插槽的根节点所有者。

设置按钮打开模态面板，提供跟随系统、浅色和深色主题偏好，以及 locale 服务注册的语言。变更调用 `theme.setTheme` 和 `locale.setLocale`；这些服务通过 Host settings 负责持久化。底座不创建设置命名空间、Remote 端点或 local-storage 偏好。可通过按钮、Escape 或遮罩关闭；焦点返回打开面板的按钮，面板打开期间背景保持 inert。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节</summary>

[注册入口](src/client/index.ts) 通过可撤销的 Cordis effect 管理根节点、字典和文档主题投射。[呈现器](src/client/theme.ts) 应用解析后的调色板、token 覆盖和字号；卸载时恢复先前的文档值。[组件](src/client/Shell.tsx) 通过渲染器绑定的 hook 读取主题和语言快照，通过注入的服务回调写入。共享的 `useModalLayer` 原语负责 Escape、Tab 焦点限制及焦点恢复；React 卸载会释放其 document 监听和 portal DOM。

</details>

<a id="model-experience"></a>
## 模型体验

无；此包不添加模型消息、工具或提示词 token。

#### KV 缓存影响

无；此包不构造或发送模型请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

底座有意仅提供有限的内容扩展：

- 根节点仅暴露 `shell.content`，不提供对话布局的子插槽或 `layout` 服务。
- 主题字体族偏好尚未投射。
- 原生窗口行为和明暗主题渲染已在组合后的 Electron 窗口中验证；本包的测试覆盖注册与交互，不覆盖每个平台的视觉结果。
- 此处只随附英文和中文词典。其他已注册语言会出现在面板中，但在插件注册对应词典之前回退到英文。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景</summary>

无。

</details>
