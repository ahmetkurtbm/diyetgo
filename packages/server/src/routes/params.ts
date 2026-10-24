import { z } from 'zod'
import { parse } from '../errors'

/** Sorgu parametresi tek bir metinse onu, değilse `undefined` döndürür. */
export const stringParam = (value: unknown) => (typeof value === 'string' ? value : undefined)

export const includeArchivedParam = (value: unknown) => value === 'true'

const archivedBodySchema = z.object({ archived: z.boolean() })

export const archivedBody = (body: unknown) => parse(archivedBodySchema, body).archived
