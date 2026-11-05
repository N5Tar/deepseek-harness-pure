# Harness Kernel

English | [中文](README.zh.md)

## Summary

The kernel is the smallest runnable Harness application: one Cordis root, one HTTP page, one settings document, and no product services. Every other capability belongs to a plugin that the Loader mounts later.

## Table of Contents

- [Run](#run)
- [What boots](#what-boots)
- [Settings document](#settings-document)
- [Plugins](#plugins)
- [Client modules](#client-modules)
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

The kernel mounts the Cordis Loader and reads `<DSH_HOME>/kernel/plugins.json`:

```json
{ "plugins": [{ "name": "./plugins/health.ts" }] }
```

Each entry is one Loader entry (`name`, optional `config` and `disabled`); entries run after the built-in page plugin, so plugins may inject `kernelServer` and `kernelSettings`. A missing manifest mounts nothing; a malformed one stops startup with a message naming the offending field.

A plugin is an ordinary Cordis function plugin that declares its services through `inject` and registers routes or settings keys inside `ctx.effect()`. Nothing from `packages/` is required: the kernel depends on `vendor/cordis`, the Loader, and Node builtins, so mounting one more capability never pulls the product runtime back in.

<a id="client-modules"></a>

## Client modules

The page imports every `*.js` file in the client module directory and calls `mount(container)` on each registered plugin:

```js
window.__DSH_KERNEL_UI__ ??= { modules: [] }
window.__DSH_KERNEL_UI__.modules.push({ id: 'example', mount(root) { /* draw */ } })
```

`GET /api/modules` lists `{ id, url }` in file order; `GET /ui/<file>.js` serves the body with a JavaScript content type and refuses names that are not plain `.js` files in the directory. The directory defaults to the kernel's shipped `assets/ui`, and a host may pass `modulesDirectory` when the kernel is bundled.

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
- `apps/desktop` boots this kernel in process by default; `DSH_DESKTOP_KERNEL=0` keeps the retired product profile reachable for diagnosis.
