---
description: "面向用户与维护者的事件溯源会话日志与内存存储说明，用于构建、检查或扩展每个 agent（智能体）交互背后的持久记录。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session

[English](README.md) | 中文

## 概述

`dsh-session` 在仅追加的会话日志中记录每个模型可见事实，并从该记录派生模型历史。消费方可以检查、回放、fork 和刷新会话，同时保留历史事件；压缩（compaction）会在活跃对话中隐藏被取代的条目，但不会删除它们。除非添加持久化后端，否则会话仅保留在内存中；持久性检查点会等待配置的后端。agent 需要可重建的会话记录时请选择本包；它本身不调用模型。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在必须存在会话的任何地方挂载 `dsh-session`。它在内存中创建并持有事件溯源的 `Session` 实例；持久存储由订阅 `session/event` 流的持久化插件叠加。 Typert 挂载时，存储按 Session id 提供在线 Session 查找；Remote 准入由 Gateway 负责。

### 创建与检查会话

`ctx.sessions.create()` 构建绑定到调用方 fiber 的实时会话；`get(id)` 与 `list()` 查找会话，`fork()` 从实时会话的精确前缀创建独立会话。它复制历史、`cwd`、`isSeeded` 和继承事件数，不记录来源关系。`parentSession` 记录子代理的直接创建者；历史普通 fork 可能仍在此字段保留来源，因此分类使用 `origin`。

独立的 `Session.create()` 和 `Session.fromRestore()` 实例接受事件和插件记录，但不发送 `session/event`。`SessionStore` 通过 `prepare()` 或 `enter()` 接管实例；此后只有实例仍在 Store 中且同步 `session/created` 宣告已完成时才能写入。创建监听器只能读取，并能看到全部已有历史；独立实例进入 Store 时不会把已有历史重放为 `session/event`。宣告失败或移除后仍禁止写入。只有开始过 `session/created` 宣告的实例在移除时发出 `session/disposed`，宣告失败也不例外；进入 Store 但从未宣告的实例不发出这两个通知。

```text
const session = ctx.sessions.create(sessionId, { meta: { cwd: '/workspace' } })
ctx.sessions.get(sessionId)      // the live session
ctx.sessions.list()              // every live session, in creation order
```

### 追加与派生

`session.append(type, data, opts?)` 提交一个类型化事件。它在读取载荷字段前拒绝只读实例，为有效 JSON 创建快照并冻结，再次检查写入权限后提交并通知观察者。`session.deriveMessages()` 把日志投影为模型看到的 `Message[]`，采用增量且有缓存的方式：

```text
session.append('user/message', { role: 'user', content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } },
  { surfaceOp: 'append' })
session.deriveMessages()         // the derived model history
```

表层事件（`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`）在类型化事件与追加输入中都必须带有 `surfaceOp`。替换操作仅接受 `{ op: 'replace', startSeq, endSeq }`，端点为包含边界的 `SessionSeq`，按当前 surface 顺序解释。assistant 消息会嵌入精确、紧凑的提供方流，并禁止 `sourceEventSeqs`。已知仅日志事件禁止这两个元数据字段，且从不产生消息。

`developer/message` 存储工具添加名称，以及指向更早 `request/header` 的 `headerSeq` 引用。仅在存在添加块时必须携带该引用，每个名称必须在所引用的请求头中恰好对应一个完整模式。移除块仅记录工具名称，不携带请求头引用。重启、fork 和 surface 替换保留历史请求头；较早添加的定义不由当前注册表或最新请求头决定。`sourceEventSeqs` 继续描述派生来源及被替换节点。


追加、seed/restore 与事件 adoption/snapshot 会拒绝任何 `header.system` 及恰好为空的可选请求头字段（`tools: []`、`adapterDefaults: {}`），而不规范化输入。工具结果的 `data.error` 仅在一等消息的 `isError === true` 时允许存在；失败标识仍是可选的。被拒绝的追加不会改变日志、派生状态或事件流。Adoption 校验事件局部元数据，但不校验所引用的历史或替换端点是否属于 surface。


### 读取日志


会话日志位置使用两种数字类型。`SessionSeq` 标识已有事件或包含端点的事件水位；`SessionLogOffset` 标识间隙、前缀长度或读取边界，并且可以等于事件数量。`SessionSeqCursor` 添加 `-1` 这个“尚无事件”值，`OptionalSessionSeq` 则在缺失本身属于数据时使用 `null`。构造函数会校验非负安全整数，brand 在运行时会被擦除，因此持久 JSON 与 wire 值仍是普通数字。

<a id="write-experimental-plugin-records"></a>

### 写入实验性插件记录

`appendPluginRecord(session, type, data)` 为 `packages/experimental/` 下的包追加一条插件记录；`verify-plugin-record-callers` 检查拒绝本仓库中任何其他生产调用方。本仓库之外的插件同样不得调用它，尽管仓库检查无法检查它们。

