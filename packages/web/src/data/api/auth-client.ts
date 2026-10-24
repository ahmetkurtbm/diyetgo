/**
 * API modunda diyetisyen oturumu (Better Auth istemcisi). Oturum `HttpOnly` çerezle taşınır;
 * JavaScript çereze erişemez. Demo modunda bu modül yüklenmez.
 */
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({ basePath: '/api/auth' })

/** Better Auth hata kodlarının Türkçe karşılıkları; tanınmayan kodlar için genel mesaj kullanılır. */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-posta veya parola hatalı.',
  INVALID_EMAIL: 'Geçerli bir e-posta adresi girin.',
  USER_ALREADY_EXISTS: 'Bu e-postayla bir hesap zaten var. Giriş yapmayı deneyin.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Bu e-postayla bir hesap zaten var. Giriş yapmayı deneyin.',
  PASSWORD_TOO_SHORT: 'Parola en az 10 karakter olmalı.',
  PASSWORD_TOO_LONG: 'Parola çok uzun.',
  INVALID_TOKEN: 'Bağlantının süresi dolmuş veya geçersiz. Yeniden parola sıfırlama isteyin.',
}

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code]!
  if (error?.status === 429) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.'
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}
