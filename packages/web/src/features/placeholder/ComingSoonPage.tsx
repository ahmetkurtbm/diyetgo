import { Hammer } from 'lucide-react'
import { EmptyState } from '../../components/ui/feedback'
import { Card, PageHeader } from '../../components/ui/layout'

/** Henüz geliştirilmemiş modüller için geçici sayfa; ilgili aşamada gerçek sayfayla değiştirilir. */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={Hammer} title="Bu bölüm hazırlanıyor" description="Bu modül bir sonraki geliştirme adımında eklenecek." />
      </Card>
    </>
  )
}