在所属实验性包的 `src/` 中，通过 `@deepseek-ai/dsh-session/types` 的 `PluginRecordMap` 为每条记录声明描述与显式 payload 类型注解。名称使用 `plugin:<owner>/<record>`，其中 `owner` 是包名 `@deepseek-ai/dsh-experimental-<owner>` 的后缀；例如 `plugin:pi-extensions/entry`。TypeScript 按声明检查每个名称与 payload；写入方运行时的 JSON 快照拒绝无法无损保留的值。扩展自定义名称或其他动态名称放在已声明记录的 payload 中。

实验性持久化目录列出当前插件记录声明及其所属包、描述、payload 类型注解与源文件。这些声明与 `SessionEventMap`、展开的持久化 schema、已发布类型历史及 `KNOWN_SESSION_EVENT_TYPES` 分开。记录带有 `ignorable: true`：不认识某条记录的构建在读取时保留并跳过它。记录从不进入模型可见的 surface。resume 与 fork 随日志其余部分一起携带它们；Session 格式迁移以尽力而为的方式保留它们。


### 派生会话的 fork

`ctx.sessions.fork(source, boundary?, childSessionId?)` 从实时源会话复制包含切点的精确事件前缀（默认：最后一个事件）。`dsh-session/fork` 的 `buildForkSeed` 在复制事件之后放置继承标记，仅为开放步骤补缺失的错误工具结果，并以 `forked` 原因关闭步骤和轮次。已关闭的步骤与轮次保持原样，包括历史缺失结果。标记和结束事件属于子会话；`inheritedEventCount` 只统计复制的前缀。

逻辑 `SessionHeader.isSeeded` 字段报告是否存在 fork 历史，而不公开位置整数。`Session.inheritedEventCount` 保留经过校验的精确 `SessionLogOffset`；`ownEvents()` 返回从该切点开始的事件，`isOwnSeq(seq)` 只接受已存在且由子会话拥有的位置。底层带 seed 构造必须显式提供 `seed` 与 `inheritedEventCount`，因为构造 seed 可以在继承前缀之后包含子会话自有的设置事件。

### 刷新持久状态

