import { describe, expect, it } from 'vitest'
import {
  appointmentsOverlap,
  canAddFoodToMeal,
  canAddPlanOrAppointment,
  findActiveGoal,
  findAppointmentConflicts,
  goalPeriodsOverlap,
  isDayWithinPlan,
  isGoalActiveOn,
  planDayDate,
  planLengthDays,
  planNewGoal,
} from './rules'

const period = (validFrom: string, validTo: string | null) => ({ validFrom, validTo })

describe('arşiv kuralları', () => {
  it('arşivlenmiş danışana yeni plan veya randevu eklenemez', () => {
    expect(canAddPlanOrAppointment({ archivedAt: null })).toBe(true)
    expect(canAddPlanOrAppointment({ archivedAt: '2026-03-01T09:00:00.000Z' })).toBe(false)
  })

  it('arşivlenmiş besin yeni öğün içeriğine eklenemez', () => {
    expect(canAddFoodToMeal({ archivedAt: null })).toBe(true)
    expect(canAddFoodToMeal({ archivedAt: '2026-03-01T09:00:00.000Z' })).toBe(false)
  })
})

describe('hedef dönemleri: başlangıç ve bitiş günleri dahildir', () => {
  it('bitişik dönemler (31 Mart biter, 1 Nisan başlar) çakışmaz', () => {
    expect(goalPeriodsOverlap(period('2026-03-01', '2026-03-31'), period('2026-04-01', null))).toBe(false)
    expect(goalPeriodsOverlap(period('2026-04-01', null), period('2026-03-01', '2026-03-31'))).toBe(false)
  })

  it('aynı günü paylaşan dönemler çakışır', () => {
    expect(goalPeriodsOverlap(period('2026-03-01', '2026-03-31'), period('2026-03-31', '2026-04-30'))).toBe(true)
  })

  it('tek günlük dönem kendi gününde çakışır', () => {
    expect(goalPeriodsOverlap(period('2026-03-15', '2026-03-15'), period('2026-03-01', '2026-03-15'))).toBe(true)
    expect(goalPeriodsOverlap(period('2026-03-15', '2026-03-15'), period('2026-03-16', null))).toBe(false)
  })

  it('iç içe ve açık uçlu dönemleri doğru değerlendirir', () => {
    expect(goalPeriodsOverlap(period('2026-01-01', '2026-12-31'), period('2026-05-01', '2026-05-31'))).toBe(true)
    expect(goalPeriodsOverlap(period('2026-01-01', null), period('2030-01-01', '2030-01-31'))).toBe(true)
    expect(goalPeriodsOverlap(period('2026-01-01', null), period('2025-01-01', null))).toBe(true)
    expect(goalPeriodsOverlap(period('2026-01-01', null), period('2025-01-01', '2025-12-31'))).toBe(false)
  })

  it('hedef başlangıç ve bitiş gününde aktiftir, dışında değildir', () => {
    const goal = period('2026-03-01', '2026-03-31')
    expect(isGoalActiveOn(goal, '2026-02-28')).toBe(false)
    expect(isGoalActiveOn(goal, '2026-03-01')).toBe(true)
    expect(isGoalActiveOn(goal, '2026-03-31')).toBe(true)
    expect(isGoalActiveOn(goal, '2026-04-01')).toBe(false)
    expect(isGoalActiveOn(period('2026-03-01', null), '2099-12-31')).toBe(true)
  })

  it('aktif hedefi bulur; bitişik dönemlerde geçiş günü doğru hedefi seçer', () => {
    const goals = [
      { id: 'a', ...period('2026-01-01', '2026-03-31') },
      { id: 'b', ...period('2026-04-01', null) },
    ]
    expect(findActiveGoal(goals, '2026-03-31')?.id).toBe('a')
    expect(findActiveGoal(goals, '2026-04-01')?.id).toBe('b')
    expect(findActiveGoal(goals, '2025-12-31')).toBeUndefined()
  })
})

describe('planNewGoal', () => {
  it('hedef yoksa ekler', () => {
    expect(planNewGoal([], period('2026-04-01', null))).toEqual({ ok: true, close: null })
  })

  it('önceki açık hedefi yeni başlangıçtan bir gün önce kapatır', () => {
    const existing = [{ id: 'open', ...period('2026-03-01', null) }]
    expect(planNewGoal(existing, period('2026-04-01', null))).toEqual({
      ok: true,
      close: { id: 'open', validTo: '2026-03-31' },
    })
    // Ay ve artık yıl sınırı
    expect(planNewGoal(existing, period('2028-03-01', null))).toEqual({
      ok: true,
      close: { id: 'open', validTo: '2028-02-29' },
    })
  })

  it('açık hedefle aynı gün veya daha önce başlayan açık uçlu hedefi reddeder', () => {
    const existing = [{ id: 'open', ...period('2026-04-01', null) }]
    expect(planNewGoal(existing, period('2026-04-01', null))).toEqual({ ok: false, conflictingIds: ['open'] })
    expect(planNewGoal(existing, period('2026-03-01', null))).toEqual({ ok: false, conflictingIds: ['open'] })
  })

  it('açık hedeften önce biten geçmiş dönem eklenebilir, açık hedef kapatılmaz', () => {
    const existing = [{ id: 'open', ...period('2026-04-01', null) }]
    expect(planNewGoal(existing, period('2026-01-01', '2026-03-31'))).toEqual({ ok: true, close: null })
    expect(planNewGoal(existing, period('2026-01-01', '2026-04-01'))).toEqual({ ok: false, conflictingIds: ['open'] })
  })

  it('kapalı dönemlerle çakışmayı reddeder', () => {
    const existing = [
      { id: 'old', ...period('2026-01-01', '2026-02-28') },
      { id: 'open', ...period('2026-03-01', null) },
    ]
    expect(planNewGoal(existing, period('2026-02-28', '2026-02-28'))).toEqual({ ok: false, conflictingIds: ['old'] })
    expect(planNewGoal(existing, period('2026-02-15', null))).toEqual({ ok: false, conflictingIds: ['old', 'open'] })
  })
})

