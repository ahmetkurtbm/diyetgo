import { describe, expect, it } from 'vitest'
import { sortRows, type SortColumns } from './use-sort'

type Row = { name: string; date: string; amount: number | null }
const rows: Row[] = [
  { name: 'Ömer', date: '2026-03-10', amount: 10 },
  { name: 'Cem', date: '2025-12-31', amount: null },
  { name: 'Çağla', date: '2026-01-05', amount: 2 },
  { name: 'ırmak', date: '2026-03-10', amount: 100 },
  { name: 'İpek', date: '2026-02-28', amount: 2 },
  { name: 'Oya', date: '2026-01-05', amount: null },
]
const columns: SortColumns<Row, 'name' | 'date' | 'amount'> = {
  name: { kind: 'text', value: (r) => r.name },
  date: { kind: 'date', value: (r) => r.date },
  amount: { kind: 'number', value: (r) => r.amount },
}
const names = (sorted: Row[]) => sorted.map((r) => r.name)

describe('sortRows', () => {
  it('sıralama yoksa veri kaynağının sırasını korur ve girdiyi değiştirmez', () => {
    const copy = [...rows]
    expect(sortRows(rows, columns, null)).toEqual(rows)
    sortRows(rows, columns, { key: 'name', direction: 'desc' })
    expect(rows).toEqual(copy)
  })

  it('metinleri Türkçe alfabeye göre sıralar (C < Ç, I < İ, O < Ö)', () => {
    expect(names(sortRows(rows, columns, { key: 'name', direction: 'asc' }))).toEqual(['Cem', 'Çağla', 'ırmak', 'İpek', 'Oya', 'Ömer'])
    expect(names(sortRows(rows, columns, { key: 'name', direction: 'desc' }))).toEqual(['Ömer', 'Oya', 'İpek', 'ırmak', 'Çağla', 'Cem'])
  })

  it('sayıları metin olarak değil sayısal olarak sıralar; boş değerler her yönde sondadır', () => {
    expect(names(sortRows(rows, columns, { key: 'amount', direction: 'asc' }))).toEqual(['Çağla', 'İpek', 'Ömer', 'ırmak', 'Cem', 'Oya'])
    expect(names(sortRows(rows, columns, { key: 'amount', direction: 'desc' }))).toEqual(['ırmak', 'Ömer', 'Çağla', 'İpek', 'Cem', 'Oya'])
  })

  it('takvim günlerini sıralar; eşit değerlerde kaynak sırası korunur', () => {
    expect(names(sortRows(rows, columns, { key: 'date', direction: 'asc' }))).toEqual(['Cem', 'Çağla', 'Oya', 'İpek', 'Ömer', 'ırmak'])
    expect(names(sortRows(rows, columns, { key: 'date', direction: 'desc' }))).toEqual(['Ömer', 'ırmak', 'İpek', 'Çağla', 'Oya', 'Cem'])
  })
})
