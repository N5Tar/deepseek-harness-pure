---
description: "The host packages of the Cordis desktop base."
kind: "package-group"
---

# Host

English | [中文](README.zh.md)

## Summary

This group holds the host packages the base keeps. Each entry links to the package README that owns its behavior, lifecycle, and failure contracts.

## Packages

| Package | Owns |
| --- | --- |
| [host-frontend-static](./frontend-static/README.md) | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| [host-plugin-inventory](./plugin-inventory/README.md) | Read-only Remote projection of current Cordis Loader plugin state |
| [host-webserver](./webserver/README.md) | Web route-registration plugin: HTTP and upgrade routes, per-Peer index transform taps, and static dist fallback |
