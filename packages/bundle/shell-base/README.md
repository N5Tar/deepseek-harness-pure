---
description: "Authenticated browser shell with persistent appearance settings and no default Agent, Session, model, or account business services."
kind: "package-bundle"
---

# `@deepseek-ai/dsh-shell-base`

English | [中文](README.zh.md)

## Summary

This standalone bundle supplies an authenticated browser shell with language and appearance preferences. Its explicit whitelist excludes the full base and Web application bundles, Agent execution, Sessions, model configuration, account onboarding, and telemetry. It is intended for an isolated profile, not as an additional layer over the full product.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Select this bundle as the profile's complete bundle list through the [profile mechanism](../../boot/app-boot/README.md). Do not stack it with the full base or Web bundles. Keep the profile and Harness home separate from existing product data.

The [patch](cordis.patch.yml) binds loopback on an OS-assigned port. Its runtime publishes an authenticated URL only after launcher readiness and never opens a browser automatically. Authentication still uses managed local credentials; absence of account business services does not remove browser access checks.

Profile overrides replace a row's entire configuration. Appearance and language preferences persist through the profile settings document. The default Root is supplied by [ui-shell](../../client/ui-shell/README.md).

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The [Host runtime](src/index.ts) mounts authenticated frontend assets and a settings-only event source. [Shell remotes](../../api/shell-remotes/README.md) installs the Client configuration namespaces. The existing settings forms, locale, theme, module carrier, and renderer remain independent plugins; no placeholder Agent or Session service satisfies their dependencies.

The keyless [composition test](tests/composition.e2e.ts) requires built Client bundles and frontend assets, then boots the whitelist through the real Loader and checks authentication, the served module graph, activation failures, and absent business services; missing artifacts fail rather than skip. [Event tests](tests/settings-events.spec.ts) cover cancellation and settings invalidation coalescing.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Application composition](../../../docs/architecture.md) — profiles and ordered bundle layers.
- [Pure desktop plan](../../../docs/experiments/pure-desktop-base/PLAN.md) — implementation scope and acceptance criteria.

<a id="model-experience"></a>
## Model Experience

None, as this bundle registers no model tools, prompt sections, or Agent execution services.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The bundle alone does not adapt the Electron carrier, provide a plugin-management UI, or remove business code from the shared frontend artifact. Desktop lifecycle, recovery, and distribution isolation require separate verification. The default Shell is a static Root, not a complete settings application.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Installation and desktop validation belong to the isolated-profile integration work; no installed-profile or release guarantee is established by this package alone.

</details>
