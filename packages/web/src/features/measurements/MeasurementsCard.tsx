import type { Measurement } from '@diyetgo/shared'
import { Pencil, Plus, Ruler, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, CardHeader } from '../../components/ui/layout'
import { Table, Td, Th } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatNumber } from '../../lib/format'
import { MeasurementFormDialog } from './MeasurementFormDialog'
import { WeightChart } from './WeightChart'

const value = (v: number | null, unit: string) => (v === null ? '—' : `${formatNumber(v)} ${unit}`)

export function MeasurementsCard({ clientId }: { clientId: string }) {
  const repositories = useRepositories()
  const toast = useToast()
  const query = useRepositoryQuery((r) => r.measurements.listByClient(clientId), [clientId])
  const [editing, setEditing] = useState<Measurement | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Measurement | null>(null)

  const measurements = query.data ?? []
  const weights = measurements.flatMap((m) => (m.weightKg === null ? [] : [{ date: m.measuredOn, value: m.weightKg }]))

  async function remove(measurement: Measurement) {
    setDeleting(null)
    try {
      await repositories.measurements.remove(measurement.id)
      toast.success('Ölçüm silindi.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Ölçümler"
        description="Boy, kilo ve vücut ölçümleri"
        actions={
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            Ölçüm ekle
          </Button>
        }
      />
      {query.status === 'loading' && <LoadingState />}
      {query.status === 'error' && <ErrorState error={query.error} />}
      {query.status === 'success' && measurements.length === 0 && (
        <EmptyState
          icon={Ruler}
          title="Henüz ölçüm yok"
          description="İlk ölçümü ekleyerek gelişim takibine başlayın."
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              Ölçüm ekle
            </Button>
          }
        />
      )}
      {measurements.length > 0 && (
        <>
          <WeightChart points={weights} />
          <Table label="Ölçüm geçmişi">
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th className="text-right">Kilo</Th>
                <Th className="hidden text-right sm:table-cell">Boy</Th>
                <Th className="hidden text-right md:table-cell">Bel</Th>
                <Th className="hidden text-right md:table-cell">Kalça</Th>
                <Th className="hidden text-right lg:table-cell">Yağ oranı</Th>
                <Th>
                  <span className="sr-only">İşlemler</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {measurements.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">
                    <span className="font-medium text-slate-900">{formatDate(m.measuredOn)}</span>
                    {m.notes && <span className="block max-w-56 truncate text-xs text-slate-500">{m.notes}</span>}
                  </Td>
                  <Td className="text-right tabular-nums">{value(m.weightKg, 'kg')}</Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{value(m.heightCm, 'cm')}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{value(m.waistCm, 'cm')}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{value(m.hipCm, 'cm')}</Td>
                  <Td className="hidden text-right tabular-nums lg:table-cell">{m.bodyFatPct === null ? '—' : `%${formatNumber(m.bodyFatPct)}`}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" aria-label={`${formatDate(m.measuredOn)} ölçümünü düzenle`} onClick={() => setEditing(m)}>
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`${formatDate(m.measuredOn)} ölçümünü sil`} onClick={() => setDeleting(m)}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      <MeasurementFormDialog
        open={editing !== null}
        clientId={clientId}
        measurement={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Ölçüm silinsin mi?"
        description={deleting ? `${formatDate(deleting.measuredOn)} tarihli ölçüm kalıcı olarak silinir.` : undefined}
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </Card>
  )
}
