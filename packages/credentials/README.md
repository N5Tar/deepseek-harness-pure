---
description: "The credentials packages of the Cordis desktop base."
kind: "package-group"
---

# Credentials

English | [中文](README.zh.md)

## Summary

This group holds the credentials packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [credentials](./credentials/README.md) | Abstract credential seam (ctx.credentials): settings carry references to secrets, providers own the values |
| [credentials-local](./credentials-local/README.md) | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the DeepSeek Harness |
