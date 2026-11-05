---
description: "The sandbox packages of the Cordis desktop base."
kind: "package-group"
---

# Sandbox

English | [中文](README.zh.md)

## Summary

This group holds the sandbox packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [sandbox](./sandbox/README.md) | Abstract process-sandbox seam (ctx.sandbox) for the DeepSeek Harness: same-world confinement vocabulary and the SandboxProvider contract |
| [sandbox-policy](./sandbox-policy/README.md) | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |
