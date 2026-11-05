# DeepSeek Harness Kernel

English | [中文](README.zh.md)

A desktop base assembled from the Cordis all-plugin runtime. One Cordis root starts a single page; every capability beyond that page arrives as a Loader-mounted plugin.

## What runs

- `apps/kernel` boots the runtime: one HTTP page, a settings document, a plugin manifest, and a client module table.
- `apps/desktop` runs that kernel in an Electron process and renders its page.
- `apps/desktop-host` and `apps/cli` provide packaging and command-line entry points.

## Run from source

```sh
pnpm install
pnpm run build
DSH_HOME=/tmp/dsh-home node --import tsx/esm apps/kernel/src/main.ts
```

The kernel prints the loopback URL it bound. Use `DSH_KERNEL_PORT` to pin the port.

To launch the desktop shell, build first and start Electron against `apps/desktop`.

## Extend

Plugins are declared in `<DSH_HOME>/kernel/plugins.json`:

```json
{ "plugins": [{ "name": "./plugins/health.ts" }] }
```

Client modules are plain `*.js` files in the kernel's `assets/ui` directory; each registers itself on `window.__DSH_KERNEL_UI__` and the page mounts it.

## Repository

- `packages/` — the Cordis base packages and the transport contract types they depend on.
- `vendor/` — pinned copies of Cordis and its official plugins.
- `native/` — the native add-on source the desktop build uses.
- `docs/` — the experiment plan and execution status.

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
