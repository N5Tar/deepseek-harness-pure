/**
 * Shared profile boot for every `dsh` surface: resolve the profile, stack its
 * patch layers (bundle layers in `dsh.profile.bundles` order, the profile's
 * own `cordis.patch.yml`, `--patch` overlays, the telemetry switch), mount the
 * tree over the profile's empty root config, and wire fail-loud plus bounded shutdown.
 *
 * App flags are not the launcher's business: the invocation's inner arguments
 * are provided to the tree through `ctx.cmdlineArgs`, where any injected app
 * plugin may read the same immutable snapshot.
 * @module @deepseek-ai/dsh/profile-boot
 */

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import {
  initProfile,
  loadOverlayPatches,
  loadProfile,
  reportSkippedBundles,
  PROFILE_PATCH_FILENAME,
  resolveProfileDir,
  type ProfileContext,
  type Profile,
  runResolvedProfile, PROFILE_ROOT_CONFIG, PROFILE_ROOT_FILENAME, type ProcessShutdown,
} from '@deepseek-ai/dsh-app-boot'
import { PROFILE_TEMPLATES } from '@deepseek-ai/dsh-official-bundles'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { LaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'

const NAME = 'dsh'

/**
 * The home-level user patch layer (`$DSH_HOME/cordis.patch.yml`), applied
 * over every profile's own layer. Resolved per call, not at module load:
 * `$DSH_HOME` may be set by the test or launcher after import.
 * @returns the absolute patch-file path.
 */
export function homePatchPath(): string {
  return join(resolveDshHome(), PROFILE_PATCH_FILENAME)
}

/** Absolute path of this dsh installation's package.json (both anchors: src/ and lib/ sit one level under apps/cli). */
export const INSTALL_ANCHOR = fileURLToPath(new URL('../package.json', import.meta.url))

export { PROFILE_ROOT_FILENAME } from '@deepseek-ai/dsh-app-boot'

/**
 * Replace the named custom profile with a fresh copy of one shipped template.
 * This copies only the template's bundle list; local state from the
 * same-named shipped profile is not read, and no inheritance metadata is
 * persisted. The new profile is assembled in a `.<name>.staging-*` directory
 * under the profiles directory and moved into place; only then is any previous
 * target directory, including its dependencies and user patch, deleted. A
 * failed move restores the previous directory; when restoring also fails, it
 * stays in the staging directory. Shipped profile names, compared without
 * case, are reserved. Concurrent replacements leave one complete copy; each
 * one either succeeds or reports the concurrent recreation.
 * @param name - the profile name to create or replace.
 * @param fromDefaultProfile - shipped profile template to copy.
 * @param home - Harness home containing the profile directory.
 * @throws when the template is unknown, the target name is shipped, another process recreates the target
 *   between the two renames, or a file-system operation fails; a restore failure is an `AggregateError`
 *   that names the staging path holding the previous profile.
 */
export function initializeProfileFromDefault(
  name: string,
  fromDefaultProfile: string,
  home: string = resolveDshHome(),
): void {
  const dir = resolveProfileDir(name, home)
  const template = Object.hasOwn(PROFILE_TEMPLATES, fromDefaultProfile)
    ? PROFILE_TEMPLATES[fromDefaultProfile]
    : undefined
  if (template === undefined) {
    const expected = Object.keys(PROFILE_TEMPLATES).sort().map(value => JSON.stringify(value)).join(', ')
    throw new Error(
      `${NAME}: unknown default profile ${JSON.stringify(fromDefaultProfile)}; expected one of ${expected}`,
    )
  }
  // Case-insensitive file systems resolve a case variant such as `Web` to the shipped directory.
  const shipped = Object.keys(PROFILE_TEMPLATES).find(shippedName => shippedName.toLowerCase() === name.toLowerCase())
  if (shipped !== undefined) {
    throw new Error(
      `${NAME}: profile ${JSON.stringify(name)} names shipped profile ${JSON.stringify(shipped)} and cannot be a custom profile target; `
      + 'omit --from-default-profile to use it',
    )
  }
  mkdirSync(dirname(dir), { recursive: true })
  // The staging directory sits beside the target so both renames stay on one filesystem.
  const staging = mkdtempSync(join(dirname(dir), `.${name}.staging-`))
  const previous = join(staging, 'previous')
  try {
    const fresh = join(staging, 'new', name)
    initProfile(fresh, template.bundles)
    let moved = false
    try {
      renameSync(dir, previous)
      moved = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    try {
      renameSync(fresh, dir)
    } catch (error) {
      // Windows reports EPERM instead of EEXIST or ENOTEMPTY, so the target's state identifies a concurrent winner.
      if (existsSync(dir)) {
        // The concurrent replacement supersedes the previous profile.
        rmSync(previous, { recursive: true, force: true })
        throw new Error(`${NAME}: profile ${JSON.stringify(name)} was recreated concurrently at ${dir}`, { cause: error })
      }
      if (moved) {
        try {
          renameSync(previous, dir)
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `${NAME}: profile replacement failed and ${dir} could not be restored from ${previous}`,
          )
        }
      }
      throw error
    }
  } catch (error) {
    // A previous profile that could not be restored stays in staging at the reported path.
    if (!existsSync(previous)) rmSync(staging, { recursive: true, force: true })
    throw error
  }
  try {
    rmSync(staging, { recursive: true, force: true })
  } catch (error) {
    // The replacement is complete; leftover files only occupy space.
    process.stderr.write(`${NAME}: replaced profile ${JSON.stringify(name)} but could not remove ${staging}: ${String(error)}\n`)
  }
}

/**
 * Load a resolved profile for `name` and (re)write the empty root config. The
 * root is always rewritten: the whole composition is patch layers, and the
 * vendored Loader's tree write-back (a plugin self-disposing persists the
 * current tree) can bake composed rows into this file — which would duplicate
 * every bundle insert on the next boot. The file exists on disk only because
 * the Loader needs a real include root to anchor `baseUrl` at the profile
 * directory (the config dump anchors on the same file, so both compose over
 * the identical base).
 * @param name - the profile name.
 * @param userLayer - `false` skips parsing `cordis.patch.yml` (the default dump).
 * @param fromDefaultProfile - shipped template that replaces the profile before loading it.
 * @returns the loaded profile.
 * @throws when explicit initialization names an unknown template or a shipped target.
 */
export function prepareProfile(name: string, userLayer = true, fromDefaultProfile?: string): Profile {
  if (fromDefaultProfile !== undefined) initializeProfileFromDefault(name, fromDefaultProfile)
  const profile = loadProfile(NAME, name, INSTALL_ANCHOR, undefined, { userLayer })
  reportSkippedBundles(NAME, profile)
  writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), PROFILE_ROOT_CONFIG)
  return profile
}

