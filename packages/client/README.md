---
description: "The client packages of the Cordis desktop base."
kind: "package-group"
---

# Client

English | [中文](README.zh.md)

## Summary

This group holds the client packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [client-connection](./connection/README.md) | Authenticated RPC transport and generation lifecycle |
| [client-locale](./locale/README.md) | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| [client-modules](./modules/README.md) | Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremental dsh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| [client-resources](./resources/README.md) | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| [client-shortcuts](./shortcuts/README.md) | Application keyboard command registry and physical-key routing |
| [client-store](./store/README.md) | React-free observable and snapshot-store contracts with the shared Zustand/Immer engine |
| [client-ui-dockkit](./ui-dockkit/README.md) | Docking layout kit: split-tree engine with invertible operations, and the React components that render and drive it (zero cordis) |
| [client-ui-layout](./ui-layout/README.md) | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| [client-ui-primitives](./ui-primitives/README.md) | Pure React atoms for the dsh web UI: controls, icons, markdown, and JSON inspectors (zero cordis) |
| [client-ui-renderer](./ui-renderer/README.md) | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| [client-ui-settings](./ui-settings/README.md) | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| [client-ui-shell](./ui-shell/README.md) | Session-free application root and content extension slot |
| [client-ui-slots](./ui-slots/README.md) | Slot registry pure core: typed ordinary Slots and reusable Component Factories, derived props, Store seats, and renderer installation |
| [client-ui-theme](./ui-theme/README.md) | Theme plugin: Host bootstrap for the pre-plugin palette; ThemeRuntime for light/dark/system state and icon replacements; --dsw-* token styles and Appearance settings row |
| [client-web](./web/README.md) | Web boot kernel: static module table, Cordis loader, framework-free boot page, and UI-renderer handoff |
