---
description: "Private Desktop Host composition, authenticated readiness, and shutdown behavior."
---

# Desktop Host

English | [中文](README.zh.md)

## Summary

Desktop Host is the private Node process launched by Electron. It boots the selected private profile through the shared profile runner, publishes authenticated readiness over IPC, and disposes the Cordis tree before acknowledging shutdown. It is not a standalone application entry point.

## Table of Contents

- [Host composition](#host-composition)
- [Lifecycle and control](#lifecycle-and-control)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="host-composition"></a>
## Host composition

The Host runs only the private `desktop` profile containing the independent shell composition. It calls app-boot's resolved-profile runner with an empty argument list and anchors runtime resolution at its own package, not the product CLI. Electron owns the private profile directory and dependency installation.

The Host installs no Agent task control, account publisher, Office provider, or Session file resolver. Its private protocol contains startup identity, authenticated readiness, fatal diagnostics, plugin-operation records, shutdown, and shutdown acknowledgement; product task-inspection and file-drag messages are not part of the protocol.

<a id="lifecycle-and-control"></a>
## Lifecycle and control

The Host keeps operation diagnostics, authenticated readiness, and bounded Cordis shutdown. Electron verifies successful teardown using the shutdown acknowledgement and child exit status; a failed or forced stop does not count as graceful completion.

The Host validates private message fields before dispatch. Shutdown awaits profile disposal before acknowledging completion. A shutdown request during startup suppresses readiness. Startup failures retain their diagnostic IPC report and nonzero exit status.

<a id="verification"></a>
## Verification

The keyless [built Host test](../desktop/tests/shell-host.e2e.ts) uses a private temporary home and no product CLI link to check readiness, real service absence, settings persistence, graceful restart, and fatal configuration diagnostics. It requires built artifacts and does not open Electron or contact a model. [Isolation tests](tests/dependency-isolation.spec.ts) reject product dependencies and obsolete source entrypoints.

<a id="dev-note"></a>
## Dev Note

The [Desktop application](../desktop/README.md) owns profile selection, recovery, and environment propagation.
