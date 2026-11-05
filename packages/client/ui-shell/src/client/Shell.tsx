/** Session-free root with content extensions and appearance preferences. */
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalLayer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LocaleSnapshot } from '@deepseek-ai/dsh-client-locale/client'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './shell.module.css'

/** Service-owned snapshots and preference commands; no persistence lives in this component. */
export interface ShellInjected {
  hooks: { theme: HostObservable<ThemeSnapshot>; locale: HostObservable<LocaleSnapshot> }
  setTheme: (id: string) => void
  setLocale: (id: string) => void
}

type Props = PropsRuntime<'root'> & PropsLocale<'shell'> & PropsRenderSlots<'shell.content'> & InjectFace<ShellInjected>

/**
 * Render the application frame and its root-scoped contributions.
 * @param props - Renderer-bound locale, child slots, and preference commands.
 * @returns Application frame and its optional modal settings layer.
 */
export function Shell({ t, renderSlot, useTheme, useLocale, setTheme, setLocale }: Props) {
  const preference = useTheme(snapshot => snapshot.preference)
  const locale = useLocale(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const languageId = useId()
  const themeName = useId()
  const close = () => { setOpen(false) }
  useModalLayer(dialog, open, close)

  return <>
    <div className={css.frame} data-shell-root {...{ inert: open ? '' : undefined }}>
      <header className={css.header} data-window-drag>
        <span className={css.brand}>{t('title')}</span>
        <button type="button" className={css.settingsButton} data-shell-settings-trigger
          aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(true) }}>
          {t('settings')}
        </button>
      </header>
      <main className={css.main} aria-label={t('content')}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.description}>{t('description')}</p>
        {renderSlot('shell.content', {})}
      </main>
      <div data-shell-overlay className={css.overlay} />
    </div>
    {open && createPortal(<div className={css.modalLayer}>
      <div className={css.backdrop} data-shell-settings-backdrop aria-hidden="true" onClick={close} />
      <div ref={dialog} className={css.dialog} data-shell-settings role="dialog" aria-modal="true"
        aria-labelledby={titleId} tabIndex={-1}>
        <div className={css.dialogHeader}>
          <h2 id={titleId} className={css.dialogTitle}>{t('settings')}</h2>
          <button type="button" className={css.closeButton} data-modal-autofocus onClick={close}>{t('closeSettings')}</button>
        </div>
        <p className={css.description}>{t('settingsDescription')}</p>
        <fieldset className={css.field}>
          <legend className={css.label}>{t('theme')}</legend>
          <div className={css.themes}>
            {(['system', 'light', 'dark'] as const).map(id => <label key={id} className={css.themeChoice}>
              <input type="radio" name={themeName} value={id} checked={preference === id}
                onChange={() => { setTheme(id) }} />
              <span>{t(id)}</span>
            </label>)}
          </div>
        </fieldset>
        <div className={css.field}>
          <label className={css.label} htmlFor={languageId}>{t('language')}</label>
          <select id={languageId} className={css.language} value={locale.active}
            onChange={(event) => { setLocale(event.currentTarget.value) }}>
            {locale.locales.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
      </div>
    </div>, document.body)}
  </>
}
