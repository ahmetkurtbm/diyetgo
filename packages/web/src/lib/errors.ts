import { RepositoryError } from '../data/repositories'

export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return error.message
  return 'Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.'
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof RepositoryError ? { ...error.fieldErrors } : {}
}
