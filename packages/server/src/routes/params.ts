import type { Response } from 'express'
import { z } from 'zod'
import { ApiError, parse } from '../errors'
import type { Page } from '../services/common'

/** Sorgu parametresi tek bir metinse onu, değilse `undefined` döndürür. */
export const stringParam = (value: unknown) => (typeof value === 'string' ? value : undefined)

export const includeArchivedParam = (value: unknown) => value === 'true'

/** Negatif olmayan tam sayı sorgu parametresi; verilmemişse `undefined`, geçersizse `validation` hatası. */
function integerParam(value: unknown, field: string, min: number): number | undefined {
  if (value === undefined) return undefined
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number < min) {
    throw new ApiError('validation', 'Geçersiz sayfa parametresi.', { fieldErrors: { [field]: 'Geçersiz sayı' } })
  }
  return number
}

/** `?limit=&offset=` sorgusu; üst sınır serviste uygulanır (`pageOf`). */
export const pageParams = (query: Record<string, unknown>): Page => ({
  limit: integerParam(query.limit, 'limit', 1),
  offset: integerParam(query.offset, 'offset', 0),
})

const archivedBodySchema = z.object({ archived: z.boolean() })

export const archivedBody = (body: unknown) => parse(archivedBodySchema, body).archived

/** Oturum ara katmanının (`app.ts`) belirlediği, isteği yapan diyetisyenin kimliği. */
export function ownerOf(res: Response): string {
  const ownerId: unknown = res.locals.ownerId
  if (typeof ownerId !== 'string') throw new Error('Oturum ara katmanı çalışmadan servis çağrıldı.')
  return ownerId
}
