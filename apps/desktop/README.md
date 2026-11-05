---
description: "Session-free Electron desktop foundation: authenticated Host startup, profile ownership, recovery, development, and remaining distribution dependencies."
kind: "package-reference"
---

# DeepSeek Harness Desktop

English | [中文](README.zh.md)

## Summary

Desktop is an Electron carrier for the standalone shell foundation. It starts one private Host, loads the shell client, and owns native windows, local authentication, profile preparation, and recovery. Startup does not select a product mode or require Sessions, Agents, model credentials, Welcome, account state, analytics, or update services. This runtime separation is not a dependency-minimal distribution: the existing CLI, package preparation, and native payloads still have a broader release closure.

## Table of Contents

- [Application overview](#application-overview)
- [Authentication and process ownership](#authentication-and-process-ownership)
- [Profiles and compatibility](#profiles-and-compatibility)
- [Closing the window and quitting](#closing-the-window-and-quitting)
- [Recovery and diagnostics](#recovery-and-diagnostics)
- [Develop](#develop)
- [Installation ownership](#installation-ownership)
- [Terminal command](#terminal-command)
- [Package](#package)
- [Known limitations](#known-limitations)
- [Dev Note](#dev-note)

<a id="application-overview"></a>
## Application overview

The [Electron main process](src/main.ts) starts the [private Desktop Host](../desktop-host/README.md) in Electron RunAsNode. The Host boots the reserved `desktop` profile through the shared application runner. Profile initialization, runtime-project metadata, and recovery all select [`@deepseek-ai/dsh-shell-base`](../../packages/bundle/shell-base/README.md); there is no alternate product composition.

The application loads packaged Web assets at `dsh-app://app/`. The loading document waits for authenticated Host readiness and boot injections, then starts the client without navigating to another document. The window becomes visible after Host startup. Settings persist through the shell Host; the native directory picker and keyboard integration remain available.

The shell records the appearance the owned renderer last applied in `.ff_theme` at the Harness home root and applies it before the first frame, so a launch paints the confirmed palette instead of the system one. A Harness home without that file is recorded as `dark`; an invalid or unreadable record falls back to `system` and reports the failure without blocking startup. The file only seeds native appearance and never overrides a stored choice: the appearance setting remains authoritative, and the owned renderer rewrites the record whenever an accepted change applies a new one.

The application menu retains About, command registration on macOS and Windows, DevTools, and Quit. Development also offers Reload Page and Restart App and Host. Windows exposes native Application and Edit popup menus through the owned application window. There are no account, onboarding, update-check, or update-installation actions in this startup path.

<a id="authentication-and-process-ownership"></a>
## Authentication and process ownership

The Host binds to `127.0.0.1` on an OS-assigned port by default. Electron exchanges the Host launch credential for its authentication cookie and retains that cookie in the main process. HTTP forwarding sends it explicitly; WebSocket credentials attach only to the owned application window and matching Host authority and scheme. Removing product integrations does not remove Host authentication or the Host/Origin checks.

The renderer uses an isolated preload with sandboxing, context isolation, and Web security enabled; Node integration is disabled. Application IPC checks both the origin and ownership of the main frame. Arbitrary pages and child frames cannot invoke the native application handlers. External HTTP(S) navigation opens outside the application document.

Static assets are served from the installation. Other application requests are forwarded to the authenticated Host, with connection-specific response headers removed and plugin responses marked `no-store`. Readiness and shutdown use private Node IPC. The [Host reference](../desktop-host/README.md) and [Connection reference](../../packages/client/connection/README.md) own the process and authentication details.

<a id="profiles-and-compatibility"></a>
## Profiles and compatibility

The external profile is `$DSH_HOME/profiles/desktop`. Initialization creates missing profile files without installing packages. Ordinary startup validates runtime metadata, preserves installed plugins and the lockfile, and removes only obsolete module-link projections owned by the previous loader. Package installation remains an explicit plugin-management operation.

**Breaking compatibility:** Desktop has one shell startup path. `DSH_DESKTOP_MODE`, manifest `dshDesktopMode`, and product/shell launch parameters no longer select behavior. Product Welcome, account and model-key startup checks, analytics, update controls, and Agent-task quit prompts are not part of this application. These services are not replaced by permissive stubs.

An existing profile must begin with `@deepseek-ai/dsh-shell-base` and must not include `@deepseek-ai/dsh-base` or `@deepseek-ai/dsh-web-app` in its selected bundles. Incompatible profiles fail with `DesktopProfileCompatibilityError` (`desktop-profile-incompatible`) before initialization or recovery rewrites their files. Desktop does not convert a product profile or erase its data. Select a separate `DSH_HOME` for the shell foundation; retain the original home for the installation that owns it.

Native recovery backs up the user profile patch and disables third-party bundle selections while retaining their installed files. It restores only the shell base and leaves the home-level patch unchanged. It cannot use this recovery operation to adopt an incompatible product profile.

<a id="closing-the-window-and-quitting"></a>
## Closing the window and quitting

Closing the application window normally hides it rather than shutting down the Host. Windows retains the tray and its background-close notice; reopening focuses the existing window. macOS retains normal application activation. Operating-system session termination and explicit Quit use shutdown rather than the ordinary hide path.

Quit, the tray exit action, and development restart enter cleanup directly, without querying Agent or scheduled-task services. Main prevents duplicate shutdown, hides the window, disposes native close/tray state, aborts the login-shell probe and diagnostic work, closes the backend, and drains pending diagnostic records. The Host has bounded shutdown handling; diagnostic Worker and journal waits are also bounded. Failures are reported rather than described as successful cleanup, and the process then completes its exit. Restart requests a relaunch through this same shutdown path.

<a id="recovery-and-diagnostics"></a>
## Recovery and diagnostics

Startup, Host, preload, and renderer failures reach native recovery. Available actions include Exit, Restart, disabling third-party bundles with a profile-patch backup, and obtaining a diagnostic report. Recovery stops the owned backend before profile mutation. A malformed or incompatible profile remains intact when recovery cannot safely apply.

Electron caches the last confirmed UI language under `userData/desktop/locale-cache` for failures before Host settings become available. Missing or invalid caches fall back to the system language. Crash reports and bounded plugin-operation records remain available independently of product account or update services. See [recovery and diagnostics](docs/diagnostics/README.md) for report locations, data limits, and failure handling.

<a id="develop"></a>
<a id="shell-development"></a>
## Develop

The supported development launcher builds the current artifacts and launches the unique shell application. After an explicit build, the second command regenerates the disposable runtime project and launches existing artifacts without rebuilding:

```sh
pnpm run dev:desktop
pnpm run start:desktop
```

The launcher keeps the isolated `.desktop-build/shell-development` directory under this package: `project` holds generated runtime metadata and workspace links, `home` is the default Harness home, and `electron-user-data` holds browser state. It does not reuse the former product development directory. Explicit home and userData overrides remain the caller's responsibility; do not point them at product data to bypass profile checks.

On macOS, the generated `Harness Shell Dev.app` uses a workspace-specific `com.deepseek.harness.shell.dev.*` identifier and no URL handlers. Its launcher records literal paths and debugging settings for cold starts, but no mode selection. Main, Renderer, and Host debugger defaults are 9329, 9322, and 9330. Renderer DevTools opens unless explicitly disabled. Reload and restart do not rebuild source files.

Development skips primary-runtime preparation and requires no Python or Office payload to start the shell. Electron's own executable and the built Host, client, and main artifacts must still exist. The generated project currently links the CLI and Host workspace packages and their declared dependencies; that broader development dependency set is not evidence that product services are mounted.

<a id="low-level-development-overrides"></a>
### Development overrides

| Variable | Effect |
|---|---|
| `DSH_HOME` | Replaces the default development Harness home. |
| `DSH_DESKTOP_USER_DATA_DIR` | Replaces the development Electron browser-data directory. |
| `DSH_DESKTOP_DSH_DIR` | Replaces the unpackaged runtime project path. |
| `DSH_DESKTOP_PNPM_ENTRY` | Replaces the unpackaged package-manager entry. |
| `DSH_DESKTOP_MAIN_INSPECT_PORT` | Replaces the Main debugger port. |
| `DSH_DESKTOP_RENDERER_DEBUG_PORT` | Replaces the Renderer debugger port. |
| `DSH_DESKTOP_HOST_INSPECT_PORT` | Replaces the Host debugger port. |
| `DSH_DESKTOP_OPEN_DEVTOOLS=0` | Keeps automatic detached Renderer DevTools closed. |

Debugger ports must be integers from 1 through 65535. Packaged runtime paths come from the installation, not the unpackaged runtime overrides. There is no launch-mode environment variable or manifest selector.

<a id="installation-ownership"></a>
## Installation ownership

Electron owns its runtime resources; users own the external profile and plugins. Startup does not replace plugin files when the application version, Node version, or target changes. Native incompatibilities surface during loading and require an explicit repair. Profile package operations use the installation's Node-mode executable and package manager rather than requiring pnpm on the user's PATH.

macOS and Linux startup read the account's login-shell environment before starting the Host; Windows keeps its inherited user/system environment. Launcher-owned `DSH_*` and `ELECTRON_*` values remain protected. Failed or timed-out probes warn and fall back, and quitting aborts the active probe. This environment handling does not select a product composition.

The packaged main bundle must resolve its bare imports from shipped dependencies; the renderer preload keeps its sandbox-compatible module set. [Bundle checks](scripts/desktop-bundle-imports.mjs) and [runtime file selection](packaging/README.md#runtime-file-selection) cover these artifact obligations. Settings, profile files, and native browser state retain separate owners.

<a id="terminal-command"></a>
<a id="bundled-command-runtime"></a>
## Terminal command

The existing **Manage dsh Command…** menu remains available on macOS and Windows. It registers, repairs, or removes the installation's terminal launcher and reports a conflicting command instead of silently replacing an unrelated installation. Command registration is separate from the shell profile and remains optional.

The installed command runs [`@deepseek-ai/dsh`'s Desktop CLI bridge](../cli/src/desktop-cli.ts), not the private Host entry. The CLI package owns unpacked Office-engine resolution and Windows console-signal delivery. Its public CLI commands and Desktop-profile package operations remain product-capable; this retained command is not a session-free CLI. Finish running commands before replacing or removing their installation.

<a id="package"></a>
## Package

Runtime purity and distribution purity are separate. The local packaging pipeline still prepares a wider CLI/package closure and native resources, including existing primary-runtime and Office payload handling. The retained pnpm location is `resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs`; its presence does not mean that shell startup installs Office or Agent services. Packaging inputs and output dependencies still require the planned payload and release-closure cleanup; the current installer must not be advertised as a minimal pure-base package.

Use the maintained owner references for installation and release operations. They describe retained infrastructure, not a guarantee that every product integration described elsewhere is active in the shell:

- [Desktop packaging](packaging/README.md): local build inputs, target selection, artifacts, signing integration, and runtime checks.
- [Windows signing](windows-signing/README.md): toolchain, credentials, accepted isolation limits, and runner maintenance.
- [Desktop publication](publishing/README.md): artifact upload, release identities, and publication recovery.

The retained Windows installer is per-user and validates the installation path before extracting or replacing an application. Signing, payload integrity, target architecture, and replacement/rollback checks remain release obligations. Removing account or update bridges from Main does not retire those installer checks or qualify a new minimal distribution.

<a id="known-limitations"></a>
## Known limitations

- Native startup and profile ownership are shell-only, but the generated development project and packaged dependency/payload closure remain broader. Payload cleanup and final release verification are still pending.
- Installed terminal-command management, CLI capabilities, and packaging resources have independent lifecycles; their continued presence is not an automatic restoration of product startup.
- Unit tests cover profile preservation, isolated development identity, and startup/cleanup decisions. Real Electron, target-native signing, and packaged-resource checks remain separate evidence; a source refactor alone does not qualify a release.

<a id="dev-note"></a>
## Dev Note

The [Desktop Host](../desktop-host/README.md) owns profile-process lifecycle. The [shell bundle](../../packages/bundle/shell-base/README.md) owns composition. Keep account, Session, Agent, Office, and updater behavior outside the Electron startup path.
