import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../i18n'

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white px-4">
      {back && (
        <button
          type="button"
          aria-label={t('Back')}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="-ml-2 rounded-full p-2 hover:bg-line"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
      {right}
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-light text-brand">{icon}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
