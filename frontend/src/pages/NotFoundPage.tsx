import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/States'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="size-6" />}
      title="Page not found"
      message="The page you are looking for does not exist or you do not have access to it."
      action={
        <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Back to dashboard
        </Link>
      }
    />
  )
}
