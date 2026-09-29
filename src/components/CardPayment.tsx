import { Loader2, Lock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PaymentInfo } from '../lib/api'
import { loadPok } from '../lib/pok'
import { useOrderActions } from '../state/store'
import { getLang, t } from '../i18n'
import { track } from '../lib/telemetry'

type Phase = 'loading' | 'form' | 'confirming' | 'unconfirmed' | 'error'

/**
 * POK's card form for an unpaid order. Like the ag-web-visionfx checkout, the form's success callback is only a
 * hint: the server reads the order back from POK (and finishes it if it's still uncaptured) before the
 * reservation counts. onPaid runs once the server says the order is paid.
 */
export function CardPayment({ orderId, payment, onPaid }: { orderId: string; payment: PaymentInfo; onPaid: () => void }) {
  const actions = useOrderActions()
  const mountId = `pok-form-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const paidRef = useRef(onPaid)
  useEffect(() => {
    paidRef.current = onPaid
  }, [onPaid])

  const confirm = async () => {
    setPhase('confirming')
    try {
      const { paid } = await actions.verifyPayment(orderId)
      if (paid) return paidRef.current()
      setPhase('unconfirmed')
    } catch {
      setPhase('unconfirmed')
    }
  }

  useEffect(() => {
    let alive = true
    const el = document.getElementById(mountId)
    if (el) el.innerHTML = ''
    loadPok()
      .then((pok) => {
        if (!alive || !payment.sdkOrderId) return
        setPhase('form')
        pok.renderForm(
          mountId,
          payment.sdkOrderId,
          () => alive && confirm(),
          () => {
            if (!alive) return
            track('payment_failed')
            setMessage(t('That payment didn’t go through. Check the card details and try again.'))
            setPhase('error')
          },
          { env: payment.env ?? 'production', locale: getLang() === 'sq' ? 'al' : 'en' },
        )
      })
      .catch(() => {
        if (!alive) return
        setMessage(t('The card form couldn’t load. Check your connection and try again.'))
        setPhase('error')
      })
    return () => {
      alive = false
    }
    // confirm only reads stable values; the form is rendered again for each attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountId, payment.sdkOrderId, payment.env, attempt])

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {t('Card details go straight to POK. Ngopu never sees them.')}
      </p>
      <div id={mountId} className={phase === 'form' || phase === 'error' ? 'min-h-[220px]' : 'hidden'} />
      {phase === 'loading' && (
        <p className="flex items-center gap-2 py-8 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('Preparing the secure card form…')}
        </p>
      )}
      {phase === 'confirming' && (
        <p role="status" className="flex items-center gap-2 py-8 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('Confirming your payment…')}
        </p>
      )}
      {phase === 'unconfirmed' && (
        <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{t('We couldn’t confirm the payment yet.')}</p>
          <p className="mt-1">{t('Please don’t pay again. Your bag stays held for a few minutes while we check.')}</p>
          <button type="button" onClick={confirm} className="mt-2 font-semibold underline underline-offset-2">
            {t('Check again')}
          </button>
        </div>
      )}
      {phase === 'error' && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <p>{message}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-2 font-semibold underline underline-offset-2">
            {t('Try again')}
          </button>
        </div>
      )}
    </div>
  )
}
