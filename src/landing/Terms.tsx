import { LegalPage } from './LegalPage'
import { TERMS_COPY, TERMS_TITLES, TERMS_UPDATED } from './termsCopy'

export function Terms() {
  return <LegalPage copy={TERMS_COPY} titles={TERMS_TITLES} updated={TERMS_UPDATED} />
}
