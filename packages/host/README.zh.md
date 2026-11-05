---
description: "Cordis 桌面底座中 host 分组的包。"
kind: "package-group"
---

# 宿主

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 host 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [host-frontend-static](./frontend-static/README.md) | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| [host-plugin-inventory](./plugin-inventory/README.md) | Read-only Remote projection of current Cordis Loader plugin state |
| [host-webserver](./webserver/README.md) | Web route-registration plugin: HTTP and upgrade routes, per-Peer index transform taps, and static dist fallback |
