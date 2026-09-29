import { LegalPage } from './LegalPage'
import { PRIVACY_COPY, PRIVACY_TITLES, PRIVACY_UPDATED } from './privacyCopy'

export function Privacy() {
  return <LegalPage copy={PRIVACY_COPY} titles={PRIVACY_TITLES} updated={PRIVACY_UPDATED} />
}
