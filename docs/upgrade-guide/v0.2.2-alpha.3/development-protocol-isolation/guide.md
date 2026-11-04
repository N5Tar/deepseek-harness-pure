---
kind: upgrade-guide
description: "Desktop development launches no longer register the public dsh URL scheme."
---

# Desktop development URL isolation

English | [中文](guide.zh.md)

## Change

Desktop development launches no longer claim `dsh://` links. The macOS development bundle declares no URL handlers and is not explicitly registered with Launch Services. Browser sign-in still completes through its loopback callback, but the completion page cannot bring the development window forward through `dsh://open`. Packaged applications retain their existing registration behavior.

## Migration

1. Launch development through `pnpm run dev:desktop`, or `pnpm run start:desktop` after building. The launcher rebuilds an older generated macOS bundle without its URL handlers.
2. After browser sign-in, bring the development window forward manually.
3. If an earlier development launch claimed `dsh://`, start the installed packaged application to register its handler again. Confirm that `dsh://open` opens the installed application, not the development window; development startup does not repair existing system registrations.
