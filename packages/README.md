---
description: "The package workspace: which groups remain in the Cordis desktop base, what each owns, and the conventions that bind them."
kind: "package-group"
---

# Packages

English | [中文](README.zh.md)

## Summary

The base is assembled from npm packages under `packages/`, grouped by responsibility. `bundle/shell-base` is the composition the desktop shell mounts; the remaining groups provide the runtime services that composition uses. Every package is scoped `@deepseek-ai/dsh-*` and lives in exactly one group; each group README is the authoritative package map for its family.

## Groups

| Group | Owns |
| --- | --- |
| `bundle` | The `shell-base` composition the kernel mounts |
| `boot` | Application boot, command line parsing, plugin manager, HMR |
| `api` | Remote gateway, settings controller, shell remotes |
| `host` | Loopback web server and static frontend |
| `client` | Client-side shell packages: connection, modules, renderer, settings, theme, slots, primitives |
| `settings` | User settings service |
| `credentials` | Credentials and authorization |
| `typert` | Type graphs and remote codecs |
| `util` | Zero-dependency utilities |
| `session`, `core`, `llm`, `sandbox`, `storage`, `subprocess`, `workspace`, `preset`, `interaction`, `attachment` | Transport contract packages still referenced by the gateway and client connection |

## Release expectations

Packages are `private: true` unless they are published for external plugin authors. Publication metadata and bundled runtime entries live in each `package.json`.

## Dependencies

Workspace dependencies use `workspace:*` for Harness packages and `workspace:~` for vendored Cordis packages. Every Harness package declares `@deepseek-ai/cordis` in `peerDependencies` and `devDependencies`.

## Package README contracts

Each package README states what the package owns, its public surface, its lifecycle and failure contracts, and its known limitations. Keep it current with the code: it is the reference callers read before changing a package surface.

## Dev Note

`pnpm run build:check` typechecks the workspace; `pnpm run build:artifacts` produces the runtime bundles. The kernel itself is verified through its own test suite.
