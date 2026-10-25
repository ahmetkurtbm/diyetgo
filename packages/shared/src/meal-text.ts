/**
 * Serbest metinle yazılan öğün içeriğini ("7-8 yemek kaşığı tavuk sote") besin ve miktara çevirir.
 *
 * Her satır: [miktar] [ölçü] besin. Miktar aralıksa ("7-8") ortalaması alınır. Ölçünün gramı önce
 * besinin kendi porsiyonundan (ör. "1 yemek kaşığı" = 25 g), yoksa `HOUSEHOLD_MEASURES`'taki
 * varsayılandan bulunur. Sonuç bir öneridir; arayüz diyetisyene onaylatır.
 */
import type { Food } from './schemas'

type MatchableFood = Pick<Food, 'id' | 'name' | 'brand' | 'baseUnit' | 'portionLabel' | 'portionAmount'>

/** Ev ölçülerinin yaklaşık varsayılan karşılığı (g veya ml). Besinin kendi porsiyonu önceliklidir. */
export const HOUSEHOLD_MEASURES: Readonly<Record<string, number>> = {
  'yemek kaşığı': 15,
  'tatlı kaşığı': 7,
  'çay kaşığı': 3,
  'servis kaşığı': 30,
  'su bardağı': 200,
  'çay bardağı': 100,
  fincan: 60,
  'küçük kase': 150,
  'orta kase': 200,
  'büyük kase': 300,
  kase: 200,
  kepçe: 100,
  avuç: 30,
  dilim: 30,
  'kibrit kutusu': 30,
  tabak: 250,
}

/** Ölçü yazımları → standart ölçü adı. `gram` ve `ml` miktarı doğrudan verir. */
const UNIT_ALIASES = (
  [
    ...Object.keys(HOUSEHOLD_MEASURES).map((u) => [u, u] as [string, string]),
    ['yemek kaşık', 'yemek kaşığı'],
    ['tatlı kaşık', 'tatlı kaşığı'],
    ['çay kaşık', 'çay kaşığı'],
    ['kaşık', 'yemek kaşığı'],
    ['bardak', 'su bardağı'],
    ['kâse', 'kase'],
    ['kasesi', 'kase'],
    ['porsiyon', 'porsiyon'],
    ['adet', 'adet'],
    ['tane', 'adet'],
    ['gram', 'gram'],
    ['gr', 'gram'],
    ['g', 'gram'],
    ['ml', 'ml'],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length)

const NUMBER_WORDS: Record<string, number> = { yarım: 0.5, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 }

const lower = (s: string) => s.toLocaleLowerCase('tr-TR')
const tokens = (s: string) => lower(s).split(/[^\p{L}]+/u).filter((t) => t.length >= 2)
const tokenMatches = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))

type Measure = { quantity: number; unit: string | null; rest: string }

/** Satırın başındaki miktarı ve ölçüyü ayırır. Miktar yoksa 1 kabul edilir. */
export function parseMeasure(text: string): Measure {
  let rest = lower(text).replace(/^[\s\-–•*·]+/, '').trim()
  let quantity: number | null = null
  const num = rest.match(/^(\d+)\s*\/\s*(\d+)|^(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|ile)\s*(\d+(?:[.,]\d+)?))?/)
  if (num) {
    if (num[1] !== undefined) quantity = Number(num[1]) / Number(num[2])
    else {
      const from = Number(num[3]!.replace(',', '.'))
      quantity = num[4] !== undefined ? (from + Number(num[4].replace(',', '.'))) / 2 : from
    }
    rest = rest.slice(num[0].length).trim()
  } else {
    const word = rest.match(/^(\p{L}+)/u)?.[1]
    if (word && word in NUMBER_WORDS) {
      quantity = NUMBER_WORDS[word]!
      rest = rest.slice(word.length).trim()
    }
  }
  if (quantity !== null && /^buçuk\b/u.test(rest)) {
    quantity += 0.5
    rest = rest.slice('buçuk'.length).trim()
  }
  let unit: string | null = null
  for (const [alias, name] of UNIT_ALIASES) {
    if (rest.startsWith(alias) && (rest.length === alias.length || /[^\p{L}]/u.test(rest[alias.length]!))) {
      unit = name
      rest = rest.slice(alias.length).trim()
      break
    }
  }
  return { quantity: quantity ?? 1, unit, rest }
}

/**
 * Metne en çok uyan besin: satırdaki kelimelerin ve besin adındaki kelimelerin ne kadarı eşleşiyor.
 * Besin adının ilk kelimesi ("Nohut yemeği" → nohut) eşleşmeli ya da satırın tüm kelimeleri besinde
 * bulunmalıdır; böylece "yemeği" gibi genel kelimeler tek başına eşleşme sayılmaz.
 */
export function matchFood<T extends MatchableFood>(text: string, foods: readonly T[]): T | null {
  const lineTokens = tokens(text)
  if (lineTokens.length === 0) return null
  let best: { food: T; score: number; size: number } | null = null
  for (const food of foods) {
    const foodTokens = tokens(food.brand ? `${food.name} ${food.brand}` : food.name)
    if (foodTokens.length === 0) continue
    const lineHits = lineTokens.filter((l) => foodTokens.some((f) => tokenMatches(l, f))).length
    const headHit = lineTokens.some((l) => tokenMatches(l, foodTokens[0]!))
    if (lineHits === 0 || (!headHit && lineHits < lineTokens.length)) continue
    const foodHits = foodTokens.filter((f) => lineTokens.some((l) => tokenMatches(l, f))).length
    const score = (2 * lineHits) / lineTokens.length + foodHits / foodTokens.length + (headHit ? 0.5 : 0)
    if (!best || score > best.score || (score === best.score && foodTokens.length < best.size)) best = { food, score, size: foodTokens.length }
  }
  return best?.food ?? null
}

/** Bir ölçünün bu besin için gram/ml karşılığı; bilinmiyorsa `null`. */
export function measureAmount(food: MatchableFood, unit: string | null): number | null {
  // Değişimde miktar değişim sayısıdır: "2 ekmek değişimi".
  if (food.baseUnit === 'exchange') return unit === null || unit === 'adet' || unit === 'porsiyon' ? 1 : null
  if (unit === 'gram' || unit === 'ml') return 1
  const portion = food.portionLabel && food.portionAmount ? parseMeasure(food.portionLabel) : null
  const perPortion = portion ? food.portionAmount! / portion.quantity : null
  // Ölçüsüz ("2 yumurta"), "adet" veya "porsiyon": besinin porsiyonu.
  if (unit === null || unit === 'adet' || unit === 'porsiyon') return perPortion
  if (portion?.unit === unit) return perPortion
  return HOUSEHOLD_MEASURES[unit] ?? null
}

export type MealTextLine<T extends MatchableFood = MatchableFood> = {
  text: string
  quantity: number
  unit: string | null
  food: T | null
  /** Besinin temel biriminde (g/ml) miktar; besin veya ölçü bilinmiyorsa `null`. */
  amount: number | null
}

/** Metnin her dolu satırını çözümler. */
export function parseMealText<T extends MatchableFood>(text: string, foods: readonly T[]): MealTextLine<T>[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const { quantity, unit, rest } = parseMeasure(line)
      const food = matchFood(rest, foods)
      const per = food ? measureAmount(food, unit) : null
      return { text: line, quantity, unit, food, amount: per === null ? null : Math.round(quantity * per * 10) / 10 }
    })
}
