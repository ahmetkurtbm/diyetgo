/** Form metnini sayıya çevirir; boş metin `NaN` olur ve şema "Geçerli bir sayı girin" hatası verir. Ondalık virgül kabul edilir. */
export function parseNumber(value: string): number {
  const trimmed = value.trim().replace(',', '.')
  return trimmed === '' ? Number.NaN : Number(trimmed)
}

/** İsteğe bağlı sayı: boş metin `null` olur. */
export function parseOptionalNumber(value: string): number | null {
  return value.trim() === '' ? null : parseNumber(value)
}

/** İsteğe bağlı metin: boş veya yalnızca boşluk ise `null`. */
export function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value
}
