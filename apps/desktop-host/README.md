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

Both modes use profile name `desktop` and the launcher-resolved private profile directory. The Host calls app-boot's resolved-profile runner directly and anchors runtime resolution at its own package, not the product CLI. Product mode forwards legacy Web arguments; shell mode passes no arguments and requires the independent shell composition. Profile selection remains owned by Electron.

The Host installs no Agent task control, account publisher, Office provider, or Session file resolver and does not require the primary Office payload. The bundled product command bridge belongs to the CLI package. The Electron application and distribution still contain product components; this Host package does not define a complete standalone distribution.

<a id="lifecycle-and-control"></a>
## Lifecycle and control

The Host keeps operation diagnostics, authenticated readiness, and bounded Cordis shutdown. Shell quit inspection reports no Agent or scheduled tasks without creating placeholder services. A product-profile inspection reports unknown state as an error, so Electron asks before quitting. Update-task control and Session file-drag requests return unsupported errors in both modes.

The Host validates private message fields before dispatch. Shutdown awaits profile disposal before acknowledging completion. A shutdown request during startup suppresses readiness. Startup failures retain their diagnostic IPC report and nonzero exit status.

<a id="verification"></a>
## Verification

[Mode tests](tests/launch-mode.spec.ts) cover absent, supported, and malformed environment values. The keyless [built Host test](../desktop/tests/shell-host.e2e.ts) uses a private temporary home, a shell profile, an absent Office payload, and no product CLI link to check readiness, real service absence, unsupported operations, settings persistence, graceful restart, and fatal configuration diagnostics. It requires built artifacts and does not open Electron or contact a model.

<a id="dev-note"></a>
## Dev Note

The [Desktop application](../desktop/README.md) owns profile selection, recovery, and environment propagation. Do not infer a launch mode inside a business provider.
