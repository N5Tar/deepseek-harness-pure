---
description: "Cordis 桌面底座中 util 分组的包。"
kind: "package-group"
---

# 工具

[English](README.md) | 中文

## 摘要

本分组包含底座保留的 util 相关包。每个条目链接到负责其行为、生命周期与失败约定的包 README。

## 包

| 包 | 职责 |
| --- | --- |
| [atomic-write](./atomic-write/README.md) | Zero-dependency atomic file replacement: exclusive-create random-suffix temp + rename carrying the caller-stated permissions (writeFileAtomic) |
| [brand](./brand/README.md) | Stateless branded primitive types for the DeepSeek Harness |
| [util-code-language](./code-language/README.md) | Single file-extension to syntax-highlighting language table shared by Client code surfaces and the Host read card |
| [util-crypto](./crypto/README.md) | Zero-dependency browser-safe UUID and byte-encoding helpers |
| [deque](./deque/README.md) | Zero-dependency circular deque with amortized constant-time end operations and bounded vacant storage |
| [util-file-drag](./file-drag/README.md) | Shared file drag names and native transfer requests |
| [home-paths](./home-paths/README.md) | Shared filesystem path helpers for the DeepSeek Harness |
| [http-proxy](./http-proxy/README.md) | Process-wide outbound HTTP proxy policy for DeepSeek Harness: resolve it from the launch environment and install it as undici's global dispatcher |
| [launch-environment](./launch-environment/README.md) | Immutable DeepSeek Harness launch environment that records which layer supplied each value |
| [native-command](./native-command/README.md) | Host-native command and path-opening utilities with shell-free execution, cancellation, desktop detection, and WSL handoff |
| [official-bundles](./official-bundles/README.md) | Installation-owned lists of official dsh bundles (shipped profile templates, optional, on-demand, and retired bundles) and the plugin manager's protected and presented packages |
| [package-manifest](./package-manifest/README.md) | Shared type declarations for package.json.dsh configuration fields |
| [plugin-detail](./plugin-detail/README.md) | Plugin detail documents: meta.detail or README selection, image paths, and local and npm CDN file sources |
| [timeout](./timeout/README.md) | Zero-dependency timeout/deadline primitive: clampTimeout, deadline, timeoutOf, TimeoutReason (timing + classification only, no termination) |
| [util-values](./values/README.md) | Duplicate-install-safe value primitives for the DeepSeek Harness |
| [util-workspace-path](./workspace-path/README.md) | Browser-safe Workspace path and display helpers |
