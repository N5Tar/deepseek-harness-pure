---
description: "Settings and credential-management Remote methods for a shell without the full business API assembly."
kind: "package-reference"
---

# `@deepseek-ai/dsh-api-shell-remotes`

English | [中文](README.zh.md)

## Summary

Use this plugin to let a standalone shell read and save preferences through the Host configuration API without loading the full business API assembly. It includes settings and credential-management methods, but no Session, Agent, model, account, or job namespaces. The Host must separately provide the configuration services and settings notifications.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The [shell-base composition](../../bundle/shell-base/README.md) mounts this plugin together with the Gateway, settings controller, and local settings provider. It accepts no plugin configuration. Do not mount it alongside the full Remote assembly: both select the same configuration namespaces.

The Client entry requires the `remote` service. The Host marker performs no business work; module discovery publishes its browser entry through the normal dual-entry package mechanism.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The [Client entry](src/client/index.ts) mounts the settings controller's generated contribution and returns its disposer. [Event types](src/types.ts) select the settings invalidation notification. The shell-base Host owns that notification's stream and the real configuration providers; this package does not simulate missing services.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Gateway](../gateway/README.md) — method dispatch and authenticated streams.
- [Settings controller](../settings-controller/README.md) — configuration reads and writes.
- Web Client — module discovery and activation.

<a id="model-experience"></a>
## Model Experience

None, as this plugin installs browser Remote methods rather than model tools or prompt sections.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The generated settings-controller contribution also contains credential-management methods. The plugin does not split that existing owner or provide a permissions sandbox for installed code. Additional business APIs require an explicit assembly change.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
