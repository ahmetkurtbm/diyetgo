import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/feedback'
import { Card, PageHeader } from '../../components/ui/layout'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Sayfa bulunamadı" />
      <Card>
        <EmptyState
          icon={SearchX}
          title="Bu adreste bir sayfa yok"
          description="Aradığınız sayfa taşınmış veya hiç var olmamış olabilir."
          action={
            <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
              Genel bakışa dön
            </Link>
          }
        />
      </Card>
    </>
  )
}
