# PR build runner sizing

English | [中文](README.zh.md)

## Summary

The [Web shell workflow](../workflows/build-preview-cloudflare.yml) builds artifacts and checks aggregate programs on pull requests. It selects Blacksmith or GitHub-hosted Ubuntu through `DSH_CI_FAILOVER_LINUX`. Runner sizing compares complete job cost, not price per minute or core count alone.

## Table of Contents

- [Comparison requirements](#comparison-requirements)
- [Publication semantics](#publication-semantics)
- [Dev Note](#dev-note)

<a id="comparison-requirements"></a>

## Comparison requirements

A sizing experiment holds checkout SHA, lockfile, Node and pnpm versions, workspace build, and aggregate-check commands constant. Each runner starts without build outputs. Cold installs do not restore dependency caches; pnpm bootstrap files may already exist. Warm installs restore the same exact cache without prefix fallback. Record the actual runner image, CPU, RAM, disk, cache outcome, phase duration, exit status, and peak memory. GNU time maximum RSS reports a process maximum, not simultaneous aggregate memory across the build process tree.

Calculate estimated gross compute as the sum of each completed job’s elapsed minutes rounded upward, multiplied by that runner’s rate. Include setup, cache restoration, cleanup, failures, and measurement-upload overhead. Report seed jobs separately. Queue delay is a latency observation, not executed job time. These estimates are not invoice totals; standard-runner included minutes and storage are separate.

The workflow does not pack a VFS image, deploy a preview, access Cloudflare credentials, or post pull-request comments. Historical preview measurements include work that is absent from the shell build and are not current cost estimates.

<a id="publication-semantics"></a>

## Publication semantics

Runner selection preserves pull-request events, per-PR cancellation, immutable installation, restore-only dependency caching, and the full workspace build. The job has read-only repository permissions; build failures fail the check. There is no deployment or publication step.

<a id="dev-note"></a>

## Dev Note

The [archived runner decision](../../.agents/notes/archived/process/2026-09-06-preview-hosted-runner-sizing.md) records measurements, cost estimates, and image/CPU variation. The build-only experiment does not verify production deployment.
