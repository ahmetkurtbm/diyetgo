/**
 * Besin değişim (eşdeğer) sistemi. Bir değişim, aynı gruptaki besinlerin yaklaşık aynı enerji ve
 * makro değerini veren miktarıdır; danışan grup içinde istediği besini seçer.
 *
 * Değişimler `baseUnit: 'exchange'` olan besinlerdir: değerleri 1 değişim başınadır ve plandaki miktar
 * değişim sayısıdır. Aşağıdaki değerler seed'de başlangıç olarak kullanılır; diyetisyen besin
 * ekranından kendi değerleriyle değiştirebilir. Değerler ve eşdeğer örnekleri yaklaşıktır,
 * bir kaynakla doğrulanmamıştır.
 */
export type ExchangeGroup = {
  name: string
  energyKcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** Danışana gösterilecek "1 değişim = …" örnekleri. */
  equivalents: readonly string[]
}

export const EXCHANGE_GROUPS: readonly ExchangeGroup[] = [
  {
    name: 'Ekmek değişimi',
    energyKcal: 68,
    proteinG: 2,
    carbsG: 15,
    fatG: 0,
    equivalents: ['1 ince dilim ekmek (25 g)', '2 yemek kaşığı pirinç veya bulgur pilavı', '3 yemek kaşığı makarna (pişmiş)', '1 küçük patates (90 g)', '3 yemek kaşığı yulaf (20 g)'],
  },
  {
    name: 'Süt değişimi',
    energyKcal: 114,
    proteinG: 6,
    carbsG: 9,
    fatG: 6,
    equivalents: ['1 su bardağı süt (200 ml)', '1 su bardağı yoğurt (200 g)', '1 su bardağı kefir', '1,5 su bardağı ayran'],
  },
  {
    name: 'Et değişimi',
    energyKcal: 69,
    proteinG: 6,
    carbsG: 0,
    fatG: 5,
    equivalents: ['30 g pişmiş et, tavuk veya balık (1 köfte büyüklüğü)', '1 yumurta', '1 kibrit kutusu beyaz peynir (30 g)', '2 yemek kaşığı lor peyniri'],
  },
  {
    name: 'Sebze değişimi',
    energyKcal: 28,
    proteinG: 1,
    carbsG: 6,
    fatG: 0,
    equivalents: ['1 su bardağı çiğ sebze veya yeşillik', 'Yarım su bardağı pişmiş sebze', '4–5 yemek kaşığı yağsız sebze yemeği'],
  },
  {
    name: 'Meyve değişimi',
    energyKcal: 60,
    proteinG: 0,
    carbsG: 15,
    fatG: 0,
    equivalents: ['1 orta boy elma, armut veya portakal', '1 küçük muz', '10–12 adet üzüm veya kiraz', '1 ince dilim karpuz (200 g)', '3 adet kuru kayısı'],
  },
  {
    name: 'Yağ değişimi',
    energyKcal: 45,
    proteinG: 0,
    carbsG: 0,
    fatG: 5,
    equivalents: ['1 tatlı kaşığı zeytinyağı veya tereyağı (5 g)', '5 adet zeytin', '2 adet ceviz içi yarımı', '10 adet çiğ badem'],
  },
  {
    name: 'Kuru baklagil değişimi',
    energyKcal: 93,
    proteinG: 6,
    carbsG: 15,
    fatG: 1,
    equivalents: ['4 yemek kaşığı pişmiş kuru fasulye, nohut veya mercimek', 'Yarım su bardağı pişmiş kuru baklagil'],
  },
]

/** Seed'deki değişim grubunun eşdeğer örnekleri; diyetisyenin eklediği gruplar için boş döner. */
export function exchangeEquivalents(name: string): readonly string[] {
  return EXCHANGE_GROUPS.find((g) => g.name === name)?.equivalents ?? []
}
