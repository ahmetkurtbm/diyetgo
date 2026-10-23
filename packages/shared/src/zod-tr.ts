/**
 * Zod doğrulama mesajlarını kullanıcıya gösterilebilir Türkçe metinlere çevirir.
 * `schemas.ts` tarafından bir kez yüklenir; web ve server aynı mesajları üretir.
 * Burada karşılanmayan durumlarda Zod'un Türkçe çevirisi kullanılır.
 */
import { z } from 'zod'

const n = (value: unknown) => (typeof value === 'number' ? value.toLocaleString('tr-TR') : String(value))

const formats: Record<string, string> = {
  email: 'Geçerli bir e-posta adresi girin',
  date: 'Geçerli bir tarih girin',
  datetime: 'Geçerli bir tarih ve saat girin',
  time: 'Saat SS:DD biçiminde olmalı',
  uuid: 'Geçersiz kimlik',
}

export const turkishErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined || issue.input === null) return 'Bu alan zorunludur'
      if (issue.expected === 'int') return 'Tam sayı olmalı'
      if (issue.expected === 'number') return 'Geçerli bir sayı girin'
      return undefined
    case 'too_small':
      if (issue.origin === 'string') {
        return issue.minimum === 1 ? 'Bu alan zorunludur' : `En az ${n(issue.minimum)} karakter olmalı`
      }
      if (issue.origin === 'number') {
        return issue.inclusive ? `En az ${n(issue.minimum)} olmalı` : `${n(issue.minimum)} değerinden büyük olmalı`
      }
      return undefined
    case 'too_big':
      if (issue.origin === 'string') return `En fazla ${n(issue.maximum)} karakter olmalı`
      if (issue.origin === 'number') {
        return issue.inclusive ? `En fazla ${n(issue.maximum)} olabilir` : `${n(issue.maximum)} değerinden küçük olmalı`
      }
      return undefined
    case 'invalid_format':
      return formats[issue.format]
    case 'invalid_value':
      return 'Geçerli bir seçenek seçin'
    default:
      return undefined
  }
}

z.config({ ...z.locales.tr(), customError: turkishErrorMap })
