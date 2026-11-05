# Harness Kernel

English | [中文](README.zh.md)

## Summary

The kernel is the smallest runnable Harness application: one Cordis root, one HTTP page, one settings document, and no product services. Every other capability belongs to a plugin that the Loader mounts later.

## Table of Contents

- [Run](#run)
- [What boots](#what-boots)
- [Settings document](#settings-document)
- [Plugins](#plugins)
- [Verification](#verification)
- [Known limitations](#known-limitations)

<a id="run"></a>

## Run

```sh
DSH_HOME=/tmp/kernel-home pnpm --filter @deepseek-ai/dsh-kernel start
```

`DSH_HOME` selects the settings root; without it the kernel uses `~/.dsh`. `DSH_KERNEL_PORT` selects the loopback port; `0` (the default) lets the OS assign one, and the process prints the bound URL. `SIGINT` and `SIGTERM` close the listener and dispose the plugin tree before exit.

<a id="what-boots"></a>

## What boots

`bootKernel` creates one `Context`, mounts the server and settings services, listens on `127.0.0.1`, and mounts the page plugin. The page is served at `/`; the settings API is `/api/settings` with `GET` to read and `POST` to merge a JSON patch. Each route is registered inside `ctx.effect()`, so disposing a plugin removes its routes.

<a id="settings-document"></a>

## Settings document

The store reads and writes `<DSH_HOME>/kernel/settings.json`, creating the directory with `0700` and the file with `0600`. Missing documents resolve to `{ theme: "dark", language: "en" }`; unreadable or invalid documents log a warning and fall back to the same defaults instead of blocking startup. Writes merge the current document with the patch, write a temporary file, then rename it, and concurrent writers serialize behind one queue.

<a id="plugins"></a>

## Plugins

A plugin is an ordinary Cordis function plugin. It declares the services it reads through `inject` and registers routes or settings keys inside `ctx.effect()`. `packages/` product services are not required: the kernel depends only on `vendor/cordis` and Node builtins, so mounting one more capability never pulls the product runtime back in.

<a id="verification"></a>

## Verification

```sh
node node_modules/vitest/vitest.mjs run apps/kernel/tests/kernel.spec.ts --maxWorkers=1
```

The suite boots a kernel in a temporary home, asserts the page and default settings, persists a patch and reloads it, and rejects unknown routes and invalid patches.

<a id="known-limitations"></a>

## Known limitations

- No authentication, plugins, or client bundle loading yet: the page is static markup served by the kernel.
- Settings are one flat document; there is no schema, migration, or namespace isolation.
- The kernel is not wired into the desktop shell; `apps/desktop-host` still boots the product profile.
