---
description: "Cordis 桌面底座中 core 分组的包。"
kind: "package-group"
---

# 核心

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 core 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [agent](./agent/README.md) | Agent interface, registry, initiator scope, and event vocabulary for the DeepSeek Harness |
| [scope](./scope/README.md) | Scoped-context registration primitive (scope tags, scope-filtered event dispatch) for the DeepSeek Harness |
| [session](./session/README.md) | Event-sourced session store for the DeepSeek Harness |
| [system-prompt](./system-prompt/README.md) | System prompt assembly registry for the DeepSeek Harness |
| [tools](./tools/README.md) | Tool registry and execution pipeline for the DeepSeek Harness |
