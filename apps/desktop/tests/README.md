---
description: "Verification map for the session-free Desktop foundation, with source-test, built-Host, and release-evidence limits."
kind: "package-reference"
---

# Desktop foundation verification

English | [中文](README.zh.md)

## Summary

This directory verifies the native carrier, isolated preload, authenticated Host, shell profile, and recovery. Source tests and a built-Host acceptance test exercise different layers. They do not establish a dependency-minimal installer or replace real Electron and cross-platform release qualification. Product account, Welcome, update-dialog, and Agent-task scenarios are not acceptance criteria for the shell foundation.

## Table of Contents

- [Source-level coverage](#source-level-coverage)
- [Built Host acceptance](#built-host-acceptance)
- [Focused checks](#focused-checks)
- [Failure and recovery checks](#failure-and-recovery-checks)
- [Evidence limits](#evidence-limits)

<a id="source-level-coverage"></a>
## Source-level coverage

| Owner | Covered behavior | Evidence limit |
|---|---|---|
| [Main startup](main-startup.spec.ts) | Application startup, native menu and window decisions, owned-renderer IPC, backend coordination, and quit/recovery wiring. | Electron and Host adapters are test doubles; this does not show a real visible window. |
| [Application preload](preload-app.spec.ts) | Boot and directory-picker APIs only on the local application main frame; constrained shortcut operations and subscription release. | jsdom and mocked Electron IPC do not validate a packaged preload bundle. |
| [Web document](web-document.spec.ts) | Local document serving, Host authentication, and HTTP forwarding behavior. | Request/response checks are separate from real Electron WebSocket and browser-session behavior. |
| [Host process](host-process.spec.ts) | Ready URL, process lifetime, bounded diagnostics, operation IPC, fatal reporting, and graceful shutdown. | Fixture children test the process controller, not the complete shell composition. |
| [Backend controller](backend-controller.spec.ts) | Startup, shutdown, failure, and owned-backend coordination. | Controller tests do not replace a real process acceptance test. |
| [Profile manager](project-manager.spec.ts) | Shell-base initialization/recovery, installed-file preservation, locks, and refusal to rewrite incompatible product profiles. | Temporary filesystem fixtures do not migrate or qualify existing user data. |
| [Development project](development-project.spec.ts) and [development app](development-app.spec.ts) | Workspace dependency projection, isolated shell identity, literal cold-start paths, and runtime metadata. | Generated fixtures do not certify target-native signing or a full interactive development launch. |
| [Fatal recovery](fatal-recovery.spec.ts) | First-failure ownership, report deadlines, localized recovery choices, report retrieval, and cleanup failures. | Mocked native dialogs establish control flow and copy, not window focus or visual acceptance. |
| [Crash reports](crash-report.spec.ts) and [report Worker](operation-report-job.spec.ts) | Bounded diagnostic output, report persistence, cancellation, and Worker completion. | These checks cannot reproduce every kernel or filesystem stall. |

Shell settings persistence is exercised through the actual settings Remote in the built-Host acceptance test below. Retained standalone settings, signing, installer, or updater-library suites test their own libraries only; their presence does not mean that the corresponding product UI or native bridge is installed by Main.

<a id="built-host-acceptance"></a>
## Built Host acceptance

[The shell Host acceptance test](shell-host.e2e.ts) requires current built workspace artifacts. It creates private home and profile directories, launches the real private Host, and removes the fixture's CLI link so startup must use the Host's own installation anchor. It does not open Electron or call a model API.

The test inspects the real service store rather than supplying empty business services. It checks that the shell composition starts without Agent, Session, LLM, job, product session-controller, account, or workspace-dependency services; authenticates settings RPC; writes a locale preference and reads it after a graceful restart; and checks that no primary runtime is installed. A malformed profile patch exercises the real startup diagnostic path.

Passing this test establishes the tested Node Host composition, not a real native window, target-specific Electron binary, installer, or release dependency closure. Rebuild affected artifacts before running it; stale output cannot validate current source changes.

<a id="focused-checks"></a>
## Focused checks

Choose the tests for the changed owner and run them with a bounded local worker count. For profile and development changes, the source-only check is:

```sh
node node_modules/vitest/vitest.mjs run apps/desktop/tests/project-manager.spec.ts apps/desktop/tests/development-app.spec.ts apps/desktop/tests/development-project.spec.ts --maxWorkers=1
```

Main/preload, HTTP authentication, Host process, and fatal-recovery changes require their corresponding suites from the table, not only this profile command. A source-test result must not be relabeled as built-Host or Electron acceptance. Record the exact command, source revision, failures, and platform skips in the current change report; historical pass counts are not current evidence.

<a id="failure-and-recovery-checks"></a>
## Failure and recovery checks

Use a disposable shell profile and separate Electron `userData` for real-application checks. Exercise a required shell plugin import failure, initialization failure, an asynchronous fatal error, and unexpected Host exit. Do not remove Agent or model services as a missing-service probe: they are deliberately absent from this composition.

Verify the original error and process identity, diagnostic persistence and omission notices, the native report action, and successful startup after an allowed recovery. Profile incompatibility must fail without changing the existing manifest, patch, package-manager settings, or lockfile; use a separate home instead of treating recovery as a product-data conversion.

For quit and restart, check that the owned Host stops and that diagnostic cleanup remains bounded, without querying product task services. Check actual client readiness and window visibility separately from Host readiness. Clean up all owned child processes and temporary profiles, and preserve unrelated user state. The [recovery reference](../docs/diagnostics/README.md) owns behavior and report limits.

<a id="evidence-limits"></a>
## Evidence limits

- Real Electron window presentation, native menus, focus, tray behavior, and sandboxed preload loading need platform-specific application runs; mocked adapter tests do not provide that evidence.
- Windows and macOS signing, installation, replacement/rollback, startup after installation, and preservation of real data remain release qualification work. Any retained updater/signature helper tests are only tool-library verification, not evidence of active application update functionality.
- Source isolation and absence of business services do not establish a minimal package set. Primary-runtime/native payload cleanup and final dependency-closure checks are separate, unfinished release work.
- A failed or skipped check remains visible in the current report. This reference lists test responsibilities and limits, not a standing certification that all suites or platforms pass.
