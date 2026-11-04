---
description: "Build a session-free plugin application with localized content and theme support."
kind: package-reference
---

# Session-free application shell

English | [中文](README.zh.md)

## Summary

Build a plugin application without conversations, sidebars, Sessions, or Agents. Add content through a root-scoped extension position, and choose a theme and language from the title-bar settings panel. This shell provides no model or Session settings and no plugin manager.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use-this-package"></a>
## Use this package

Compose `@deepseek-ai/dsh-client-ui-shell` instead of `ui-layout`, with `slots`, `locale`, and `theme` services. The plugin has no configuration fields or Host behavior. It owns the built-in `root` occupant and declares the root-scoped list `shell.content`. Content plugins use `ctx.slots.inject('shell.content', ...)` and register a unique list id. Removing this root removes its child declaration and contributions. Stop rendering or replace the root before unloading its only occupant.

The frame provides English and Chinese copy, a 56px draggable header with 160px inline clearance for native controls, a scrollable main region, and the `data-shell-overlay` marker required by Desktop's native menu adapter. Do not activate another root owner that declares the same children.

The Settings button opens a modal with System, Light, and Dark theme preferences and the locale service's registered languages. Changes call `theme.setTheme` and `locale.setLocale`; those services own persistence through Host settings. The shell creates no settings namespace, Remote endpoint, or local-storage preference. Close with the button, Escape, or the mask; focus returns to the initiating button, and the background remains inert while the panel is open.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals</summary>

The [registration](src/client/index.ts) owns the root, dictionaries, and document theme projection as reversible Cordis effects. The [presenter](src/client/theme.ts) applies the resolved palette, token overrides, and font sizes; disposal restores prior document values. The [component](src/client/Shell.tsx) reads theme and language snapshots through renderer-bound hooks and writes through injected service callbacks. The shared `useModalLayer` primitive owns Escape, Tab trapping, and focus restoration; React unmount releases its document listeners and portaled DOM.

</details>

<a id="model-experience"></a>
## Model Experience

None; this package adds no model messages, tools, or prompt tokens.

#### KV Cache effect

None; this package neither constructs nor sends model requests.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The shell intentionally offers a narrow content extension:

- The root exposes only `shell.content`, not the conversation layout's child slots or `layout` service.
- Theme font-family preferences are not projected.
- Native window behavior and light/dark rendering were checked in an assembled Electron window; this package's tests cover registration and interaction, not every platform's visual result.
- Only English and Chinese dictionaries ship here. Other registered languages appear in the panel but fall back to English until a plugin registers their dictionaries.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers</summary>

None.

</details>
