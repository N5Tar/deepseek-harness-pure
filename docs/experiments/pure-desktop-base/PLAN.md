# DSH pure desktop base implementation plan V0.2

English | [中文](PLAN.zh.md)

## Summary

This plan defines a Cordis-based desktop runtime derived from DSH without AI business dependencies. The target starts a desktop UI, loads business plugins, persists settings, exits normally, and recovers from plugin failures without an account, model configuration, API key, Session, or agent service.

This is a planning reference, not a current product guide or experiment result. Date: 2026-11-04; the scope is agreed, and the [execution status](STATUS.md) tracks implementation. Source inspection supplies static evidence only, not a passing Web, Desktop, or distribution result. Implementers own execution and evidence recording for each phase.

## Table of contents

- [Goals and scope](#goals-and-scope)
- [Source evidence and design constraints](#source-evidence-and-design-constraints)
- [Target structure](#target-structure)
- [Implementation phases](#implementation-phases)
- [Acceptance matrix](#acceptance-matrix)
- [Testing and deliverables](#testing-and-deliverables)
- [Risks and open choices](#risks-and-open-choices)
- [Dev note](#dev-note)

<a id="goals-and-scope"></a>

## Goals and scope

This plan replaces the V0.1 UI-replacement experiment objective: business-service removal is mandatory, bounded Electron host decoupling is allowed, and recovery targets the pure Shell rather than the official chat UI. Hidden UI, passive inactivity caused by missing dependencies, and fake business services do not count as removal.

### Required capabilities

| Capability | First-version requirement |
|---|---|
| Cordis and Loader | Service injection, events, composition, lifecycle, and resource cleanup |
| Desktop host | Windows, single instance, Host start/stop, exit, restart, and independent data directories |
| Client infrastructure | Module loading, React Renderer, Slots, and a default Root |
| Secure communication | Necessary Host/Client communication, authentication, and access restrictions |
| Basic settings | Persistent language, theme, and product settings |
| Plugin management | Reliable local installation, activation, and error reporting; no online marketplace required |
| Diagnostics and recovery | Logs and recovery independent of a functioning business Root |
| Development and distribution | Build, debugging, controlled reload, and a standalone development artifact for the current macOS |

### Default exclusions

- Agent Loop, Session, session persistence, and conversation controllers.
- Model providers, account login, API-key onboarding, and official AI welcome flows.
- Tool execution, terminals, workspace file operations, and browser/computer automation.
- Team, Workflow, Goal, Schedule, and agent-facing skills and prompts.
- Official chat, sidebars, conversation settings, and other business UI.
- Official product analytics, online plugin marketplace, and default external business connections.

Credentials needed for basic authentication are not disposable account business. Exclusions first apply to runtime composition and then distribution dependencies; retaining business source in the repository temporarily does not require shipping those packages in the base artifact.

### Non-goals

- A production theme marketplace, complete product features, or reintroducing AI capabilities.
- A general cross-platform updater or online plugin marketplace.
- A security sandbox for arbitrary untrusted plugins; reversible lifecycle is not security isolation.
- Rewriting Cordis, React, or Electron, or repository-wide restructuring solely to reduce size.
- Production signing, notarization, public release, or unsupported platform claims without testing.

The first version targets the current macOS for acceptance; untested Windows/Linux results remain UNKNOWN. Later products may add AI through separate business compositions, but the first version does not prebuild interfaces without consumers.

<a id="source-evidence-and-design-constraints"></a>

## Source evidence and design constraints

These locations come from the preceding read-only investigation and must be rechecked against the implementation checkout. They define verification scope, not claims of successful execution.

| Investigation location | Constraint to verify during implementation |
|---|---|
| [Application assembly](../../../packages/client/ui-renderer/src/client/app.tsx) and [Root checks](../../../packages/client/ui-renderer/src/client/registry.ts) | Register the new Root before mounting; do not assume uninstall restores the official layout |
| [Client startup audit](../../../packages/client/web/src/boot-client.ts) and [Host startup audit](../../../packages/boot/app-boot/src/index.ts) | Distinguish absent, explicitly disabled, and present-but-inactive entries; reject unexplained failures |
| [Module scanning](../../../packages/client/modules/src/index.ts) | Inspect Host state, Client graph, Client fiber, Slot, and DOM separately |
| [Connection](../../../packages/client/connection/src/index.ts) | Preserve communication authentication when removing account business |
| [Remote assembly](../../../packages/api/remotes/src/client/index.ts) | Client proxies do not establish running Host services; keep only necessary base interfaces |
| [Theme plugin](../../../packages/client/ui-theme/src/client/index.ts) and [theme presentation](../../../packages/client/ui-layout/src/client/theme-presenter.ts) | Assign settings, theme state, and DOM presentation owners without the official layout dependency |
| [Desktop startup](../../../apps/desktop/src/main.ts) and [welcome backend](../../../apps/desktop/src/welcome-backend.ts) | Remove model and account queries as prerequisites for entering the main window |
| [Desktop Host](../../../apps/desktop-host/src/index.ts) | Check exit, update, and other host business dependencies, not just window creation |
| [Development launcher](../../../apps/desktop/scripts/dev.ts) | Isolate Harness home, Electron userData, and debug ports together |
| [Profile management](../../../apps/desktop/src/project-manager.ts) and [recovery implementation](../../../packages/boot/app-boot/src/profile-sanitize.ts) | Default and recovery compositions target the pure base; test configuration backups and installed-file retention |
| [Native menus](../../../apps/desktop/src/preload-menu.ts) | Verify window-control clearance, menu mounting conditions, and drag regions in the new Root |

Consult [architecture](../../architecture.md) for composition principles, [defensive patterns](../../defensive-patterns/README.md) for lifecycle and safety review, and [testing policy](../../testing.md) for test selection. This plan does not duplicate their complete rules.

<a id="target-structure"></a>

## Target structure

Use an explicit allowlist instead of inheriting the complete Web bundle and maintaining permanent disable lists. Retain supported Profile launching; choose final package names and locations under repository conventions in phase 0.

| Composition | Responsibility | Must not depend on |
|---|---|---|
| Desktop base | Loader, communication authentication, modules, Renderer, basic settings, diagnostics, recovery | Session, agent, model, or account business |
| Default Shell | Minimal Root, window adaptation, settings, plugin status, and error entry points | Official chat layout or session hooks |
| Product | Product pages, Host services, and explicitly selected business capabilities | Undeclared default AI services |

Reuse independent generic modules and split mixed responsibilities only where necessary. Do not copy the whole official UI, fabricate business services, or swallow dependency errors. Exit and update must not hardcode agent tasks; prefer existing generic lifecycle mechanisms and require real consumers for new extension points.

<a id="implementation-phases"></a>

## Implementation phases

Proceed in order, retaining minimal changes, verification records, and limitations for each phase. Record concrete blockers and alternatives on failure; do not bypass them silently or substitute a visible page for complete acceptance.

### Phase 0: Isolation and baseline

- Create a dedicated implementation branch; record source version, OS, toolchain, and working-tree state, and do not commit implementation on the main branch.
- Explicitly isolate Harness home, Electron userData, debug ports, logs, and build output; inspect single-instance locking.
- Check launcher downloads, runtime preparation, and build behavior without closing existing user DSH processes.
- Establish the original Desktop baseline without login or model calls to distinguish environment failures from removal regressions.
- Deliver environment notes, reproducible startup steps, and an initial dependency table; pass when the experiment and existing installation do not interfere.

### Phase 1: Allowlisted base composition

- Build an independent base bundle/profile from an empty composition, selecting startup, configuration, modules, authentication, Renderer, and necessary settings by actual dependencies.
- Create a minimal Root showing the base name, connection state, version, and static sample area without Session data or hooks.
- Record services, required injections, Host/Client responsibilities, direct/transitive dependencies, and retention reasons for each retained module.
- Deliver the base composition, Root, dependency closure, and model-free startup tests; browser diagnostics are intermediate evidence, not desktop completion.
- Pass with no Agent/Session/model business entries or unexplained pending/failed states, and reproducible Host readiness, Client activation, Root mounting, and restart.

### Phase 2: Electron business decoupling

- Remove the AI welcome window and account, model, or API-key state as desktop startup prerequisites.
- Require only necessary Host, communication, Client base composition, and a renderable Root for desktop readiness.
- Remove direct agents/jobs dependencies from exit and update; disable unadapted official online update paths rather than retaining a partially working updater.
- Use the pure composition for initialization and recovery while preserving user data and auditable configuration backups.
- Deliver startup, exit, restart, and recovery paths; pass when fresh data without accounts/keys enters the main window and lifecycle operations work without session services.

### Phase 3: Generic Client and Shell

- Provide a Remote assembly containing necessary interfaces only; let business compositions select their own proxies.
- Assign theme state, settings persistence, and DOM presentation responsibilities; provide minimal language/theme settings without model or session settings.
- Verify drag regions, macOS traffic-light clearance, native menus, minimum size, focus, and theme synchronization.
- Provide plugin error diagnosis and native recovery independent of the business Root; ensure controlled restart before promising seamless replacement of arbitrary Roots.
- Deliver the default Shell, settings UI, and recovery tests; pass without official layout/sidebar/conversation dependencies, with settings surviving restart and working window interaction/recovery.

### Phase 4: Business plugin examples

- Example A registers a Client-only page or panel using Slots and the base theme, verifying activation, deactivation, and contribution removal.
- Example B provides a minimal Host service, invokes it through controlled Remote access, and saves one non-sensitive setting.
- Verify installation, activation, removal, restart, missing dependencies, plugin failures, and cleanup, including duplicate listeners and mounts.
- Deliver both examples, authoring/loading instructions, and real-composition tests without building an online marketplace.
- Pass when examples avoid session business and the complete Web composition, and deactivation removes services, Slots, and effects as intended.

### Phase 5: Build and distribution dependencies

- Inspect source presence, package installation, runtime activation, browser delivery, and distribution contents separately; do not confuse deactivation with size reduction.
- Exclude unnecessary AI, terminal, automation, and large business runtimes, and inspect static Web platform contents.
- Set independent application identity and data paths, avoid claiming official application protocols, and check third-party licenses.
- Produce a development artifact for the current macOS, measure size and startup resources, and record outstanding signing, notarization, and update work.
- Pass when the artifact starts without source or a development server, borrows no existing installation configuration/runtime, and does not accidentally restore the complete business composition.

### Phase 6: Final acceptance

- Execute the matrix below; record PASS, FAIL, or UNKNOWN with source version, platform, and evidence paths.
- Summarize retained/removed dependencies, limitations, recovery steps, development operation, and distribution results.
- Complete when a new user can start, configure, run examples, exit/reopen, and recover from plugin failure without understanding models, accounts, or sessions.

<a id="acceptance-matrix"></a>

## Acceptance matrix

Every item currently remains UNKNOWN. Mark PASS only after obtaining corresponding runtime evidence; documentation and screenshots alone cannot replace service-state, lifecycle, or distribution verification.

| ID | Acceptance item | Required evidence | Initial status |
|---|---|---|---|
| P01 | Fresh isolated startup | Isolated paths, logs, and actual window | UNKNOWN |
| P02 | No account or API key | Configuration and startup call records | UNKNOWN |
| P03 | No Agent/Session/model services | Host runtime inventory | UNKNOWN |
| P04 | No official chat UI | Client graph, fiber, Slot, and DOM | UNKNOWN |
| P05 | No unnecessary business Remotes | Assembly and runtime inspection | UNKNOWN |
| P06 | Persistent settings | Before/after changes and restart results | UNKNOWN |
| P07 | Working lifecycle | Exit, reopen, and Host restart records | UNKNOWN |
| P08 | Plugin loading and removal | Example tests and cleanup evidence | UNKNOWN |
| P09 | Failure recovery | Fault injection, configuration backups, and recovery records | UNKNOWN |
| P10 | No unexpected external business requests | Bounded network observation and allowlist | UNKNOWN |
| P11 | Standalone artifact | Startup outside the source environment | UNKNOWN |
| P12 | Existing DSH unaffected | Isolation configuration and change inspection | UNKNOWN |

<a id="testing-and-deliverables"></a>

## Testing and deliverables

Tests must cover real entry paths. Composition tests use the real Loader; UI tests need no model; Desktop lifecycle and distribution artifacts receive separate verification. Select focused unit, composition, browser, and build checks for actual changes; source tests do not replace distribution validation, and repeated repository-wide runs are not the default.

Separate commits for composition, Root, Desktop decoupling, lifecycle/recovery, Client extraction, examples, and distribution closure. Parallel work must declare disjoint write scopes; establish interfaces before dependent Host/Client consumers. The lead implementer reviews the full diff and runs integration checks.

Final deliverables include the base composition and Shell, necessary host changes, two examples, development/build/recovery instructions, dependency matrix, test results, and a current-platform development artifact. Keep raw logs, screenshots, and runtime evidence in ignored artifact directories; commit sanitized summaries only, without tokens, cookies, keys, personal configuration, or real chat data.

Phase implementers must verify actual commands, package names, and the complete minimal module set before adding them to operating instructions. This document supplies no unexecuted startup commands and claims no existing shell-minimal product.

<a id="risks-and-open-choices"></a>

## Risks and open choices

| Risk or choice | Handling principle |
|---|---|
| Generic modules retain business dependencies | Trace consumers and split locally; no fake services |
| Root failure leaves a blank page | Native recovery remains independent of business UI and restores the pure composition |
| Credential removal breaks security | Preserve communication authentication and remove unnecessary business consumers only |
| Upstream features enter implicitly | Allowlisted composition and regression tests rather than permanent denylists |
| Development passes but packaging omits files | Independently check distribution dependencies and startup outside source |
| Premature source deletion | Stabilize composition and artifacts before source cleanup |
| Uncertain size/performance gains | Measure before reporting; promise no reduction ratio |
| Product name, identity, and distribution channel | Decide before packaging; use an isolated development identity until then |
| Future plugin trust model | Run trusted plugins only in version one; claim no permission isolation |
| Automatic updates and AI integration | Outside version one; retain no broken default paths |

<a id="dev-note"></a>

## Dev note

This document does not track experiment completion. Save execution results separately and reference this plan; document actual API or user-visible changes and provide upgrade guidance under repository rules. No implementation, runtime, recovery, or distribution success is established yet.
