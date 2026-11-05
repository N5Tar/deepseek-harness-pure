---
description: "Cordis 桌面底座中 session 分组的包。"
kind: "package-group"
---

# 会话

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 session 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [session-persistence](./session-persistence/README.md) | Abstract durable session persistence seam (ctx.sessionPersistence) for the DeepSeek Harness |
| [session-projection](./session-projection/README.md) | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
