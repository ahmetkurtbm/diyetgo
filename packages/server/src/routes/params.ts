import type { Response } from 'express'
import { z } from 'zod'
import { parse } from '../errors'

/** Sorgu parametresi tek bir metinse onu, değilse `undefined` döndürür. */
export const stringParam = (value: unknown) => (typeof value === 'string' ? value : undefined)

export const includeArchivedParam = (value: unknown) => value === 'true'

const archivedBodySchema = z.object({ archived: z.boolean() })

export const archivedBody = (body: unknown) => parse(archivedBodySchema, body).archived

/** Oturum ara katmanının (`app.ts`) belirlediği, isteği yapan diyetisyenin kimliği. */
export function ownerOf(res: Response): string {
  const ownerId: unknown = res.locals.ownerId
  if (typeof ownerId !== 'string') throw new Error('Oturum ara katmanı çalışmadan servis çağrıldı.')
  return ownerId
}
