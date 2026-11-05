---
description: "Cordis 桌面底座中 sandbox 分组的包。"
kind: "package-group"
---

# 沙箱

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 sandbox 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [sandbox](./sandbox/README.md) | Abstract process-sandbox seam (ctx.sandbox) for the DeepSeek Harness: same-world confinement vocabulary and the SandboxProvider contract |
| [sandbox-policy](./sandbox-policy/README.md) | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |
