import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { SelectField } from './form'
import type { SortState } from './use-sort'

/**
 * - `scroll`: tüm sütunlar görünür, dar ekranda tablo yatay kaydırılır (klavyeyle de kaydırılabilir).
 * - `stacked`: dar ekranda her satır, `Td`'lerin `label`'larıyla etiketlenmiş bir karta dönüşür (`index.css`).
 */
export function Table({ children, label, layout = 'scroll' }: { children: ReactNode; label: string; layout?: 'scroll' | 'stacked' }) {
  return (
    // `relative`: hücrelerdeki mutlak konumlu öğeler (ör. `sr-only` başlıklar) kaydırma alanında kırpılır;
    // aksi hâlde sayfaya göre konumlanıp tüm sayfayı genişletirler.
    <div className="relative overflow-x-auto" tabIndex={layout === 'scroll' ? 0 : undefined}>
      <table aria-label={label} className={`min-w-full divide-y divide-slate-200 text-sm ${layout === 'stacked' ? 'table-stacked' : ''}`}>
        {children}
      </table>
    </div>
  )
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase ${className}`} {...props} />
}

/** `label`, kart düzeninde hücrenin başlığı olarak gösterilir. */
export function Td({ className = '', label, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return <td data-label={label} className={`px-4 py-3 align-middle text-slate-700 ${className}`} {...props} />
}

/** Sıralanabilir sütun başlığı: başlık bir butondur (klavyeyle erişilebilir), durum `aria-sort` ile bildirilir. */
export function SortableTh<K extends string>({
  label,
  column,
  sort,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string
  column: K
  sort: SortState<K>
  onSort: (column: K) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const direction = sort?.key === column ? sort.direction : null
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <Th aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'} className={`${align === 'right' ? 'text-right' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 rounded-sm tracking-wide uppercase hover:text-slate-900 ${direction ? 'text-slate-900' : ''}`}
      >
        {label}
        <Icon aria-hidden className={`size-3.5 ${direction ? '' : 'text-slate-400'}`} />
      </button>
    </Th>
  )
}

/** Kart düzeninde sütun başlıkları gizlendiği için dar ekranda sıralamayı seçme alanı. */
export function SortSelect<K extends string>({
  options,
  sort,
  onChange,
}: {
  options: readonly { key: K; label: string }[]
  sort: SortState<K>
  onChange: (sort: SortState<K>) => void
}) {
  const value = sort ? `${sort.key}:${sort.direction}` : ''
  return (
    <div className="border-b border-slate-200 px-4 py-3 sm:hidden">
      <SelectField
        label="Sırala"
        value={value}
        onChange={(e) => {
          const [key, direction] = e.target.value.split(':') as [K, 'asc' | 'desc']
          onChange(e.target.value ? { key, direction } : null)
        }}
      >
        <option value="">Varsayılan sıra</option>
        {options.map(({ key, label }) => (
          <optgroup key={key} label={label}>
            <option value={`${key}:asc`}>{label} (artan)</option>
            <option value={`${key}:desc`}>{label} (azalan)</option>
          </optgroup>
        ))}
      </SelectField>
    </div>
  )
}
