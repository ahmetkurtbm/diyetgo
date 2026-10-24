/**
 * Demo modu ve veritabanı seed'i için ortak örnek veri.
 *
 * Tüm kişiler kurgusaldır; e-postalar yalnızca örnekler için ayrılmış `example.com` alan adını kullanır,
 * telefon numarası yoktur. Besin değerleri yuvarlanmış yaklaşık değerlerdir ve doğrulanmamıştır;
 * her seed besininde `isSample: true` ve `source: SAMPLE_FOOD_SOURCE` bulunur.
 *
 * Kimlikler sabittir, böylece veritabanı seed'i tekrar çalıştırıldığında kayıtlar çoğalmaz.
 * Tarihler verilen güne göre hesaplanır; demo her açılışta güncel randevular gösterir.
 */
import { addDays, istanbulTimeToUtc } from './dates'
import { FOOD_CATALOG } from './food-catalog'
import type {
  Appointment,
  Client,
  ClientCondition,
  ClientGoal,
  ClientMedication,
  ClientRecommendation,
  Food,
  MealPlan,
  MealType,
  Measurement,
  PlanMeal,
  PlanMealItem,
  RecipeIngredient,
} from './schemas'

export const SAMPLE_FOOD_SOURCE = 'Örnek veri – doğrulanmamış'

export type SeedData = {
  clients: Client[]
  measurements: Measurement[]
  foods: Food[]
  mealTypes: MealType[]
  mealPlans: MealPlan[]
  planMeals: PlanMeal[]
  planMealItems: PlanMealItem[]
  appointments: Appointment[]
  clientGoals: ClientGoal[]
  clientMedications: ClientMedication[]
  clientConditions: ClientCondition[]
  clientRecommendations: ClientRecommendation[]
  recipeIngredients: RecipeIngredient[]
}

const GROUP = {
  client: 1,
  measurement: 2,
  food: 3,
  mealType: 4,
  mealPlan: 5,
  planMeal: 6,
  planMealItem: 7,
  appointment: 8,
  clientGoal: 9,
  // 10 (0x0a) server'daki demo diyetisyen hesabıyla karışmasın diye kullanılmaz.
  clientMedication: 11,
  clientCondition: 12,
  clientRecommendation: 13,
  recipeIngredient: 14,
} as const

