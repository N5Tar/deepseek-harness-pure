# Agent Note: Peer principals and explicit caller identity

Status: implemented

English | [中文](2026-10-12-peer-principal-and-remote-access.zh.md)

## Problem

A Remote call needs an identity that its request body cannot forge and a lifetime that owns its streams and registrations. An implicit owner Peer makes an omitted caller identity silently acquire owner privileges. Keeping identity outside the Peer also lets admission and dispatch disagree about whom a call represents.

## Decision

### Identity and lifetime

`PeerScope.principal` identifies the caller; `peer.ctx` owns connection-lifetime effects and `peer.signal` aborts when that scope ends. One principal may have multiple Peers. In-process Host code fixes the principal at Peer creation; no argument, envelope field, header, query, or cookie can override that principal. Authentication selects a Peer rather than accepting a wire-supplied principal.

`PrincipalMap` is merge-extensible, with `{ kind: 'owner' }` as the built-in identity. Entries are JSON values with unique literal kinds and contain no credentials because they may be persisted. An unknown kind is never the owner. `this.ctx.invocation.peer.principal` is the identity read point inside a Remote method; `principalOf(invocation)` returns a non-owner principal, or `undefined` for the owner and trusted in-process code outside a Remote invocation.

[Connection](../../../../packages/client/connection/README.md#browser-authentication-and-request-trust) owns the sole `Peer` implementation and admission. Authenticated browser connections share `connection.browserPeer`; API connections obtain independent owner Peers through `/connect`. In-process callers use `connection.createPeer({ principal, interactions? })`; each Peer is released with the Context that read Connection, or earlier through `dispose()`. Neither Gateway nor a Fetch handler supplies an implicit Peer: `invoke`, `wireStream.open`, `fetch(request, peer)`, and the HTTP bridge require one explicitly.

Disposal refuses later calls and ends Remote streams through the Peer signal; an already-running unary call is not cancelled merely by Peer disposal. Shared browser identity does not distinguish individual tabs. The creator owns any association between a principal and its Peers and must dispose the relevant Peers when ending their lifetimes.

### Owner-only dispatch

The [desktop-base retirement decision](../../../../docs/experiments/pure-desktop-base/REMOVAL-PLAN.tmp.md#第-03-项后续退役细粒度授权与文件操作) removes method/resource RBAC, access snapshots, access Hooks, and LiveShare. Those mechanisms are not supported extension points. The identity and lifecycle rules above remain applicable; retaining `PrincipalMap` does not grant non-owner access.

[Gateway](../../../../packages/api/gateway/README.md#host-service-typertgatewayservice-ctx-key-typertgateway) requires a live owner Peer before payload parsing, descriptor resolution, lookup, Context resolution, or handler activation. A disposed Peer fails with `gateway/peer-disposed`; another non-owner fails with `gateway/owner-required` and details `{ endpoint }`. Unary calls, streams, `$events`, and `$events/result` share this rule. Exact Fetch routes reject non-owner Peers with HTTP 403. Connection authentication and Host/Origin checks remain separate requirements.

`interactions` governs participation, not identity or permission. `Peer` and `createPeer()` default it to `answer`; API `/connect` defaults it to `none`. Even an owner with `none` cannot open `$events` or submit `$events/result`. Only answering owner streams count toward `hasLiveClient()`, and event replies belong to the same Peer as their originating stream.

### Message-source identity

The optional `principal` field on a `user-rpc` message source remains producer-owned. Session Controller and subagent prompt producers read `principalOf(this.ctx.invocation)` when building the source and include it only when defined; they do not pass a separate principal through business method parameters. A source without the field denotes owner input. The source keeps `kind: 'user'`, so existing user-message readers retain their discriminator; model adapters do not receive the field as model content. This does not make a non-owner prompt callable through Gateway.

The source field does not require a new `SESSION_FORMAT_VERSION`; existing stored identities remain data rather than authorization grants. Logs and exports may contain identities, which is why principal kinds must contain no credentials. The TypeScript SDK constructs its user sources outside Gateway, and neither SDK projects this field.

## Alternatives considered

**Principal and Peer as parallel invocation fields.** Two separately supplied values can disagree; admission must establish identity once on the Peer.

**Identity attached privately through `peer.ctx`.** Every consumer would need to know which plugin attached it, and admission could not guarantee the attachment exists.

**An implicit default Peer.** A missing argument would silently become owner authority. Required Peer parameters expose the omission at compile time.

**Identity in a request-body field.** A caller able to construct the body could forge it.

**A separate `prompt/origin` event correlated by request id.** A required event would make ordinary logs incompatible with older readers, require a correlation fold and prompt serialization, and lose attribution outside the fold window. The producer can record identity directly on the message it creates.

**A new message-source kind.** Every existing `kind === 'user'` reader would need review; a missed reader could hide messages from titles, outlines, queues, or chat rendering.

**Checking access after lookup resolution.** A lookup can activate an Agent, so denial must precede lookup and Context resolution to avoid unauthorized side effects.

## Consequences

Identity, stream lifetime, and interaction participation have distinct owners without a second caller-identity field. Owner-only dispatch deliberately gives up guest sharing and per-resource grants; the retirement decision owns that trade-off, not a permissive fallback in transport.

Gateway tests cover non-owner rejection, disposed Peers, explicit caller identity, forged wire fields, and refusal before lookup or handler effects. Connection tests cover admission, independent Peer disposal, and exact-route refusal; protocol tests cover `principalOf`. Message producers retain source attribution without introducing a separate event or granting access to historical identities.

[Remote duplex streams](2026-09-19-remote-duplex-stream.md) own uplink and invocation binding; [browser token authentication](2026-08-24-browser-token-authentication.md) owns authenticated owner admission; [Peer-scoped connect](2026-10-09-operator-scoped-connect-handshake.md) owns API connection lifetime; [producer-owned message sources](2026-09-09-producer-owned-message-sources.md) own source construction.
Deleted resource-reader and policy interfaces, their endpoint inventories, access-snapshot semantics, and client grant-following registrations are not requirements on these retained mechanisms.
