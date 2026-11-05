---
description: "The core packages of the Cordis desktop base."
kind: "package-group"
---

# Core

English | [中文](README.zh.md)

## Summary

This group holds the core packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [agent](./agent/README.md) | Agent interface, registry, initiator scope, and event vocabulary for the DeepSeek Harness |
| [scope](./scope/README.md) | Scoped-context registration primitive (scope tags, scope-filtered event dispatch) for the DeepSeek Harness |
| [session](./session/README.md) | Event-sourced session store for the DeepSeek Harness |
| [system-prompt](./system-prompt/README.md) | System prompt assembly registry for the DeepSeek Harness |
| [tools](./tools/README.md) | Tool registry and execution pipeline for the DeepSeek Harness |