/** Sabit, geçerli bir UUID (v4 biçiminde) üretir: ilk blok varlık grubu, son blok sıra numarasıdır. */
function seedId(group: keyof typeof GROUP, n: number): string {
  return `${GROUP[group].toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

export function createSeedData(today: string): SeedData {
  const day = (offset: number) => addDays(today, offset)
  const at = (offset: number, hour: number, minute = 0) => istanbulTimeToUtc(day(offset), hour, minute)
  const stamps = { createdAt: at(-90, 9), updatedAt: at(-90, 9) }

  const c = {
    deniz: seedId('client', 1),
    ece: seedId('client', 2),
    kaan: seedId('client', 3),
    selin: seedId('client', 4),
  }
  const clientBase = { sex: null, email: null, phone: null, notes: 'Kurgusal demo danışanı.', archivedAt: null, ...stamps }
  const clients: Client[] = [
    { ...clientBase, id: c.deniz, firstName: 'Deniz', lastName: 'Örnek', birthDate: '1990-04-12', sex: 'female', email: 'deniz.ornek@example.com' },
    { ...clientBase, id: c.ece, firstName: 'Ece', lastName: 'Deneme', birthDate: '1985-11-03', sex: 'female' },
    { ...clientBase, id: c.kaan, firstName: 'Kaan', lastName: 'Taslak', birthDate: '1978-07-21', sex: 'male', email: 'kaan.taslak@example.com' },
    { ...clientBase, id: c.selin, firstName: 'Selin', lastName: 'Kurgu', birthDate: '2000-01-30', archivedAt: at(-20, 10) },
  ]

  const m = (n: number, clientId: string, offset: number, v: Partial<Measurement>): Measurement => ({
    id: seedId('measurement', n),
    clientId,
    measuredOn: day(offset),
    weightKg: null,
    heightCm: null,
    waistCm: null,
    hipCm: null,
    thighCm: null,
    bodyFatPct: null,
    notes: null,
    ...stamps,
    ...v,
  })
  const measurements: Measurement[] = [
    m(1, c.deniz, -60, { weightKg: 78.4, heightCm: 168, waistCm: 86, thighCm: 59 }),
    m(2, c.deniz, -30, { weightKg: 76.9, waistCm: 84, thighCm: 58 }),
    m(3, c.deniz, -7, { weightKg: 75.8, waistCm: 83, thighCm: 57, bodyFatPct: 31 }),
    m(4, c.ece, -3, { weightKg: 64.2, heightCm: 162 }),
    m(5, c.kaan, -40, { weightKg: 92.5, heightCm: 181, waistCm: 101 }),
    m(6, c.kaan, -5, { weightKg: 90.1, waistCm: 98 }),
    m(7, c.selin, -45, { weightKg: 58, heightCm: 170 }),
  ]

  type FoodValues = [name: string, baseUnit: Food['baseUnit'], kcal: number, protein: number, carbs: number, fat: number, portion: string, amount: number]
  const foodRows: FoodValues[] = [
    ['Yulaf ezmesi', 'g', 380, 13, 60, 7, '3 yemek kaşığı', 30],
    ['Tam buğday ekmeği', 'g', 250, 9, 43, 3.5, '1 dilim', 30],
    ['Yumurta', 'g', 145, 12.5, 1, 10, '1 adet', 50],
    ['Beyaz peynir', 'g', 260, 16, 2, 21, '1 dilim', 30],
    ['Domates', 'g', 18, 0.9, 3.9, 0.2, '1 adet', 120],
    ['Salatalık', 'g', 15, 0.7, 3.6, 0.1, '1 adet', 150],
    ['Elma', 'g', 52, 0.3, 14, 0.2, '1 orta boy', 150],
    ['Muz', 'g', 89, 1.1, 23, 0.3, '1 adet', 120],
    ['Tavuk göğsü (pişmiş)', 'g', 165, 31, 0, 3.6, '1 porsiyon', 120],
    ['Bulgur pilavı', 'g', 150, 3.5, 28, 2.5, '1 kase', 150],
    ['Mercimek çorbası', 'ml', 60, 3.5, 9, 1.2, '1 kase', 250],
    ['Yoğurt (tam yağlı)', 'g', 61, 3.5, 4.7, 3.3, '1 kase', 200],
    ['Süt (yarım yağlı)', 'ml', 46, 3.3, 4.8, 1.5, '1 su bardağı', 200],
    ['Zeytinyağı', 'g', 884, 0, 0, 100, '1 yemek kaşığı', 10],
    ['Ceviz', 'g', 654, 15, 14, 65, '3 adet', 12],
  ]
  const foods: Food[] = foodRows.map(([name, baseUnit, energyKcal, proteinG, carbsG, fatG, portionLabel, portionAmount], i) => ({
    id: seedId('food', i + 1),
    name,
    brand: null,
    baseUnit,
    energyKcal,
    proteinG,
    carbsG,
    fatG,
    portionLabel,
    portionAmount,
    source: SAMPLE_FOOD_SOURCE,
    isSample: true,
    cookingMethod: null,
    recipeYieldG: null,
    archivedAt: null,
    ...stamps,
  }))
  // Örnek tarif: 100 g değerleri malzemelerden hesaplanır; kayıttaki değerler kullanılmaz.
  const recipe: Food = {
    id: seedId('food', foodRows.length + 1),
    name: 'Sütlü yulaf lapası (örnek tarif)',
    brand: null,
    baseUnit: 'g',
    energyKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    portionLabel: '1 kase',
    portionAmount: 250,
    source: SAMPLE_FOOD_SOURCE,
    isSample: true,
    cookingMethod: 'boiled',
    recipeYieldG: 280,
    archivedAt: null,
    ...stamps,
  }
  foods.push(recipe)
  // Başlangıç besin listesi tarifin ardından gelir; önceki seed kimlikleri değişmez.
  FOOD_CATALOG.forEach(([name, baseUnit, energyKcal, proteinG, carbsG, fatG, cookingMethod], i) => {
    foods.push({
      id: seedId('food', foodRows.length + 2 + i),
      name,
      brand: null,
      baseUnit,
      energyKcal,
      proteinG,
      carbsG,
      fatG,
      portionLabel: null,
      portionAmount: null,
      source: SAMPLE_FOOD_SOURCE,
      isSample: true,
      cookingMethod,
      recipeYieldG: null,
      archivedAt: null,
      ...stamps,
    })
  })
  const food = (name: string) => {
    const f = foods.find((x) => x.name === name)
    if (!f) throw new Error(`Seed besini yok: ${name}`)
    return f.id
  }

  const mealTypeNames = ['Kahvaltı', 'Ara öğün 1', 'Öğle', 'Ara öğün 2', 'Akşam', 'Gece ara öğünü']
  const mealTypes: MealType[] = mealTypeNames.map((name, i) => ({
    id: seedId('mealType', i + 1),
    name,
    sortOrder: i + 1,
    archivedAt: null,
    ...stamps,
  }))
  const mealType = (name: string) => {
    const t = mealTypes.find((x) => x.name === name)
    if (!t) throw new Error(`Seed öğün türü yok: ${name}`)
    return t.id
  }

  const p = { deniz: seedId('mealPlan', 1), ece: seedId('mealPlan', 2), kaan: seedId('mealPlan', 3) }
  const daily = () => ({ kind: 'daily' as const, weeklyQuotas: [] })
  const mealPlans: MealPlan[] = [
    { id: p.deniz, clientId: c.deniz, title: 'Dengeli beslenme planı (örnek)', startDate: day(-7), endDate: day(20), notes: null, archivedAt: null, ...daily(), ...stamps },
    { id: p.ece, clientId: c.ece, title: 'Başlangıç planı (örnek)', startDate: day(-3), endDate: null, notes: null, archivedAt: null, ...daily(), ...stamps },
    {
      id: p.kaan,
      clientId: c.kaan,
      title: 'Seçenekli haftalık menü (örnek)',
      startDate: day(-2),
      endDate: null,
      notes: 'Danışan her öğünde seçeneklerden birini seçer.',
      archivedAt: null,
      kind: 'options',
      weeklyQuotas: [
        { mealTypeId: mealType('Kahvaltı'), perWeek: 7 },
        { mealTypeId: mealType('Öğle'), perWeek: 7 },
        { mealTypeId: mealType('Akşam'), perWeek: 7 },
        { mealTypeId: mealType('Ara öğün 2'), perWeek: 4 },
      ],
      ...stamps,
    },
  ]

  // [plan, gün (seçenekli planda seçenek numarası), öğün türü, saat, içerik: [besin, miktar(g/ml)]]
  type MealRow = [planId: string, dayNumber: number, type: string, time: string | null, items: [string, number][]]
  const mealRows: MealRow[] = [
    [p.deniz, 1, 'Kahvaltı', '08:00', [['Yulaf ezmesi', 40], ['Süt (yarım yağlı)', 200], ['Muz', 120], ['Ceviz', 12]]],
    [p.deniz, 1, 'Öğle', '12:30', [['Tavuk göğsü (pişmiş)', 120], ['Bulgur pilavı', 150], ['Salatalık', 150], ['Zeytinyağı', 5]]],
    [p.deniz, 1, 'Akşam', '19:00', [['Mercimek çorbası', 250], ['Tam buğday ekmeği', 30], ['Yoğurt (tam yağlı)', 200]]],
    [p.deniz, 2, 'Kahvaltı', '08:00', [['Yumurta', 100], ['Beyaz peynir', 30], ['Domates', 120], ['Tam buğday ekmeği', 60]]],
    [p.deniz, 2, 'Ara öğün 2', '16:00', [['Elma', 150], ['Ceviz', 12]]],
    [p.deniz, 2, 'Akşam', '19:00', [['Tavuk göğsü (pişmiş)', 120], ['Salatalık', 150], ['Zeytinyağı', 10]]],
    [p.ece, 1, 'Kahvaltı', '08:30', [['Yumurta', 50], ['Beyaz peynir', 30], ['Tam buğday ekmeği', 30], ['Domates', 120]]],
    [p.ece, 1, 'Öğle', '13:00', [['Mercimek çorbası', 250], ['Yoğurt (tam yağlı)', 150]]],
    // Seçenekli plan sonda: önceki seed kimlikleri değişmesin (seed tekrar çalıştırılabilir).
    [p.kaan, 1, 'Kahvaltı', null, [['Yumurta', 100], ['Beyaz peynir', 30], ['Domates', 120], ['Tam buğday ekmeği', 60]]],
    [p.kaan, 2, 'Kahvaltı', null, [['Yulaf ezmesi', 50], ['Süt (yarım yağlı)', 200], ['Ceviz', 12]]],
    [p.kaan, 3, 'Kahvaltı', null, [['Yoğurt (tam yağlı)', 200], ['Muz', 120], ['Yulaf ezmesi', 30]]],
    [p.kaan, 1, 'Öğle', null, [['Tavuk göğsü (pişmiş)', 150], ['Bulgur pilavı', 150], ['Salatalık', 150]]],
    [p.kaan, 2, 'Öğle', null, [['Mercimek çorbası', 300], ['Tam buğday ekmeği', 60], ['Yoğurt (tam yağlı)', 150]]],
    [p.kaan, 1, 'Akşam', null, [['Tavuk göğsü (pişmiş)', 120], ['Salatalık', 150], ['Domates', 120], ['Zeytinyağı', 10]]],
    [p.kaan, 2, 'Akşam', null, [['Mercimek çorbası', 250], ['Yoğurt (tam yağlı)', 200], ['Tam buğday ekmeği', 30]]],
    [p.kaan, 1, 'Ara öğün 2', null, [['Elma', 150], ['Ceviz', 12]]],
  ]
  const planMeals: PlanMeal[] = []
  const planMealItems: PlanMealItem[] = []
  mealRows.forEach(([mealPlanId, dayNumber, type, time, items], i) => {
    const planMealId = seedId('planMeal', i + 1)
    planMeals.push({ id: planMealId, mealPlanId, dayNumber, mealTypeId: mealType(type), time, notes: null, ...stamps })
    items.forEach(([name, quantity], sortOrder) => {
      planMealItems.push({
        id: seedId('planMealItem', planMealItems.length + 1),
        planMealId,
        foodId: food(name),
        quantity,
        sortOrder,
        notes: null,
        ...stamps,
      })
    })
  })

  const a = (n: number, clientId: string, offset: number, hour: number, minute: number, minutes: number, status: Appointment['status']): Appointment => {
    const startsAt = at(offset, hour, minute)
    return { id: seedId('appointment', n), clientId, startsAt, endsAt: new Date(Date.parse(startsAt) + minutes * 60_000).toISOString(), status, notes: null, ...stamps }
  }
  const appointments: Appointment[] = [
    a(1, c.deniz, -14, 9, 30, 45, 'completed'),
    a(2, c.kaan, -5, 11, 0, 45, 'completed'),
    a(3, c.ece, -3, 15, 0, 60, 'completed'),
    a(4, c.deniz, 0, 10, 0, 45, 'scheduled'),
    a(5, c.kaan, 1, 16, 0, 30, 'cancelled'),
    a(6, c.ece, 2, 14, 0, 30, 'scheduled'),
    a(7, c.kaan, 7, 11, 30, 45, 'scheduled'),
  ]

  const g = (n: number, v: Omit<ClientGoal, 'id' | 'createdAt' | 'updatedAt' | 'notes'>): ClientGoal => ({ id: seedId('clientGoal', n), notes: null, ...stamps, ...v })
  const clientGoals: ClientGoal[] = [
    g(1, { clientId: c.deniz, validFrom: day(-60), validTo: day(-8), energyKcal: 1900, proteinG: 85, carbsG: 230, fatG: 70, method: 'manual', activityFactor: null }),
    g(2, { clientId: c.deniz, validFrom: day(-7), validTo: null, energyKcal: 1750, proteinG: 90, carbsG: 200, fatG: 65, method: 'mifflin_st_jeor', activityFactor: 1.375 }),
    g(3, { clientId: c.ece, validFrom: day(-3), validTo: null, energyKcal: 1800, proteinG: 80, carbsG: 220, fatG: 65, method: 'manual', activityFactor: null }),
    g(4, { clientId: c.kaan, validFrom: day(-40), validTo: day(-6), energyKcal: 2300, proteinG: 120, carbsG: 260, fatG: 85, method: 'mifflin_st_jeor', activityFactor: 1.55 }),
  ]

  // Sağlık bilgileri kurgusaldır ve "(örnek)" olarak işaretlidir; tıbbi öneri değildir.
  const clientMedications: ClientMedication[] = [
    {
      id: seedId('clientMedication', 1),
      clientId: c.deniz,
      name: 'Demir takviyesi (örnek)',
      dose: '1 tablet',
      frequency: 'Günde 1 kez',
      startedOn: day(-45),
      endedOn: null,
      notes: null,
      ...stamps,
    },
  ]
  const clientConditions: ClientCondition[] = [
    { id: seedId('clientCondition', 1), clientId: c.deniz, name: 'Demir eksikliği (örnek)', diagnosedOn: day(-50), notes: null, ...stamps },
  ]
  const clientRecommendations: ClientRecommendation[] = [
    {
      id: seedId('clientRecommendation', 1),
      clientId: c.deniz,
      givenOn: day(-7),
      text: 'Gün içine yayarak su için; akşam öğününü yatmadan en az 2 saat önce tamamlayın. (örnek)',
      ...stamps,
    },
  ]

  const recipeIngredients: RecipeIngredient[] = [
    ['Yulaf ezmesi', 40],
    ['Süt (yarım yağlı)', 200],
    ['Muz', 60],
    ['Ceviz', 10],
  ].map(([name, quantity], i) => ({ id: seedId('recipeIngredient', i + 1), recipeId: recipe.id, foodId: food(name as string), quantity: quantity as number, sortOrder: i, ...stamps }))

  return {
    clients,
    measurements,
    foods,
    mealTypes,
    mealPlans,
    planMeals,
    planMealItems,
    appointments,
    clientGoals,
    clientMedications,
    clientConditions,
    clientRecommendations,
    recipeIngredients,
  }
}
