import { clsx } from 'clsx'
import { useState } from 'react'

import { initials } from '@/lib/format'

interface CompanyLogoProps {
  name: string
  src: string | null
  size?: 'sm' | 'lg'
}

export function CompanyLogo({ name, src, size = 'sm' }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false)
  const dimensions = size === 'lg' ? 'size-16 text-lg' : 'size-9 text-xs'

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-lg bg-white object-contain ring-1 ring-slate-200', dimensions)}
      />
    )
  }

  return (
    <div
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-600',
        dimensions,
      )}
    >
      {initials(name) || '?'}
    </div>
  )
}
