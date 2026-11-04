/** Client type selection for the standalone shell's forwarded settings notification. */
import type {} from '@deepseek-ai/dsh-settings/types'
import type {} from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteEventSelection {
    'settings/document-updated': true
  }
}