describe('randevu çakışması: aralıklar yarı açıktır [başlangıç, bitiş)', () => {
  const slot = (startsAt: string, endsAt: string) => ({ startsAt, endsAt })
  const t = (hhmm: string) => `2026-03-10T${hhmm}:00.000Z`

  it('uç uca eklenen randevular çakışmaz', () => {
    expect(appointmentsOverlap(slot(t('07:00'), t('07:30')), slot(t('07:30'), t('08:00')))).toBe(false)
    expect(appointmentsOverlap(slot(t('07:30'), t('08:00')), slot(t('07:00'), t('07:30')))).toBe(false)
  })

  it('kesişen ve kapsanan randevular çakışır', () => {
    expect(appointmentsOverlap(slot(t('07:00'), t('07:45')), slot(t('07:30'), t('08:00')))).toBe(true)
    expect(appointmentsOverlap(slot(t('07:00'), t('09:00')), slot(t('07:30'), t('08:00')))).toBe(true)
    expect(appointmentsOverlap(slot(t('07:00'), t('07:30')), slot(t('07:00'), t('07:30')))).toBe(true)
  })

  const existing = [
    { id: 'a', status: 'scheduled' as const, ...slot(t('07:00'), t('07:45')) },
    { id: 'b', status: 'cancelled' as const, ...slot(t('08:00'), t('08:30')) },
    { id: 'c', status: 'completed' as const, ...slot(t('09:00'), t('09:30')) },
  ]

  it('iptal edilmiş randevular yer tutmaz', () => {
    expect(findAppointmentConflicts(slot(t('08:00'), t('08:30')), existing)).toEqual([])
    expect(findAppointmentConflicts(slot(t('07:30'), t('09:15')), existing).map((a) => a.id)).toEqual(['a', 'c'])
  })

  it('düzenlenen randevu kendisiyle çakışmaz', () => {
    expect(findAppointmentConflicts({ id: 'a', ...slot(t('07:15'), t('07:50')) }, existing)).toEqual([])
  })

  it('iptal edilen aday için çakışma aranmaz', () => {
    expect(findAppointmentConflicts({ status: 'cancelled', ...slot(t('07:00'), t('07:45')) }, existing)).toEqual([])
  })

  it('farklı gösterimlerdeki aynı anları doğru karşılaştırır', () => {
    expect(appointmentsOverlap(slot('2026-03-10T07:00:00Z', '2026-03-10T07:30:00Z'), slot(t('07:29'), t('08:00')))).toBe(true)
  })
})

describe('plan günleri: gün 1 = başlangıç tarihi', () => {
  it('göreli günün takvim tarihini hesaplar', () => {
    expect(planDayDate('2026-03-10', 1)).toBe('2026-03-10')
    expect(planDayDate('2026-03-10', 3)).toBe('2026-03-12')
    expect(planDayDate('2026-02-27', 3)).toBe('2026-03-01')
    expect(planDayDate('2028-02-27', 3)).toBe('2028-02-29')
  })

  it('geçersiz gün numarası için hata verir', () => {
    expect(() => planDayDate('2026-03-10', 0)).toThrow(RangeError)
    expect(() => planDayDate('2026-03-10', 1.5)).toThrow(RangeError)
    expect(() => planDayDate('2026-03-10', Number.NaN)).toThrow(RangeError)
  })

  it('plan süresi başlangıç ve bitişi kapsar', () => {
    expect(planLengthDays({ startDate: '2026-03-10', endDate: '2026-03-10' })).toBe(1)
    expect(planLengthDays({ startDate: '2026-03-10', endDate: '2026-04-06' })).toBe(28)
    expect(planLengthDays({ startDate: '2026-03-10', endDate: null })).toBeNull()
  })

  it('gün numarasının plan süresi içinde olup olmadığını kontrol eder', () => {
    const plan = { startDate: '2026-03-10', endDate: '2026-03-16' }
    expect(isDayWithinPlan(plan, 1)).toBe(true)
    expect(isDayWithinPlan(plan, 7)).toBe(true)
    expect(isDayWithinPlan(plan, 8)).toBe(false)
    expect(isDayWithinPlan(plan, 0)).toBe(false)
    expect(isDayWithinPlan(plan, 2.5)).toBe(false)
    expect(isDayWithinPlan({ startDate: '2026-03-10', endDate: null }, 300)).toBe(true)
  })
})
