import { resolveRecipeFoods, type Food } from '@diyetgo/shared'
import { Archive, ArchiveRestore, ChefHat, Info, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { useRepositories, useRepositoryQuery } from '../../data/context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Card, PageHeader } from '../../components/ui/layout'
import { SortableTh, SortSelect, Table, Td, Th } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast-context'
import { useSort, type SortColumns } from '../../components/ui/use-sort'
import { errorMessage } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { baseUnitLabels, cookingMethodLabels, perUnitLabel } from '../../lib/labels'
import { FoodFormDialog, type FoodKind } from './FoodFormDialog'

const grams = (value: number) => `${formatNumber(value)} g`

const sortColumns: SortColumns<Food, 'name' | 'energy' | 'protein' | 'carbs' | 'fat'> = {
  name: { kind: 'text', value: (f) => f.name },
  energy: { kind: 'number', value: (f) => f.energyKcal },
  protein: { kind: 'number', value: (f) => f.proteinG },
  carbs: { kind: 'number', value: (f) => f.carbsG },
  fat: { kind: 'number', value: (f) => f.fatG },
}

const sortOptions = [
  { key: 'name', label: 'Besin' },
  { key: 'energy', label: 'Enerji' },
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Karbonhidrat' },
  { key: 'fat', label: 'Yağ' },
] as const

const kinds = { all: 'Tümü', food: 'Besinler', recipe: 'Tarifler ve yemekler' } as const
type KindFilter = keyof typeof kinds
const kindOf = (food: Pick<Food, 'recipeYieldG'>): FoodKind => (food.recipeYieldG === null ? 'food' : 'recipe')

export function FoodsPage() {
  const repositories = useRepositories()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [editing, setEditing] = useState<{ kind: FoodKind; food?: Food } | null>(null)
  const [deleting, setDeleting] = useState<{ food: Food; plansUsing: number } | null>(null)
  const query = useRepositoryQuery(
    async (r) => {
      // Tarif değerleri, aramaya uymasa da tüm malzemeler bilinerek hesaplanır.
      const [listed, all, ingredients] = await Promise.all([r.foods.list({ search, includeArchived }), r.foods.list({ includeArchived: true }), r.foods.listIngredients()])
      const resolved = resolveRecipeFoods(all, ingredients)
      return listed.map((f) => resolved.get(f.id) ?? f)
    },
    [search, includeArchived],
  )
  const foods = (query.data ?? []).filter((f) => kindFilter === 'all' || kindOf(f) === kindFilter)
  const filtered = search.trim() !== '' || includeArchived || kindFilter !== 'all'
  const sorting = useSort(foods, sortColumns)

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
        description="Besin değerleri 100 g veya 100 ml başınadır; değişimlerde 1 değişim başınadır. Tariflerin değerleri malzemelerinden hesaplanır."
        actions={
          <>
            <Button onClick={() => setEditing({ kind: 'recipe' })}>
              <ChefHat aria-hidden className="size-4" />
              Yeni tarif
            </Button>
            <Button variant="primary" onClick={() => setEditing({ kind: 'food' })}>
              <Plus aria-hidden className="size-4" />
              Yeni besin
            </Button>
          </>
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
            <span>Tür</span>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
              {Object.entries(kinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
                <Button variant="primary" onClick={() => setEditing({ kind: 'food' })}>
                  Besin ekle
                </Button>
              }
            />
          ))}
        {foods.length > 0 && (
          <>
            <SortSelect options={sortOptions} sort={sorting.sort} onChange={sorting.setSort} />
            <Table label="Besin listesi" layout="stacked">
              <thead>
                <tr>
                  <SortableTh label="Besin" column="name" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Enerji" column="energy" align="right" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Protein" column="protein" align="right" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Karbonhidrat" column="carbs" align="right" sort={sorting.sort} onSort={sorting.toggle} />
                  <SortableTh label="Yağ" column="fat" align="right" sort={sorting.sort} onSort={sorting.toggle} />
                  <Th>Porsiyon</Th>
                  <Th>
                    <span className="sr-only">İşlemler</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorting.rows.map((food) => (
                  <tr key={food.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{food.name}</span>
                      <span className="block text-xs text-slate-500">
                        {food.brand ? `${food.brand} · ` : ''}
                        {food.cookingMethod ? `${cookingMethodLabels[food.cookingMethod]} · ` : ''}
                        {perUnitLabel(food.baseUnit)}
                      </span>
                      {(food.isSample || food.archivedAt || food.recipeYieldG !== null) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {food.recipeYieldG !== null && <Badge tone="info">Tarif · malzemelerden hesaplanır</Badge>}
                          {food.isSample && <Badge tone="warning">Örnek veri – doğrulanmamış</Badge>}
                          {food.archivedAt && <Badge>Arşivde</Badge>}
                        </span>
                      )}
                    </Td>
                    <Td label="Enerji" className="text-right whitespace-nowrap tabular-nums">
                      {formatNumber(food.energyKcal, 0)} kcal
                    </Td>
                    <Td label="Protein" className="text-right whitespace-nowrap tabular-nums">
                      {grams(food.proteinG)}
                    </Td>
                    <Td label="Karbonhidrat" className="text-right whitespace-nowrap tabular-nums">
                      {grams(food.carbsG)}
                    </Td>
                    <Td label="Yağ" className="text-right whitespace-nowrap tabular-nums">
                      {grams(food.fatG)}
                    </Td>
                    <Td label="Porsiyon">
                      {food.portionLabel && food.portionAmount !== null ? `${food.portionLabel} (${formatNumber(food.portionAmount)} ${baseUnitLabels[food.baseUnit]})` : '—'}
                    </Td>
                    <Td className="text-right whitespace-nowrap max-sm:justify-end">
                      <Button variant="ghost" size="sm" aria-label={`${food.name} düzenle`} onClick={() => setEditing({ kind: kindOf(food), food })}>
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
          </>
        )}
      </Card>

      <FoodFormDialog open={editing !== null} kind={editing?.kind ?? 'food'} food={editing?.food} onClose={() => setEditing(null)} />

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
