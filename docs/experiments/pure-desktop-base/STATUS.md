# Pure desktop base execution status

English | [中文](STATUS.zh.md)

## Scope

This record follows the [V0.2 plan](PLAN.md). The branch is `feat/pure-desktop-base`. Development evidence was collected on macOS arm64 with Node 24.17.0, pnpm 11.28.5, and Electron 44.7.0 (embedded Node 24.21.0). A working development desktop is not an independently distributable product.

## Progress

| Phase | Status | Evidence or remaining work |
|---|---|---|
| 0: Isolation and baseline | Development baseline verified | Private data, distinct development identity, one visible Electron window, graceful quit and cold reopen |
| 1: Allowlisted composition | Web smoke passed | 18 active Host rows, authenticated page, minimal Remotes and visible Root |
| 2: Desktop decoupling | Development smoke passed | Explicit shell mode bypasses account/model onboarding, Office payload and Agent task checks; native fault-recovery exercise remains |
| 3: Generic Client and Shell | Settings verified | Root, theme presentation and a settings panel for theme and language; persistence proven across cold restarts. Native-window interaction coverage remains partial |
| 4: Plugin examples | Not started | Both examples and management workflow remain |
| 5: Distribution | Not started | Development app still depends on the checkout; production closure, identity and packaging remain |
| 6: Acceptance | In progress | Development evidence does not complete the artifact-level P01–P12 matrix |

## Environment and isolation

Locked dependency installation completed successfully. Later workspace links were updated from the local cache; a teammate's earlier pnpm test invocation also triggered automatic dependency downloads before cancellation. No dependency-version or supply-chain policy override was used. Subsequent focused commands invoke Node directly to avoid implicit installation.

Local evidence is kept under Git-ignored `.artifacts/pure-desktop-base/`. Electron tests use its private `desktop-home` and `electron-user-data` directories, with inspectors on 19329 (Main), 19322 (Renderer), and 19330 (Host). The generated development project and app are under `apps/desktop/.desktop-build/shell-development/`. The installed user DSH application was not stopped or reconfigured.

Development bundles declare no URL handlers or explicit Launch Services registration. Shell mode uses a distinct macOS bundle identity and persists mode/runtime paths in its cold-start launcher. Only packaged product mode registers the official scheme at runtime. Removing that scheme from future Shell packaging metadata is still required; this work does not repair historical system registrations.

## Implemented composition

The [shell bundle](../../../packages/bundle/shell-base/README.md) composes credentials, configuration, settings, typed transport, authenticated frontend delivery and a [settings-only Remote assembly](../../../packages/api/shell-remotes/README.md), plus the [minimal Root](../../../packages/client/ui-shell/README.md). It does not inherit the agent base or the complete Web application bundle. Source and development installations still contain other repository packages; runtime exclusion does not establish a reduced distribution closure.

The Renderer supports absent Session bindings for root-only trees without fake adapters. Actual scoped consumers still reject absent bindings. The regression suite covers root children, factories, local slots and adapter lifetimes while retaining existing Session adoption and identity behavior.

Desktop validates mode before profile mutation. Development reads `DSH_DESKTOP_MODE`; packaged applications read their own `dshDesktopMode` metadata and ignore the environment for mode selection. Shell profiles initialize and recover to the shell base. Cross-mode profile reuse is rejected without replacing its files. Product remains the default when no mode is authored.

## Runtime evidence

The real Loader test observed all 18 Host entries active, no warnings, and no Agent, Session, model or Job services. Authentication passed HTTP 401 without credentials, 303 during token exchange and 200 for the authenticated page. The selected Client entries exclude the full business Remote assembly and conversation UI.

The Web smoke rendered exactly one Root and one native-menu marker, with no console/page errors or external page requests during the bounded load. The first failed run exposed the Renderer's implicit `session-maybe` dependency; the passing run used the rebuilt decoupled Renderer.

The actual Electron smoke rendered `dsh-app://app/` in Electron 44.7.0 with a single visible application window and no Welcome window. Reload rendered the Root without console/page errors or external page requests during observation. A Main-inspector check confirmed shell mode and the private userData path before requesting real `app.quit()`; the launch process exited 0. The generated app then cold-started successfully with inherited mode, home, runtime and model-key variables removed, and exited 0 after another native quit request. The Office/Python primary-runtime directory was absent throughout this cold-reopen check.

The private Desktop Host e2e separately verified missing-Office-payload startup, absent business services, unsupported update/file-drag requests, settings persistence across Host restart, graceful shutdown acknowledgement and rejection of an invalid mode. Unit tests cover matching-mode recovery and preserving profiles on a mode mismatch; they do not replace an actual native recovery exercise.

The shell settings panel was exercised in the same Electron instance. Opening it makes the application root inert and moves focus into the dialog; closing with Escape or the close button returns focus to the trigger. Selecting a theme calls the theme service and repaints immediately; choosing a language switches the copy and document language. Values are written to the profile through the existing settings scope, not by the shell. Two full cycles were verified: dark/English survived a cold start, then light/Chinese survived another cold start, with both preferences read back from the running window each time. The desktop-locale line observed one non-fatal fetch failure at shutdown in one run and did not recur in later runs; it remains noted for lifecycle hardening.

Panel screenshots are stored as local evidence (`shell-settings-light.png`, `shell-settings-dark.png`). The panel offers every locale the locale service publishes; only English and Chinese ship dictionaries in the base shell, so the other built-in languages currently fall back to English until a plugin registers their dictionaries.

## Checks

| Check | Observed result |
|---|---|
| Profile/reachability focused tests | 39 passed |
| Shell events and built Loader composition | 3 unit cases and 1 e2e passed |
| Root tests and Renderer regression suite | 2 Root cases and 145 Renderer cases passed |
| Shell settings panel tests | 8 ui-shell cases passed, covering all three close paths, focus restore, write delegation and unmount cleanup |
| Native startup/Welcome regression tests | 177 passed; a subsequent protocol-only subset passed 5 cases |
| Mode/profile/development fixtures | 57 passed, 1 existing platform-specific skip |
| Desktop Host mode/quit tests and real e2e | 18 unit cases and 1 e2e passed, e2e retry disabled |
| New Client dependency-policy check | Both new Client packages passed the existing validator's focused checks |
| Package-level compilation and bundling | New packages, Renderer, Desktop Host and Electron main built successfully |
| Aggregate build and repository checks | Artifact build passed 8 gates and serial build check passed both aggregates after correcting test references; subsequent lint cleanup passed 31-file lint and rebuilt both affected UI packages; full documentation rechecks remain |

An earlier full documentation run failed four gates, including a CLI-help timeout, while package additions were in progress. Long-running earlier aggregate type/lint and dependency scans were cancelled rather than counted as passes. Their final checks remain required after integration stabilizes.

## Next checkpoint

Add the two independent plugin examples, exercise native failure recovery, and complete the remaining repository checks. Then produce a source-independent Shell artifact with a reduced dependency closure and independent product metadata. Keep runtime, installer, network-observation and cross-platform claims limited to the evidence actually collected.
