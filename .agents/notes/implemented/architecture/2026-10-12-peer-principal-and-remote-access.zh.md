# Agent Note: Peer principal 与显式调用方身份

Status: implemented

[English](2026-10-12-peer-principal-and-remote-access.md) | 中文

## 问题

Remote 调用需要请求体无法伪造的身份，以及承载流和注册的生命周期。隐式 owner Peer 会让遗漏调用方身份的调用悄悄获得 owner 权限。把身份放在 Peer 之外，还会让准入与分派对调用代表谁产生分歧。

## 决策

### 身份与生命周期

`PeerScope.principal` 标识调用方；`peer.ctx` 承载连接期效果，`peer.signal` 在作用域结束时中止。一个 principal 可以对应多个 Peer。Host 进程内代码在创建 Peer 时确定 principal；参数、envelope 字段、header、query 或 cookie 都不能覆盖该 principal。认证选择 Peer，而不是接受 wire 提交的 principal。

`PrincipalMap` 可经声明合并扩展，内置身份为 `{ kind: 'owner' }`。每个条目都是具有唯一字面量 kind 的 JSON 值，且不得包含凭据，因为它可能被持久化。未知 kind 永远不是 owner。Remote 方法内的身份读取点为 `this.ctx.invocation.peer.principal`；`principalOf(invocation)` 返回非 owner principal，对 owner 以及 Remote invocation 外的受信任进程内代码返回 `undefined`。

[Connection](../../../../packages/client/connection/README.zh.md#browser-authentication-and-request-trust) 拥有唯一的 `Peer` 实现与准入。通过认证的浏览器连接共享 `connection.browserPeer`；API 连接经 `/connect` 获得独立的 owner Peer。进程内调用方使用 `connection.createPeer({ principal, interactions? })`；每个 Peer 随读取 Connection 的 Context 释放，也可提前调用 `dispose()`。Gateway 和 Fetch handler 都不提供隐式 Peer：`invoke`、`wireStream.open`、`fetch(request, peer)` 及 HTTP bridge 均要求显式传入。

释放会拒绝后续调用，并通过 Peer signal 结束 Remote 流；已经运行的 unary 调用不会仅因 Peer 释放而被取消。共享浏览器身份不区分各个标签页。创建方拥有 principal 与各 Peer 之间的关联，并负责在终止相应生命周期时释放 Peer。

### 仅 owner 分派

[桌面底座退役决策](../../../../docs/experiments/pure-desktop-base/REMOVAL-PLAN.tmp.md#第-03-项后续退役细粒度授权与文件操作) 移除方法/资源 RBAC、访问快照、access Hook 与 LiveShare。这些机制不是受支持的扩展点。上述身份与生命周期规则仍然适用；保留 `PrincipalMap` 不授予非 owner 访问权。

[Gateway](../../../../packages/api/gateway/README.zh.md#host-service-typertgatewayservice-ctx-key-typertgateway) 在解析 payload、解析 descriptor、lookup、Context 解析或激活 handler 之前要求存活的 owner Peer。已释放的 Peer 返回 `gateway/peer-disposed`；其他非 owner 返回 `gateway/owner-required`，details 为 `{ endpoint }`。unary、stream、`$events` 与 `$events/result` 共用这一规则。exact Fetch route 对非 owner Peer 返回 HTTP 403。Connection 认证与 Host/Origin 检查仍是独立要求。

`interactions` 决定参与方式，不决定身份或权限。`Peer` 与 `createPeer()` 默认取 `answer`；API `/connect` 默认取 `none`。即使 owner 取 `none`，也不能打开 `$events` 或提交 `$events/result`。只有回答型 owner 流计入 `hasLiveClient()`，事件回复必须属于原始流的同一个 Peer。

### 消息来源身份

`user-rpc` 消息来源的可选 `principal` 字段仍归生产方所有。Session Controller 与 subagent 的 prompt 生产方在构造 source 时读取 `principalOf(this.ctx.invocation)`，仅在有值时写入；不会经业务方法参数另外传递 principal。没有该字段的 source 表示 owner 输入。source 保持 `kind: 'user'`，因此既有用户消息读取方保留原判别字段；模型适配器不会把该字段作为模型内容接收。这不意味着非 owner prompt 可以经 Gateway 调用。

该 source 字段不要求新的 `SESSION_FORMAT_VERSION`；既有存储身份仍是数据，不是授权。日志与导出可能包含身份，因此 principal kind 不得包含凭据。TypeScript SDK 在 Gateway 外构造用户 source，两种 SDK 都不投影该字段。

## 考虑过的替代方案

**principal 与 Peer 作为并列 invocation 字段。** 两个分别提供的值可能不一致；准入必须在 Peer 上一次性确定身份。

**经 `peer.ctx` 私下附加身份。** 每个消费方都需要知道哪个插件附加了身份，准入也无法保证该附加信息存在。

**隐式默认 Peer。** 遗漏参数会悄悄变成 owner 权限。必填 Peer 参数在编译时暴露遗漏。

**请求体中的身份字段。** 能构造请求体的调用方就能伪造身份。

**按请求 id 关联的独立 `prompt/origin` 事件。** required 事件会让普通日志与旧读取方不兼容，需要关联 fold 和 prompt 串行化，并丢失 fold 窗口外的归属。生产方可以直接在其创建的消息上记录身份。

**新的消息来源 kind。** 每个既有 `kind === 'user'` 读取方都需要复核；遗漏的读取方可能让消息从标题、大纲、队列或聊天渲染中消失。

**lookup 解析后才检查访问。** lookup 可能激活 Agent，因此拒绝必须早于 lookup 与 Context 解析，以避免未授权副作用。

## 后果

身份、流生命周期和交互参与各有明确归属，不需要第二个调用方身份字段。仅 owner 分派明确放弃访客分享与逐资源授权；这一取舍由退役决策负责，而不是传输层中的宽松回退。

Gateway 测试覆盖非 owner 拒绝、已释放 Peer、显式调用方身份、伪造 wire 字段，以及 lookup 或 handler 产生效果前的拒绝。Connection 测试覆盖准入、独立 Peer 释放和 exact route 拒绝；protocol 测试覆盖 `principalOf`。消息生产方保留来源归属，不引入独立事件，也不为历史身份授予访问权。

[Remote 双向流](2026-09-19-remote-duplex-stream.zh.md) 负责 uplink 与 invocation 绑定；[浏览器 token 认证](2026-08-24-browser-token-authentication.zh.md) 负责认证后的 owner 准入；[Peer 作用域 connect](2026-10-09-operator-scoped-connect-handshake.zh.md) 负责 API 连接生命周期；[生产方拥有的消息来源](2026-09-09-producer-owned-message-sources.zh.md) 负责 source 构造。
已删除的资源读取器与 policy 接口、端点清单、访问快照语义，以及客户端跟随授权的注册机制，都不构成对这些保留机制的要求。
