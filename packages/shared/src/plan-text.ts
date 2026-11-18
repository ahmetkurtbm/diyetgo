/**
 * Serbest menü (elle yazılan plan): yazım düzeltme ve dışa aktarma metni.
 *
 * Düzeltme gerçek bir yazım denetimi değildir; yalnızca güvenli, kurala dayalı düzenlemeler yapar:
 * boşluk ve noktalama, aralık yazımı ("7 - 8" → "7-8"), satır başı büyük harf ve Türkçe karakter
 * eksik yazılmış bilinen kelimelerin (yogurt → yoğurt) düzeltilmesi. Bilinmeyen kelimelere dokunulmaz.
 */
import { EXCHANGE_GROUPS } from './exchanges'
import { FOOD_CATALOG } from './food-catalog'

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }

/** Türkçe karakterleri sadeleştirir: `yoğurt` → `yogurt`. */
export function foldTurkish(text: string): string {
  return text.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => FOLD[c]!)
}

/** Sık yazılan, Türkçe karakteri eksik kelimeler ve ölçü yazımları; besin adları ayrıca listeden eklenir. */
const COMMON_WORDS = [
  'yoğurt', 'süt', 'çay', 'çorba', 'kaşık', 'kaşığı', 'çatal', 'bardak', 'bardağı', 'dilim', 'adet', 'porsiyon', 'küçük', 'büyük',
  'orta', 'yarım', 'buçuk', 'çeyrek', 'tane', 'kase', 'avuç', 'ızgara', 'haşlanmış', 'kızartma', 'közlenmiş', 'çiğ', 'pişmiş', 'yağsız', 'şekersiz',
  'tuzsuz', 'yeşil', 'kırmızı', 'sarı', 'soğan', 'havuç', 'kabak', 'patlıcan', 'ıspanak', 'mısır', 'fındık', 'üzüm', 'şeftali', 'çilek',
  'kayısı', 'incir', 'nar', 'erik', 'kiraz', 'vişne', 'çikolata', 'zeytinyağı', 'tereyağı', 'peynir', 'yumurta', 'ekmek', 'pilav', 'makarna',
  'bulgur', 'mercimek', 'nohut', 'fasulye', 'salata', 'salatalık', 'domates', 'biber', 'maydanoz', 'dereotu', 'roka', 'marul', 'tavuk',
  'balık', 'köfte', 'kıyma', 'sebze', 'meyve', 'ayran', 'kefir', 'su', 'kahve', 'tarçın', 'bal', 'pekmez', 'tahin', 'ceviz', 'badem',
  'fıstık', 'kuruyemiş', 'tam', 'buğday', 'çavdar', 'yulaf', 'ara', 'öğün', 'kahvaltı', 'öğle', 'akşam', 'yemeği', 'sote', 'haşlama',
  'günde', 'gün', 'için', 'iç', 'içiniz', 'haftada', 'tüketin', 'tüketiniz', 'çiğneyin', 'yavaş', 'yiyin', 'yeterli', 'bol', 'önce', 'sonra',
  'fırında', 'buğulama', 'ızgarada', 'limon', 'sirke', 'baharat', 'sızma', 'yağ', 'diyet', 'açlık', 'tokluk', 'günlük', 'haftalık',
]

/** Kelimenin sadeleştirilmiş hâli → doğru yazımı. Aynı sadeleştirmeye giden farklı yazımlar (örn. "kas"/"kaş") atlanır. */
function buildDictionary(): ReadonlyMap<string, string> {
  const words = new Set<string>(COMMON_WORDS)
  for (const name of [...FOOD_CATALOG.map(([n]) => n), ...EXCHANGE_GROUPS.map((g) => g.name)]) {
    for (const w of name.toLocaleLowerCase('tr-TR').split(/[^\p{L}]+/u)) if (w.length >= 3) words.add(w)
  }
  const byFolded = new Map<string, Set<string>>()
  for (const word of words) {
    const key = foldTurkish(word)
    byFolded.set(key, (byFolded.get(key) ?? new Set()).add(word))
  }
  const dictionary = new Map<string, string>()
  for (const [key, candidates] of byFolded) if (candidates.size === 1) dictionary.set(key, [...candidates][0]!)
  return dictionary
}

let dictionary: ReadonlyMap<string, string> | undefined

/** Büyük/küçük harf yapısını korur: `Yogurt` → `Yoğurt`, `YOGURT` → `YOĞURT`. */
function matchCase(original: string, fixed: string): string {
  if (original.length > 1 && original === original.toLocaleUpperCase('tr-TR')) return fixed.toLocaleUpperCase('tr-TR')
  if (original[0] === original[0]!.toLocaleUpperCase('tr-TR') && original[0] !== original[0]!.toLocaleLowerCase('tr-TR')) {
    return fixed[0]!.toLocaleUpperCase('tr-TR') + fixed.slice(1)
  }
  return fixed
}

