import type { Client } from '@diyetgo/shared'
import { CalendarDays, Plus } from 'lucide-react'
import { useState } from 'react'
import { useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader } from '../../components/ui/layout'
import { AppointmentFormDialog } from './AppointmentFormDialog'
import { AppointmentList } from './AppointmentList'

/** Danışan detayında danışanın randevuları; en yeni önce. */
export function ClientAppointmentsCard({ client }: { client: Client }) {
  const [creating, setCreating] = useState(false)
  const query = useRepositoryQuery(async (r) => (await r.appointments.list({ clientId: client.id })).reverse(), [client.id])
  const appointments = query.data ?? []
  const archived = client.archivedAt !== null

  return (
    <Card>
      <CardHeader
        title="Randevular"
        description={archived ? 'Arşivdeki danışana yeni randevu eklenemez.' : undefined}
        actions={
          !archived && (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" />
              Yeni randevu
            </Button>
          )
        }
      />
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && <ErrorState error={query.error} />}
      {query.status === 'success' && appointments.length === 0 && <EmptyState icon={CalendarDays} title="Henüz randevu yok" />}
      {appointments.length > 0 && <AppointmentList appointments={appointments} />}
      <AppointmentFormDialog open={creating} clientId={client.id} onClose={() => setCreating(false)} />
    </Card>
  )
}
