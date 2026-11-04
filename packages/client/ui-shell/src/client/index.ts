/** Session-free application root, localized copy, and theme presentation. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { Shell, type ShellInjected } from './Shell.tsx'
import { en, zh } from './locales.ts'
import { presentTheme } from './theme.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Session-free shell copy. */
    shell: keyof typeof en
  }
  interface SlotMap {
    /** Additive application content without Session binding. */
    'shell.content': { kind: 'list'; scope: 'root' }
  }
}

/** The shell uses no conversation, navigation, or Session services. */
export const inject = ['slots', 'locale', 'theme']

/** Register the root and its content position for this plugin lifetime. @param ctx - Client plugin scope. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('shell', { en, zh }), 'shell: copy')
  const settings: ShellInjected = {
    hooks: {
      theme: {
        getSnapshot: () => ctx.theme.getTheme(),
        subscribe: listener => ctx.on('theme/change', () => { listener() }),
      },
      locale: {
        getSnapshot: () => ctx.locale.getLocale(),
        subscribe: listener => ctx.locale.subscribe(listener),
      },
    },
    setTheme: (id) => { ctx.theme.setTheme(id) },
    setLocale: (id) => { ctx.locale.setLocale(id) },
  }
  ctx.effect(() => ctx.slots.register({ name: 'root', locale: 'shell', inject: () => settings, children: {
    'shell.content': { kind: 'list', scope: 'root' },
  } }, Shell), 'shell: root')
  ctx.effect(() => presentTheme(ctx), 'shell: theme')
}
