---
description: "Cordis 桌面底座中 boot 分组的包。"
kind: "package-group"
---

# 启动

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 boot 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [app-boot](./app-boot/README.md) | Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware config resolution, and the Loader boot sequence |
| [cmdline](./cmdline/README.md) | Immutable command-line handoff from a dsh launcher to any app plugin that injects cmdlineArgs |
| [config-editor](./config-editor/README.md) | Persist plugin configuration through profile patches and Loader reconciliation |
| [hmr](./hmr/README.md) | Coordinated module and profile configuration hot reload |
| [plugin-manager](./plugin-manager/README.md) | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools |
