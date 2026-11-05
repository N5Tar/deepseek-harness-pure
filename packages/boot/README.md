---
description: "The boot packages of the Cordis desktop base."
kind: "package-group"
---

# Boot

English | [中文](README.zh.md)

## Summary

This group holds the boot packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [app-boot](./app-boot/README.md) | Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware config resolution, and the Loader boot sequence |
| [cmdline](./cmdline/README.md) | Immutable command-line handoff from a dsh launcher to any app plugin that injects cmdlineArgs |
| [config-editor](./config-editor/README.md) | Persist plugin configuration through profile patches and Loader reconciliation |
| [hmr](./hmr/README.md) | Coordinated module and profile configuration hot reload |
| [plugin-manager](./plugin-manager/README.md) | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools |
