# AGENTS.md

This repository is a session-free desktop base built on the Cordis all-plugin runtime. `apps/kernel` is the shell: one Cordis root, one page, a settings document, and Loader-mounted plugins. Package READMEs are the architecture and contract reference; there is no product documentation tree.

## Repository layout

```
vendor/      Vendored Cordis and its official plugins (vendor/README.md)
packages/    @deepseek-ai/dsh-<pkg> workspaces at packages/<group>/<pkg>/
  bundle/     shell-base composition
  boot/       application boot, command line, plugin manager, HMR
  api/        gateway, settings controller, shell remotes
  host/       web server and static frontend
  client/     GUI client packages used by the shell
  settings/   user settings
  credentials/ credentials and authorization
  typert/     type graphs and remote codecs
  session/, core/, llm/, ...
              transport contract packages still referenced by the gateway
  util/       zero-dependency utilities
native/      @deepseek-ai/node-addon-system source (native/README.md)
apps/        kernel, desktop, desktop-host, cli
docs/        Experiment plan and execution status only
scripts/     Build gates and generators
```

`apps/desktop` boots the kernel in process and renders its page; `apps/desktop-host` is retained for packaging only.

## Commands

```sh
pnpm install            # pnpm workspaces, node >=24.9
pnpm run clean          # remove build outputs and safe residue from deleted packages
pnpm run test           # unit tests
pnpm run test:coverage  # CI coverage gate: per-file 100% on packages/*/*/src
pnpm run typecheck
pnpm run lint
pnpm run duplication    # cross-file TypeScript clone detection
pnpm run build          # build:artifacts + build:check, concurrently
pnpm run build:artifacts # artifacts: tsc emits lib/types, tsdown bundles runtime
pnpm run build:check    # typecheck aggregate tests/scripts against current build output
pnpm run hygiene        # publint + workspace/package/dependency checks
pnpm dsh                # source launcher for the shell profile
```

Kernel verification: `node node_modules/vitest/vitest.mjs run apps/kernel/tests --maxWorkers=1`, then launch Electron with `DSH_HOME` pointed at a scratch directory and confirm the `Harness Kernel` page renders.

### Run relevant checks locally

Before pushing, report only commands actually run.

- Match evidence to the surface: focused behavior tests and built smokes for published paths.
- Never default to the full suite or repeat a passing check for commit or push. CI owns exhaustive coverage and the platform matrix.
- `test:coverage`, not `test`, is the CI coverage gate.
- Develop with `build:artifacts`; before claiming completion, run `build:check` after the latest `build:artifacts`.

## Secrets / .env

Never commit credentials. Windows packaging/signing: [required reading](apps/desktop/windows-signing/README.md).

## Conventions

- Packages use `@deepseek-ai/dsh-<name>`; vendor is rescoped and `private: true`. Harness packages declare `@deepseek-ai/cordis` in `peerDependencies`/`devDependencies`. Workspace dependency sections use DSH `workspace:*`, vendor/native `workspace:~`.
- ESM everywhere (`"type": "module"`). Use package names across packages and `.ts` in local relative imports. The `dsh` CLI source launch runs through tsx's ESM-only hook (`node --import tsx/esm`); modules it reaches must stay ESM.
- **Registrations are effects**: every contribution goes through `ctx.effect()` / `ctx.on()`; a registry's `register()` returns the disposer, directly or through its documented registration handle.
- **Typed events use declaration merging** and merge-extensible maps. Event JSDoc needs `@mode` and payload `@param`. Public service methods document parameters and non-void returns.
- **Switch on discriminant tags.** Closed unions end in `assertNever`; merge-extensible unions fall through a documented default.
- **Waterfall listeners MUST call `next()`** to delegate; returning without it short-circuits the chain.
- **Plugins, not core changes**: new behavior goes on documented extension points.
- **A capability seam comprises Service Definition / Service Provider / Consumer roles.** It is complete, never one role; split only when roles evolve independently.
- **Explicit > implicit at package boundaries**: defaulting is an explicit `resolve(request): Spec` step in the owning implementation, never a hidden `?? default` inside `run()`.
- **No hardcoded tunables in plugins**: deployment-varying choices are validated `Config` fields; a `DEFAULT_*` constant or test hook is not configurability. Protocol constants, external specs, and security invariants stay fixed.
- **Misconfiguration fails loud** at load when self-contained, otherwise at the earliest resolvable point; never silently skip a missing referent.
- **Opaque cross-boundary ids are branded** (`Branded<B>` from `dsh-brand`), never bare `string`.
- **Trust TypeScript at typed same-process boundaries.** Validate at parser/config, queued, model/tool JSON, durable/file, worker, process, and wire boundaries.
- **No new assertions to `unknown`** (`as unknown` or `<unknown>`). Preserve or reduce the exact legacy baseline.
- **Source plane vs artifact plane, never mixed.** Static gates and tests resolve workspace imports through tsconfig `paths` to `src` and pass on a clean tree; gates consuming built `lib/` declare that dependency.
- **Keep compiler faces explicit.** A package with both Host and Client programs exposes face-specific leaf configs and a solution-only root.
- **Error handling:** use typed, structured failures and localized, actionable reports. Define handling ownership, containment, and failure guarantees.
- **An empty `catch` names the error** and why; keep its `try` to one statement.
- **Keep comments local.** Do not restate code, expand unrelated comments, or explain distant behavior without local need.
- **Prefer symmetry for parallel values**; unexplained asymmetry usually signals a missed extraction.
- **Tests describe behavior, not correctness.** Change obsolete behavior with its tests; explain why in the PR.
- **Client UI copy is locale-owned.** Route product text through typed dictionaries and `t` or localized primitive props; `verify-client-ui-i18n` rejects hardcoded copy. English copy uses sentence case.
- **PR descriptions:** summarize the change, the verification actually run, and any behavior change.
- TODO markers: `FIXME`/`TODO`/`XXX` by urgency.
- Files end with exactly one trailing newline; `git diff --cached --check` (pre-commit) gates it.

## Defensive patterns

Before changing a package surface, remote service, client component or state, or lifecycle, concurrency, subprocess, and teardown code, read the owning package README and keep its stated lifecycle and failure contracts.

## Type safety and documentation

Everything compiles under `strict: true` with `noImplicitAny`; every remaining `any` explains why narrowing is infeasible. Every module and export has concise JSDoc for its non-obvious contract; function-like exports include `@param`/`@returns`, as enforced by `verify-export-jsdoc`. Heritage-declared members, plugin-protocol slots, and constructors keep their docs at the declaring Service Definition, protocol, or class.

Comments and docs state complete contracts and context, not reasoning transcripts. Use direct, concrete terms. Keep `contract` for preconditions, postconditions, invariants, compatibility promises, and other obligations that callers, callees, implementers, providers, producers, or consumers rely on. Do not narrate control flow or tests, preserve review history, or restate code.

Docs accompany every code change: update the affected package README and JSDoc contracts together. Keep one physical line per paragraph and one home per fact.

## Editing these instructions

`CLAUDE.md` symlinks `AGENTS.md` at root and `packages/`; edit the real file. Keep each rule self-contained while linking the owning package README.

## Vendoring policy

`vendor/` packages are pinned source copies (manifest with upstream SHAs in [vendor/README.md](vendor/README.md)). Update via the sync procedure there; re-apply or retire the logged local modifications; rerun `pnpm run test && pnpm run build`.
