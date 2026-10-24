/**
 * API hata modeli. Kodlar web'deki `RepositoryError` kodlarıyla aynıdır; yanıt gövdesi
 * `{ error: { code, message, fieldErrors, conflictingIds } }` biçimindedir.
 */
import type { ErrorRequestHandler } from 'express'

export type ApiErrorCode = 'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'restricted' | 'internal'

const STATUS: Record<ApiErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  restricted: 409,
  internal: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly fieldErrors: Record<string, string>
  readonly conflictingIds: string[]

  constructor(
    code: ApiErrorCode,
    message: string,
    extra: { fieldErrors?: Record<string, string>; conflictingIds?: string[] } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fieldErrors = extra.fieldErrors ?? {}
    this.conflictingIds = extra.conflictingIds ?? []
  }
}

type Schema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }
}

/** Girdiyi ortak Zod şemasıyla doğrular; hatada alan bazında mesajlarla `validation` hatası verir. */
export function parse<T>(schema: Schema<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '_form')
    fieldErrors[field] ??= issue.message
  }
  throw new ApiError('validation', 'Lütfen işaretli alanları düzeltin.', { fieldErrors })
}

/** PostgreSQL hata kodu; Drizzle sürücü hatasını `cause` içinde taşır. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ('code' in e && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e.code
  }
  return undefined
}

/** `ON DELETE RESTRICT` ihlali `23001`, `NO ACTION` ihlali `23503` kodunu verir. */
export function isRestrictViolation(error: unknown): boolean {
  const code = pgErrorCode(error)
  return code === '23001' || code === '23503'
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let apiError: ApiError
  if (error instanceof ApiError) {
    apiError = error
  } else if (error?.type === 'entity.parse.failed') {
    apiError = new ApiError('validation', 'İstek gövdesi geçerli JSON değil.')
  } else if (error?.type === 'entity.too.large') {
    apiError = new ApiError('validation', 'İstek gövdesi çok büyük.')
  } else if (pgErrorCode(error) === '23505') {
    // Servis kontrolünü eşzamanlı bir istek geçtiyse benzersizlik kuralı veritabanında yakalanır.
    apiError = new ApiError('conflict', 'Bu kayıt mevcut bir kayıtla çakışıyor. Sayfayı yenileyip tekrar deneyin.')
  } else if (isRestrictViolation(error)) {
    apiError = new ApiError('restricted', 'İlişkili kayıtlar nedeniyle bu işlem yapılamadı. Sayfayı yenileyip tekrar deneyin.')
  } else {
    // Ayrıntılar yalnızca sunucu günlüğüne yazılır; yanıtta sızdırılmaz.
    console.error(error)
    apiError = new ApiError('internal', 'Beklenmeyen bir hata oluştu.')
  }
  const { code, message, fieldErrors, conflictingIds } = apiError
  res.status(STATUS[code]).json({ error: { code, message, fieldErrors, conflictingIds } })
}
