import { ageOn, dailyEnergy, MIN_ADULT_AGE, mifflinStJeorBmr, type Client, type Measurement, type Sex } from '@diyetgo/shared'

type MeasuredValue = { value: number; measuredOn: string }

export type EnergyEstimate =
  | { ok: true; sex: Sex; ageYears: number; weight: MeasuredValue; height: MeasuredValue; bmrKcal: number; energyKcal: number }
  | { ok: false; reasons: string[] }

/** `onDate` ve öncesindeki en yeni ölçüm değeri. */
function latest(measurements: readonly Measurement[], key: 'weightKg' | 'heightCm', onDate: string): MeasuredValue | null {
  let found: MeasuredValue | null = null
  for (const m of measurements) {
    const value = m[key]
    if (value !== null && m.measuredOn <= onDate && (found === null || m.measuredOn > found.measuredOn)) found = { value, measuredOn: m.measuredOn }
  }
  return found
}

/**
 * Hedef başlangıç gününe göre Mifflin-St Jeor tahmini için gereken danışan verilerini toplar.
 * Yaş başlangıç gününe göre hesaplanır; kilo ve boy o gün veya öncesindeki en yeni ölçümden alınır.
 * Hesaplanamıyorsa nedenleri döner. Hesaplamanın kendisi `@diyetgo/shared` içindedir.
 */
export function estimateEnergy(
  client: Pick<Client, 'sex' | 'birthDate'>,
  measurements: readonly Measurement[],
  onDate: string,
  activityFactor: number,
): EnergyEstimate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDate)) return { ok: false, reasons: ['Önce başlangıç tarihini girin.'] }
  const reasons: string[] = []
  if (!client.sex) reasons.push('Danışanın cinsiyeti belirtilmemiş.')
  let ageYears: number | null = null
  if (!client.birthDate) reasons.push('Danışanın doğum tarihi girilmemiş.')
  else if (client.birthDate > onDate) reasons.push('Doğum tarihi hedef başlangıcından sonra.')
  else {
    ageYears = ageOn(client.birthDate, onDate)
    if (ageYears < MIN_ADULT_AGE) reasons.push(`Mifflin-St Jeor yalnızca ${MIN_ADULT_AGE} yaş ve üzeri için kullanılır (danışan ${ageYears} yaşında).`)
  }
  const weight = latest(measurements, 'weightKg', onDate)
  const height = latest(measurements, 'heightCm', onDate)
  if (!weight) reasons.push('Başlangıç tarihi veya öncesinde kilo ölçümü yok.')
  if (!height) reasons.push('Başlangıç tarihi veya öncesinde boy ölçümü yok.')
  if (reasons.length > 0 || !client.sex || ageYears === null || !weight || !height) return { ok: false, reasons }

  const bmrKcal = mifflinStJeorBmr({ sex: client.sex, weightKg: weight.value, heightCm: height.value, ageYears })
  return { ok: true, sex: client.sex, ageYears, weight, height, bmrKcal, energyKcal: dailyEnergy(bmrKcal, activityFactor) }
}
