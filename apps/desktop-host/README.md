---
description: "Private Desktop Host process modes, authenticated readiness, and shutdown behavior."
---

# Desktop Host

English | [中文](README.zh.md)

## Summary

Desktop Host is the private Node process launched by Electron. It boots the selected private profile through the shared profile runner, publishes authenticated readiness over IPC, and disposes the Cordis tree before acknowledging shutdown. It is not a standalone application entry point.

## Table of Contents

- [Launch modes](#launch-modes)
- [Lifecycle and control](#lifecycle-and-control)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="launch-modes"></a>
## Launch modes

Electron supplies `DSH_DESKTOP_MODE` across the process boundary. An absent value selects `product`; the only accepted explicit values are `product` and `shell`. Invalid values fail before profile boot. Mode never follows account state or missing services.

Both modes use profile name `desktop` and the launcher-resolved private profile directory. Product mode passes the existing Web startup arguments and installs Office dependency resolution, Office providers, account-session publication, and Agent task inspection. Shell mode passes no Web arguments and omits these integrations; its profile must contain the independent shell composition.

Shell mode does not require the primary Office payload. This runtime distinction does not remove product dependencies from the application package or establish a separately packaged desktop distribution.

<a id="lifecycle-and-control"></a>
## Lifecycle and control

Both modes keep operation diagnostics, authenticated Host readiness, and ordinary Cordis shutdown. Shell quit inspection reports no Agent or scheduled tasks by explicit mode policy, without creating placeholder services. Product update-task control and session-file drag requests return an unsupported error in shell mode rather than silently succeeding.

The Host validates private message fields before dispatch. Shutdown cancels admitted drag reads, awaits their tasks and profile shutdown, then acknowledges completion. Product-mode behavior remains owned by its task, Office, and account modules.

<a id="verification"></a>
## Verification

[Mode tests](tests/launch-mode.spec.ts) cover absent, supported, and malformed environment values. The keyless [built Host test](../desktop/tests/shell-host.e2e.ts) uses a private temporary home, a shell profile, and an absent Office payload to check readiness, real service absence, unsupported operations, settings persistence, and graceful restart. It requires built artifacts and does not open Electron or contact a model.

<a id="dev-note"></a>
## Dev Note

The [Desktop application](../desktop/README.md) owns profile selection, recovery, and environment propagation. Do not infer a launch mode inside a business provider.
