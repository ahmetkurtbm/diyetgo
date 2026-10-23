import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/feedback'
import { Card } from '../../components/ui/layout'

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Sayfa bulunamadı"
        description="Aradığınız sayfa taşınmış veya hiç var olmamış olabilir."
        action={
          <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
            Genel bakışa dön
          </Link>
        }
      />
    </Card>
  )
}