/** One profile's patch layers, in application order. */
interface ComposedProfile {
  profile: Profile
  /** Command-line overlay contents, frozen for this invocation. */
  overlays: PatchOptions[]
}

/**
 * Load `name` and compose its effective patch stack: bundle layers in
 * `dsh.profile.bundles` order (a base-backed profile gets the base bundle's
 * platform-gated shell rows), the profile's user layer, the home-level user
 * layer (`$DSH_HOME/cordis.patch.yml` — machine-local preferences that apply
 * to every profile, so it outranks the per-profile layer), `--patch` overlays,
 * then the telemetry switch.
 * @param name - the profile name.
 * @param patchFiles - `--patch` overlay paths, in argv order.
 * @param fromDefaultProfile - shipped template that replaces the named profile.
 * @param resolvedProfile - application-owned profile and installation.
 * @returns the profile and its patch layers.
 */
function composeProfile(
  name: string,
  patchFiles: readonly string[],
  fromDefaultProfile?: string,
  resolvedProfile?: ResolvedProfileRuntime,
): ComposedProfile {
  const profile = resolvedProfile?.profile ?? prepareProfile(name, true, fromDefaultProfile)
  const overlays = patchFiles.flatMap(file => loadOverlayPatches(NAME, resolve(file)))
  return { profile, overlays }
}

/** An application-owned profile and its independent installation fallback. */
export interface ResolvedProfileRuntime {
  /** Profile already loaded from the application's own directory. */
  profile: Profile
  /** Absolute package.json path of the application's dsh installation. */
  installAnchor: string
}

/** Options for {@link runProfile}. */
export interface RunProfileOptions {
  /** This run's frozen environment snapshot, provided before any entry mounts. */
  environment: LaunchEnvironmentSnapshot
  /** The profile name to boot. */
  profile: string
  /** Loaded application profile; bypasses named profile initialization when supplied. */
  resolvedProfile?: ResolvedProfileRuntime | undefined
  /** Shipped template that replaces the named profile before boot. */
  fromDefaultProfile?: string | undefined
  /** `--patch` overlay paths, in argv order. */
  patchFiles: readonly string[]
  /** The invocation's inner arguments, handed to the tree through `ctx.cmdlineArgs`. */
  args: readonly string[]
  /** Application-owned package runtime, scoped to plugin package operations. */
  packageManager?: ProfileContext['packageManager']
}

/**
 * Boot one profile invocation end to end and leave process lifetime to the
 * mounted plugins (or to a one-shot runner the composition mounts).
 * @param options - environment snapshot, profile name, overlays, and the booted app's own arguments.
 * @returns the settled root context and the shutdown controller.
 * @throws after disposing startup resources; cleanup failures retain the original error.
 */
export async function runProfile(options: RunProfileOptions): Promise<{ ctx: Context; shutdown: ProcessShutdown }> {
  const composed = composeProfile(options.profile, options.patchFiles, options.fromDefaultProfile, options.resolvedProfile)
  return runResolvedProfile({
    name: options.profile,
    profile: composed.profile,
    installAnchor: options.resolvedProfile?.installAnchor ?? INSTALL_ANCHOR,
    environment: options.environment,
    args: options.args,
    overlays: composed.overlays,
    ...(options.packageManager === undefined ? {} : { packageManager: options.packageManager }),
  })
}
