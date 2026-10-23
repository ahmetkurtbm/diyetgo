/**
 * Enerji ihtiyacı tahminleri.
 *
 * Sınırlamalar: Buradaki değerler popülasyon ortalamalarına dayanan tahminlerdir; teşhis veya
 * tedavi önerisi değildir. Mifflin-St Jeor denklemi yalnızca yetişkinler için kullanılır; gebelik,
 * emzirme, sporcular, ileri yaş ve bazı klinik durumlarda gerçek ihtiyaç belirgin biçimde farklı
 * olabilir. Sonuçlar bir uzmanın değerlendirmesinin yerini tutmaz.
 */
import { daysBetween } from './dates'
import { assertFinite } from './numbers'
import type { Sex } from './schemas'

export const MIN_ADULT_AGE = 18

/** Etkinlik katsayısı (PAL) için kabul edilen aralık; 1.2 hareketsiz, 2.5 çok yüksek etkinlik düzeyidir. */
export const ACTIVITY_FACTOR_MIN = 1.2
export const ACTIVITY_FACTOR_MAX = 2.5

/**
 * Verilen tarihteki tamamlanmış yaş. Doğum günü o gün dahil sayılır.
 * 29 Şubat doğumlular artık olmayan yıllarda yaşını 1 Mart'ta tamamlar.
 */
export function ageOn(birthDate: string, onDate: string): number {
  if (daysBetween(birthDate, onDate) < 0) throw new RangeError('Tarih doğum gününden önce olamaz')
  const age = Number(onDate.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return onDate.slice(5) < birthDate.slice(5) ? age - 1 : age
}

/**
 * Mifflin-St Jeor bazal metabolizma hızı (kcal/gün):
 * `10 × kilo(kg) + 6.25 × boy(cm) − 5 × yaş + (erkek: +5, kadın: −161)`.
 */
export function mifflinStJeorBmr(input: { sex: Sex; weightKg: number; heightCm: number; ageYears: number }): number {
  const { sex, weightKg, heightCm, ageYears } = input
  assertFinite(weightKg, 'weightKg')
  assertFinite(heightCm, 'heightCm')
  assertFinite(ageYears, 'ageYears')
  if (weightKg <= 0 || heightCm <= 0) throw new RangeError('Kilo ve boy sıfırdan büyük olmalı')
  if (ageYears < MIN_ADULT_AGE) {
    throw new RangeError(`Mifflin-St Jeor yalnızca ${MIN_ADULT_AGE} yaş ve üzeri için kullanılır`)
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161)
}

/** Günlük enerji tahmini: BMR × etkinlik katsayısı. */
export function dailyEnergy(bmrKcal: number, activityFactor: number): number {
  assertFinite(bmrKcal, 'bmrKcal')
  assertFinite(activityFactor, 'activityFactor')
  if (bmrKcal <= 0) throw new RangeError('BMR sıfırdan büyük olmalı')
  if (activityFactor < ACTIVITY_FACTOR_MIN || activityFactor > ACTIVITY_FACTOR_MAX) {
    throw new RangeError(`Etkinlik katsayısı ${ACTIVITY_FACTOR_MIN}–${ACTIVITY_FACTOR_MAX} aralığında olmalı`)
  }
  return bmrKcal * activityFactor
}

/**
 * Enerji hedefini makro yüzdelerine göre grama çevirir (protein ve karbonhidrat 4, yağ 9 kcal/g).
 * Yüzdelerin toplamı 100 olmalıdır.
 */
export function macroGramsFromShares(
  energyKcal: number,
  shares: { proteinPct: number; carbsPct: number; fatPct: number },
): { proteinG: number; carbsG: number; fatG: number } {
  const { proteinPct, carbsPct, fatPct } = shares
  assertFinite(energyKcal, 'energyKcal')
  for (const [name, pct] of Object.entries(shares)) {
    assertFinite(pct, name)
    if (pct < 0) throw new RangeError(`${name} negatif olamaz`)
  }
  if (energyKcal < 0) throw new RangeError('Enerji negatif olamaz')
  if (Math.abs(proteinPct + carbsPct + fatPct - 100) > 1e-9) {
    throw new RangeError('Makro yüzdelerinin toplamı 100 olmalı')
  }
  return {
    proteinG: (energyKcal * proteinPct) / 100 / 4,
    carbsG: (energyKcal * carbsPct) / 100 / 4,
    fatG: (energyKcal * fatPct) / 100 / 9,
  }
}
