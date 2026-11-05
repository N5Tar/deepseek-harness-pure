/** Browser title projection: the frame's product title, without subscribing to session content. */
import { useEffect } from 'react'

/** Props for the browser title projection. */
export interface DocumentTitleProps {
  /** Build-configured or localized product title. */
  productTitle: string
}

/**
 * Project the product title into the browser title and restore it when unmounted.
 * @param props - The frame's product title.
 * @returns No rendered content.
 */
export function DocumentTitle({ productTitle }: DocumentTitleProps): null {
  useEffect(() => {
    document.title = productTitle
    return () => { document.title = productTitle }
  }, [productTitle])
  return null
}
