import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(import.meta.dirname, '../.github/workflows/build-preview-cloudflare.yml'), 'utf8')
const workflow = yaml.load(source) as {
  on: unknown
  permissions: unknown
  concurrency: unknown
  env: Record<string, string>
  jobs: Record<'build', {
    'runs-on': string
    steps: Array<{ name?: string; uses?: string; run?: string; 'continue-on-error'?: boolean; with?: Record<string, unknown> }>
  }>
}
const build = workflow.jobs.build

describe('Web shell build workflow', () => {
  it('keeps the selected Linux runner and read-only checkout for each PR', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['build'])
    expect(build['runs-on']).toContain('blacksmith-4vcpu-ubuntu-2404')
    expect(build['runs-on']).toContain("'ubuntu-24.04'")
    expect(build['runs-on']).toContain('DSH_CI_FAILOVER_LINUX')
    expect(workflow.on).toEqual({ pull_request: { types: ['opened', 'synchronize', 'reopened'] } })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(build.steps.find(step => step.uses === 'actions/checkout@v7.0.1')?.with).toEqual({ 'persist-credentials': false })
    expect(workflow.concurrency).toEqual({
      group: 'build-web-shell-${{ github.event.pull_request.number }}',
      'cancel-in-progress': true,
    })
  })

  it('retains immutable installation, the full build, and restore-only caching', () => {
    expect(workflow.env.PRIMARY_NODE_VERSION).toBe('24')
    expect(workflow.env.DSH_TELEMETRY_DISABLED).toBe('1')
    const commands = build.steps.map(step => step.run)
    expect(commands).toContain('pnpm install --frozen-lockfile')
    expect(commands).toContain('pnpm run build')
    expect(build.steps.find(step => step.run === 'pnpm run build')?.['continue-on-error']).toBeUndefined()
    expect(build.steps.filter(step => step.uses?.startsWith('actions/cache'))).toHaveLength(1)
    expect(build.steps.find(step => step.uses === 'actions/cache/restore@v6.1.0')?.with).toMatchObject({
      key: "${{ runner.os }}-node-${{ env.PRIMARY_NODE_VERSION }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}",
    })
  })

  it('does not pack or publish a business Worker preview or consume deployment credentials', () => {
    expect(source).not.toMatch(/build:preview|preview\.html|vfs-image|wrangler|secrets\.|gh pr comment/)
    expect(workflow.env).not.toHaveProperty('CF_PROJECT')
    expect(build.steps.at(-1)?.run).toBe('pnpm run build')
  })
})
