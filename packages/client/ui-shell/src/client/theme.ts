/** Own the shell's document palette without importing the conversation layout. */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

/**
 * Install theme projection and restore prior document values on disposal.
 * @param ctx - Theme-owning plugin scope.
 * @returns Projection disposer.
 */
export function presentTheme(ctx: Context): () => void {
  const root = document.documentElement
  const body = document.body
  const oldScheme = root.style.colorScheme
  const oldSource = root.getAttribute('data-ds-theme-source')
  const oldDark = body.getAttribute('data-ds-dark-theme')
  const previous = new Map<string, string>()
  let applied: Array<readonly [string, string]> = []
  const restore = ([name, value]: readonly [string, string]) => {
    if (value === '') body.style.removeProperty(name)
    else body.style.setProperty(name, value)
  }
  const apply = (snapshot: ThemeSnapshot) => {
    root.style.colorScheme = snapshot.active.colorScheme
    root.setAttribute('data-ds-theme-source', snapshot.preference === 'system' ? 'system' : snapshot.active.colorScheme)
    body.toggleAttribute('data-ds-dark-theme', snapshot.active.colorScheme === 'dark')
    for (const name of applied) restore(name)
    const tokens = { ...snapshot.active.tokens,
      '--dsh-content-font-size': `${snapshot.fontSizes.text}px`,
      '--dsh-code-font-size': `${snapshot.fontSizes.code}px`,
      '--dsh-terminal-font-size': `${snapshot.fontSizes.terminal}px`,
    }
    applied = []
    for (const [name, value] of Object.entries(tokens)) {
      let original = previous.get(name)
      if (original === undefined) {
        original = body.style.getPropertyValue(name)
        previous.set(name, original)
      }
      applied.push([name, original])
      body.style.setProperty(name, value)
    }
  }
  apply(ctx.theme.getTheme())
  const off = ctx.on('theme/change', apply)
  return () => {
    off()
    for (const name of applied) restore(name)
    root.style.colorScheme = oldScheme
    if (oldSource === null) root.removeAttribute('data-ds-theme-source')
    else root.setAttribute('data-ds-theme-source', oldSource)
    if (oldDark === null) body.removeAttribute('data-ds-dark-theme')
    else body.setAttribute('data-ds-dark-theme', oldDark)
  }
}
