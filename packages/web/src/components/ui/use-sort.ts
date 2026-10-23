import { useState } from 'react'

export type SortDirection = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; direction: SortDirection } | null
/** Takvim günü ve ISO zaman metinleri (`date`) sözlük sırasıyla doğru sıralanır; `null` her yönde sona konur. */
export type SortColumn<T> = { value: (row: T) => string | number | null; kind: 'text' | 'number' | 'date' }
export type SortColumns<T, K extends string> = Record<K, SortColumn<T>>

const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true })

/** Satırları sıralar; sıralama yoksa veya eşitlikte verilen sıra korunur. Girdi değiştirilmez. */
export function sortRows<T, K extends string>(rows: readonly T[], columns: SortColumns<T, K>, sort: SortState<K>): T[] {
  if (!sort) return [...rows]
  const { value, kind } = columns[sort.key]
  const sign = sort.direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, v: value(row) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.index - b.index : a.v === null ? 1 : -1
      let order: number
      if (kind === 'number') order = Number(a.v) - Number(b.v)
      else if (kind === 'date') order = a.v < b.v ? -1 : a.v > b.v ? 1 : 0
      else order = collator.compare(String(a.v), String(b.v))
      return order === 0 ? a.index - b.index : sign * order
    })
    .map((entry) => entry.row)
}

/** Tablo sıralama durumu; aynı başlığa tekrar basmak yönü değiştirir. Başlangıçta veri kaynağının sırası kullanılır. */
export function useSort<T, K extends string>(rows: readonly T[], columns: SortColumns<T, K>) {
  const [sort, setSort] = useState<SortState<K>>(null)
  const toggle = (key: K) => setSort((current) => (current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
  return { rows: sortRows(rows, columns, sort), sort, setSort, toggle }
}
