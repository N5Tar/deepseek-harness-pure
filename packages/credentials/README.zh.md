---
description: "Cordis 桌面底座中 credentials 分组的包。"
kind: "package-group"
---

# 凭证

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 credentials 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [credentials](./credentials/README.md) | Abstract credential seam (ctx.credentials): settings carry references to secrets, providers own the values |
| [credentials-local](./credentials-local/README.md) | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the DeepSeek Harness |