/** Türkçe karakteri eksik bilinen kelimeleri düzeltir; doğru yazılmış veya bilinmeyen kelimeye dokunmaz. */
function fixWords(line: string): string {
  dictionary ??= buildDictionary()
  return line.replace(/\p{L}+/gu, (word) => {
    const fixed = dictionary!.get(foldTurkish(word))
    return fixed && foldTurkish(fixed) === foldTurkish(word) && word.toLocaleLowerCase('tr-TR') !== fixed ? matchCase(word, fixed) : word
  })
}

const BULLET = /^[\s\-–—•*·+>]+/

/** Tek satırı düzeltir; satır boşsa boş döner. */
export function correctLine(line: string): string {
  let text = line.replace(BULLET, '').replace(/\s+/g, ' ').trim()
  if (text === '') return ''
  text = text
    // "7 - 8", "7 – 8" → "7-8"
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1-$2')
    // Noktalama öncesi boşluk silinir, sonrası yoksa eklenir (sayı içindeki "1,5" ve "1.5" korunur).
    .replace(/\s+([,;:.!?)])/g, '$1')
    .replace(/([,;:])(?=\p{L})/gu, '$1 ')
    .replace(/\(\s+/g, '(')
    .replace(/([,;:.!?]){2,}/g, '$1')
    // "7yemek kaşığı" → "7 yemek kaşığı"
    .replace(/(\d)(?=\p{L})/gu, '$1 ')
    // "8 g" gibi birimler bitişik yazılır: "8 g" korunur, ama "200gr" → "200 gr" yukarıda ayrıldı.
    .replace(/\bgr\b/giu, 'g')
  text = fixWords(text)
  return text[0]!.toLocaleUpperCase('tr-TR') + text.slice(1)
}

/** Çok satırlı metni düzeltir: boş satırlar atılır, her satır ayrı bir madde olur. */
export function correctMealText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(correctLine)
    .filter((line) => line !== '')
    .join('\n')
}

/** Düzeltilmiş maddeler. */
export function mealLines(text: string | null | undefined): string[] {
  return text ? correctMealText(text).split('\n').filter(Boolean) : []
}

// ---------- Dışa aktarma ----------

export type PlanDocument = {
  title: string
  clientName: string
  dietitianName: string
  /** Örn. "17 Kasım 2026 – 23 Kasım 2026". */
  periodLabel: string
  /** Diyetisyenin yazdığı öneriler (günde su, haftalık öğün sıklığı vb.); belgede ayrı bir bölüm olur. */
  recommendations: string[]
  days: { heading: string; meals: { name: string; lines: string[] }[] }[]
}

/** Canva'ya veya başka bir metin alanına yapıştırmak için düz metin. */
export function planDocumentToText(doc: PlanDocument): string {
  const lines = [doc.title, `Danışan: ${doc.clientName}`, `Tarih: ${doc.periodLabel}`]
  if (doc.dietitianName) lines.push(`Diyetisyen: ${doc.dietitianName}`)
  for (const day of doc.days) {
    lines.push('', day.heading)
    for (const meal of day.meals) {
      lines.push(`${meal.name}:`)
      for (const line of meal.lines) lines.push(`• ${line}`)
    }
  }
  if (doc.recommendations.length > 0) {
    lines.push('', 'Öneriler')
    for (const line of doc.recommendations) lines.push(`• ${line}`)
  }
  return lines.join('\n')
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Zengin metin olarak yapıştırılınca başlıklar ve maddeler korunsun diye HTML karşılığı. */
export function planDocumentToHtml(doc: PlanDocument): string {
  const parts = [`<h1>${escapeHtml(doc.title)}</h1>`, `<p><b>Danışan:</b> ${escapeHtml(doc.clientName)}<br><b>Tarih:</b> ${escapeHtml(doc.periodLabel)}`]
  if (doc.dietitianName) parts[1] += `<br><b>Diyetisyen:</b> ${escapeHtml(doc.dietitianName)}`
  parts[1] += '</p>'
  for (const day of doc.days) {
    parts.push(`<h2>${escapeHtml(day.heading)}</h2>`)
    for (const meal of day.meals) {
      parts.push(`<h3>${escapeHtml(meal.name)}</h3><ul>${meal.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`)
    }
  }
  if (doc.recommendations.length > 0) parts.push(`<h2>Öneriler</h2><ul>${doc.recommendations.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`)
  return parts.join('')
}

// ---------- Öneri simgeleri ----------

export type RecommendationIcon = 'water' | 'fish' | 'vegetable' | 'legume' | 'flower'

/** Öneri satırındaki anahtar kelimeye göre belgede gösterilecek simge; tanınmazsa çiçek. */
export function recommendationIcon(line: string): RecommendationIcon {
  const text = foldTurkish(line)
  if (/\b(su|litre|sivi)\b/.test(text)) return 'water'
  if (/balik|somon|levrek|hamsi|ton\b/.test(text)) return 'fish'
  if (/baklagil|fasulye|nohut|mercimek|barbunya/.test(text)) return 'legume'
  if (/sebze|salata|yesillik|meyve/.test(text)) return 'vegetable'
  return 'flower'
}
