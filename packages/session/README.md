---
description: "The session packages of the Cordis desktop base."
kind: "package-group"
---

# Session

English | [中文](README.zh.md)

## Summary

This group holds the session packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [session-persistence](./session-persistence/README.md) | Abstract durable session persistence seam (ctx.sessionPersistence) for the DeepSeek Harness |
| [session-projection](./session-projection/README.md) | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