`ctx.sessions.flush(session)` 分发需等待完成的持久性检查点：每个持久化监听器都会刷新，调用在所有监听器结算后完成。需要立即持久性屏障的生产方应等待它，而不是假定延后写入已经排空。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释该包如何实现上述行为；可观察约定已在[使用本包](#use-this-package)中完整说明。

### 设计理念

该包建立在事件溯源之上：`Session` 是类型化 `SessionEvent` 的仅追加日志，其他一切——模型历史、transcript（文本记录）、遥测、标题、持久化——都从这条流派生。surface 是派生投影：一个增量管理器校验追加候选、根据已提交事件推进有序视图，通过 `replaceGeneration` 跟踪位置替换，通过 `contentGeneration` 跟踪位置替换和插件拥有的消息变更。模型可见即已记录：任何到达模型请求的内容都必须能从日志重建。每个完成结算的模型尝试都会提交一个事件：`assistant/message` 携带组装后的模型可见 message 及其紧凑带时间 stream，`assistant/attempt` 则保留失败、重试、取消或 stream error attempt，且不添加模型历史。如果进程在 settlement 前硬中断，则不会留下持久 attempt stream。

### 请求头


### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`SessionStore` 服务、存储生命周期、`fork`、`flush` |
| [`src/types.ts`](src/types.ts) | `SessionEventMap`、`SessionEvent`、`UserMessage`、`SessionHeader`、`TurnEndReasonMap` |
| [`src/surface.ts`](src/surface.ts) | 有序 surface 投影、替换校验、`deriveEventMessage` |
| [`src/request-header.ts`](src/request-header.ts) | `request/header` 折叠与重建 |
| [`dsh-util-values`](../../util/values/README.zh.md) | 共享无损 JSON 校验与分离式快照 |
| [`src/repair.ts`](src/repair.ts) | 失败步骤、中断日志与 fork 种子共享的工具结果恢复 |

### 追加校验

每次追加都会使用共享的迭代式 `snapshotJsonValue()` 流程，对每个嵌套值只读取、校验并复制一次，因此有状态的 getter 无法给校验提供一个值、给存储提供另一个值。非无损 JSON 载荷（BigInt、循环、稀疏数组、`-0`、特殊原型）会在追加位置被拒绝，先于任何后端刷新。追加路径会构造每个 `SessionSeq`；surface 事件还会校验标记形态、被引用的源事件序号，以及替换的完整遮蔽节点覆盖。

### 共享恢复逻辑

`ToolCallRecovery` 从已提交事件中跟踪尚无结果的请求，不保留事件历史。AgentLoop 观察实时步骤；崩溃恢复与 fork 种子构造通过 `openTurnClosers` 回放各自的前缀。实时失败与崩溃恢复默认使用中断结果文案；fork 构造传入 fork 原因，以选择其专用的重试指引。调用方在关闭步骤之前追加恢复结果（参考）。

### 派生历史

`deriveMessages()` 缓存深度冻结的派生消息，每次调用返回新数组。surface 事件类型（`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`）提供记录的消息身份和内容，空内容的 system 和 developer 节点不派生消息。插件拥有的投影修改派生内容，不修改记录的消息。替换和投影决策使缓存失效。嵌入式 Assistant stream 与 `assistant/attempt` 事件只保留回放和诊断数据。普通提示与注入上下文在派生时不会按类型或来源自动添加包装。生产方负责记录内容中的所有框定格式。

### 请求头

循环在每个循环实例边界及变更时记录完整规范 `request/header` 快照（调用配置、适配器默认值、组装后的工具 schema——渲染后的系统提示词是 `system/message` surface 节点，不是 header 状态）；`foldRequestHeader(events)` 通过选择最新快照来重建它，使每个对话请求都成为日志的纯函数。路由元数据（`request/context`）是独立的已记录状态，仅在提供方、模型、容量或 `systemPromptUpdate` 模式变化时追加；它在提示词与用户消息准入之后记录实际已准备调用的模式，而非提供准入决策。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

包级约定对大多数消费方已经足够；需要周边领域时再阅读以下页面。

- 会话子系统——完整事件词汇、surface 类型与生成的服务 API。
- 持久化子系统——后端如何让该日志持久化。
- Core 子系统——写入并派生会话的循环。
- 生成持久化目录——每个会话事件及其载荷与声明位置。
- [core 分组地图](../README.zh.md)——core 各包如何组合。

-----

<a id="model-experience"></a>
## 模型体验

### 派生消息历史

#### 模型看到什么

模型会接收 `system/message`、`developer/message`、`user/message`、`assistant/message` 与 `tool/result` surface 条目中的消息，并应用日志中的投影，系统提示词在先。消息标识、角色、来源及未修改的内容块保持不变，投影不生成标识。直接提示词与注入上下文仍是独立的 `user/message` 事件，各事件的来源保留其出处。嵌入式 stream、`assistant/attempt`、边界与其他仅日志事实不添加消息。

#### Token 影响

追加的 surface 条目会在后续步骤中重新发送。`replace` surface 操作会从未来输入中移除被遮蔽条目，但不删除其原始日志记录。

#### KV Cache 影响

追加的 surface 条目会保留可复用前缀。即使底层事件日志保持仅追加，`replace` 操作也会从首条被遮蔽消息起使缓存复用失效。

### 工具结果恢复与 fork 结果

#### 模型看到什么

如果恢复发现 assistant 工具请求没有持久 `tool/call`，其合成 `TOOL_NOT_STARTED` 结果内容为 `The tool call was interrupted before the Harness recorded it as started. Retry it if it is still needed.`。如果持久 `tool/call` 没有结果，其 `TOOL_OUTCOME_UNKNOWN` 结果内容为 `The tool call was interrupted after it was recorded, but no result was durably recorded. Its outcome is unknown. Decide whether to retry from the tool semantics: retry only if the operation is read-only or idempotent; if it may have side effects, first verify external state or ask the user. Do not retry blindly.`。 Fork 生成的结果只描述继承记录：父会话可能已经在所选事件之后启动或完成调用。`TOOL_NOT_STARTED` 表示前缀中没有启动记录；`TOOL_OUTCOME_UNKNOWN` 表示有启动记录但没有结果。两者都要求模型仅对只读或幂等操作直接重试；有副作用的操作需要先验证外部状态或询问用户。参见 [fork 参考](src/fork.ts)。

#### Token 影响

未受损会话的 token 增量为零。每个修复后的调用都会向后续请求添加保留的、针对具体风险的错误文本。

#### KV Cache 影响

保持仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 已记录的请求头

#### 模型看到什么


#### Token 影响

日志记录不产生重复 token。各系统节点与 schema 仍会产生正常的逐请求开销。

#### KV Cache 影响

记录日志不会导致失效，精确重建会保持请求前缀一致。后续请求头若更改配置或 schema，可能从第一处差异开始使复用失效；替换 surface 第 0 号节点的提示词变更会从第一个 token 起使复用失效，而历史内追加则保持直到已缓存历史末尾的前缀可复用。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明会话存储何时需要特别留意。它们是当前包约束，不是任务积压。

- **Store API 仅接受活跃源会话** — 已持久化但未加载的源会话通过 Host 观察路径处理。Fork 仅闭合开放尾部，不修复先前已闭合步骤中缺失的结果。
- **`TurnEndReasonMap` 不含 ACP（Agent Client Protocol）命名的 `refusal`／`max_turn_requests` 变体**：受生产方约束；只有当适配器或循环首次产生这些变体时才加入。
- **fork 之外没有会话树**：基于分支会话的 pi 风格条目树被推迟，除非消费方需要超越基于边界的 forking 的能力。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
