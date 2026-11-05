---
description: "The storage packages of the Cordis desktop base."
kind: "package-group"
---

# Storage

English | [中文](README.zh.md)

## Summary

This group holds the storage packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [storage](./storage/README.md) | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the DeepSeek Harness |
| [storage-domain](./storage-domain/README.md) | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the DeepSeek Harness |
