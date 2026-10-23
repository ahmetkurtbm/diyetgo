import type { Food } from '@diyetgo/shared'
import { Archive, ArchiveRestore, Info, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, PageHeader } from '../../components/ui/layout'
import { Table, Td, Th } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast-context'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { FoodFormDialog } from './FoodFormDialog'

const grams = (value: number) => `${formatNumber(value)} g`

export function FoodsPage() {
  const repositories = useRepositories()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [editing, setEditing] = useState<Food | 'new' | null>(null)
  const [deleting, setDeleting] = useState<{ food: Food; plansUsing: number } | null>(null)
  const query = useRepositoryQuery((r) => r.foods.list({ search, includeArchived }), [search, includeArchived])
  const foods = query.data ?? []
  const filtered = search.trim() !== '' || includeArchived

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function startDelete(food: Food) {
    try {
      setDeleting({ food, plansUsing: await repositories.foods.countPlansUsing(food.id) })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Besinler"
        description="Besin değerleri 100 g veya 100 ml başınadır."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" />
            Yeni besin
          </Button>
        }
      />
      <p role="note" className="mb-4 flex gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Plan toplamları besin değerlerinden canlı hesaplanır: bir besini düzenlediğinizde onu kullanan tüm planların toplamları da değişir.
      </p>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block sm:w-80">
            <span className="sr-only">Besin ara</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Besin adı veya marka ara"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm placeholder:text-slate-400"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="size-4 rounded border-slate-300 accent-brand-700" />
            Arşivdekileri göster
          </label>
        </div>

        {query.status === 'loading' && <LoadingState />}
        {query.status === 'error' && <ErrorState error={query.error} />}
        {query.status === 'success' && foods.length === 0 &&
          (filtered ? (
            <EmptyState icon={Search} title="Sonuç bulunamadı" description="Arama ölçütlerini değiştirip tekrar deneyin." />
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Henüz besin yok"
              description="Planlarda kullanmak için ilk besini ekleyin."
              action={
                <Button variant="primary" onClick={() => setEditing('new')}>
                  Besin ekle
                </Button>
              }
            />
          ))}
        {foods.length > 0 && (
          <Table label="Besin listesi">
            <thead>
              <tr>
                <Th>Besin</Th>
                <Th className="hidden text-right sm:table-cell">Enerji</Th>
                <Th className="hidden text-right md:table-cell">Protein</Th>
                <Th className="hidden text-right md:table-cell">Karbonhidrat</Th>
                <Th className="hidden text-right md:table-cell">Yağ</Th>
                <Th className="hidden lg:table-cell">Porsiyon</Th>
                <Th>
                  <span className="sr-only">İşlemler</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {foods.map((food) => (
                <tr key={food.id}>
                  <Td>
                    <span className="font-medium text-slate-900">{food.name}</span>
                    <span className="block text-xs text-slate-500">
                      {food.brand ? `${food.brand} · ` : ''}100 {food.baseUnit} başına
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600 tabular-nums md:hidden">
                      <span className="sm:hidden">{formatNumber(food.energyKcal, 0)} kcal · </span>P {formatNumber(food.proteinG)} · K {formatNumber(food.carbsG)} · Y{' '}
                      {formatNumber(food.fatG)} g
                    </span>
                    {(food.isSample || food.archivedAt) && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {food.isSample && <Badge tone="warning">Örnek veri – doğrulanmamış</Badge>}
                        {food.archivedAt && <Badge>Arşivde</Badge>}
                      </span>
                    )}
                  </Td>
                  <Td className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">{formatNumber(food.energyKcal, 0)} kcal</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{grams(food.proteinG)}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{grams(food.carbsG)}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{grams(food.fatG)}</Td>
                  <Td className="hidden lg:table-cell">
                    {food.portionLabel && food.portionAmount !== null ? `${food.portionLabel} (${formatNumber(food.portionAmount)} ${food.baseUnit})` : '—'}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" aria-label={`${food.name} düzenle`} onClick={() => setEditing(food)}>
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={food.archivedAt ? `${food.name} arşivden çıkar` : `${food.name} arşivle`}
                      onClick={() =>
                        run(() => repositories.foods.setArchived(food.id, food.archivedAt === null), food.archivedAt ? 'Besin arşivden çıkarıldı.' : 'Besin arşivlendi.')
                      }
                    >
                      {food.archivedAt ? <ArchiveRestore aria-hidden className="size-4" /> : <Archive aria-hidden className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`${food.name} sil`} onClick={() => void startDelete(food)}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <FoodFormDialog open={editing !== null} food={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />

      {/* Planda kullanılan besin silinemez; arşivleme önerilir. */}
      <Dialog
        open={deleting !== null && deleting.plansUsing > 0}
        onClose={() => setDeleting(null)}
        title="Besin silinemez"
        description={deleting ? `"${deleting.food.name}" ${deleting.plansUsing} planda kullanılıyor. Planlardaki değerleri korumak için silmek yerine arşivleyin; arşivlenen besin yeni öğünlere eklenemez ama mevcut planlarda görünmeye devam eder.` : undefined}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Vazgeç</Button>
            {deleting && deleting.food.archivedAt === null && (
              <Button
                variant="primary"
                onClick={() => {
                  const { food } = deleting
                  setDeleting(null)
                  void run(() => repositories.foods.setArchived(food.id, true), 'Besin arşivlendi.')
                }}
              >
                Arşivle
              </Button>
            )}
          </>
        }
      />
      <ConfirmDialog
        open={deleting !== null && deleting.plansUsing === 0}
        title="Besin silinsin mi?"
        description={deleting ? `"${deleting.food.name}" kalıcı olarak silinir.` : undefined}
        confirmLabel="Sil"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting
          setDeleting(null)
          if (target) void run(() => repositories.foods.remove(target.food.id), 'Besin silindi.')
        }}
      />
    </>
  )
}
