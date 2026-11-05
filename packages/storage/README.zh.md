---
description: "Cordis 桌面底座中 storage 分组的包。"
kind: "package-group"
---

# 存储

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 storage 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [storage](./storage/README.md) | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the DeepSeek Harness |
| [storage-domain](./storage-domain/README.md) | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the DeepSeek Harness |
