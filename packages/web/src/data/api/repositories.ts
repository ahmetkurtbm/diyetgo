/**
 * Repository arayüzlerinin HTTP API implementasyonu (yerel PostgreSQL modu).
 *
 * Doğrulama ve bütünlük kuralları sunucuda uygulanır; sunucunun hata yanıtı
 * (`{ error: { code, message, fieldErrors, conflictingIds } }`) aynı kodlarla `RepositoryError`'a çevrilir.
 * Veri değiştiren her başarılı istekten sonra aboneler bilgilendirilir.
 */
import type { ClientGoal, MealPlan } from '@diyetgo/shared'
import { RepositoryError, type MealPlanDetail, type Repositories, type RepositoryErrorCode } from '../repositories'

const ERROR_CODES = new Set<RepositoryErrorCode>(['validation', 'not_found', 'conflict', 'restricted'])

/** API 401 döndürdüğünde (oturum düştü) yayınlanır; `AuthGate` giriş ekranına döner. */
export const UNAUTHORIZED_EVENT = 'diyetgo:unauthorized'
const UNREACHABLE = "Sunucuya ulaşılamadı. Yerel API'nin çalıştığından emin olun (npm run dev:server)."

type ErrorBody = { error?: { code?: string; message?: string; fieldErrors?: Record<string, string>; conflictingIds?: string[] } }

type Query = Record<string, string | boolean | undefined>

function queryString(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value))
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function createApiRepositories(
  options: { baseUrl?: string; fetch?: typeof fetch; /** Oturum düştüğünde (401) çağrılır. */ onUnauthorized?: () => void } = {},
): Repositories {
  const baseUrl = options.baseUrl ?? '/api'
  const fetchFn = options.fetch ?? ((input, init) => fetch(input, init))
  const listeners = new Set<() => void>()

  async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new RepositoryError('storage', UNREACHABLE)
    }
    const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (!response.ok) {
      const error = (data as ErrorBody | undefined)?.error
      // Gövdesiz 5xx: API kapalıyken Vite proxy'sinin yanıtı.
      if (error === undefined && response.status >= 500) throw new RepositoryError('storage', UNREACHABLE)
      if (response.status === 401) options.onUnauthorized?.()
      const code = ERROR_CODES.has(error?.code as RepositoryErrorCode) ? (error!.code as RepositoryErrorCode) : 'storage'
      throw new RepositoryError(code, error?.message ?? 'Beklenmeyen bir sunucu hatası oluştu.', {
        fieldErrors: error?.fieldErrors,
        conflictingIds: error?.conflictingIds,
      })
    }
    if (method !== 'GET') for (const listener of listeners) listener()
    return data as T
  }

  const get = <T>(path: string, query?: Query) => request<T>('GET', `${path}${queryString(query)}`)
  const post = <T>(path: string, body: unknown) => request<T>('POST', path, body)
  const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
  const remove = (path: string) => request<void>('DELETE', path)
  const id = encodeURIComponent

  return {
    mode: 'api',
    demo: null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    clients: {
      list: ({ includeArchived, search } = {}) => get('/clients', { includeArchived, search }),
      get: (clientId) => get(`/clients/${id(clientId)}`),
      create: (input) => post('/clients', input),
      update: (clientId, input) => put(`/clients/${id(clientId)}`, input),
      setArchived: (clientId, archived) => put(`/clients/${id(clientId)}/archived`, { archived }),
      remove: (clientId) => remove(`/clients/${id(clientId)}`),
    },

    measurements: {
      listByClient: (clientId) => get(`/clients/${id(clientId)}/measurements`),
      create: (input) => post('/measurements', input),
      update: (measurementId, input) => put(`/measurements/${id(measurementId)}`, input),
      remove: (measurementId) => remove(`/measurements/${id(measurementId)}`),
    },

    foods: {
      list: ({ includeArchived, search } = {}) => get('/foods', { includeArchived, search }),
      get: (foodId) => get(`/foods/${id(foodId)}`),
      create: (input) => post('/foods', input),
      update: (foodId, input) => put(`/foods/${id(foodId)}`, input),
      setArchived: (foodId, archived) => put(`/foods/${id(foodId)}/archived`, { archived }),
      remove: (foodId) => remove(`/foods/${id(foodId)}`),
      countPlansUsing: async (foodId) => (await get<{ count: number }>(`/foods/${id(foodId)}/plan-count`)).count,
    },

    mealTypes: {
      list: ({ includeArchived } = {}) => get('/meal-types', { includeArchived }),
      create: (input) => post('/meal-types', input),
      update: (mealTypeId, input) => put(`/meal-types/${id(mealTypeId)}`, input),
      setArchived: (mealTypeId, archived) => put(`/meal-types/${id(mealTypeId)}/archived`, { archived }),
      remove: (mealTypeId) => remove(`/meal-types/${id(mealTypeId)}`),
    },

    mealPlans: {
      list: ({ includeArchived, clientId } = {}) => get('/meal-plans', { includeArchived, clientId }),
      get: (planId) => get<MealPlanDetail>(`/meal-plans/${id(planId)}`),
      create: (input) => post('/meal-plans', input),
      update: (planId, input) => put(`/meal-plans/${id(planId)}`, input),
      setArchived: (planId, archived) => put(`/meal-plans/${id(planId)}/archived`, { archived }),
      remove: (planId) => remove(`/meal-plans/${id(planId)}`),
      copy: (planId, target) => post<MealPlan>(`/meal-plans/${id(planId)}/copy`, target),
      addMeal: (input) => post('/plan-meals', input),
      updateMeal: (mealId, input) => put(`/plan-meals/${id(mealId)}`, input),
      removeMeal: (mealId) => remove(`/plan-meals/${id(mealId)}`),
      addItem: (input) => post('/plan-meal-items', input),
      updateItem: (itemId, input) => put(`/plan-meal-items/${id(itemId)}`, input),
      removeItem: (itemId) => remove(`/plan-meal-items/${id(itemId)}`),
    },

    appointments: {
      list: ({ from, to, clientId, status } = {}) => get('/appointments', { from, to, clientId, status }),
      create: (input) => post('/appointments', input),
      update: (appointmentId, input) => put(`/appointments/${id(appointmentId)}`, input),
      cancel: (appointmentId) => post(`/appointments/${id(appointmentId)}/cancel`, {}),
      remove: (appointmentId) => remove(`/appointments/${id(appointmentId)}`),
    },

    goals: {
      listByClient: (clientId) => get(`/clients/${id(clientId)}/goals`),
      create: (input) => post<{ goal: ClientGoal; closed: ClientGoal | null }>('/goals', input),
      update: (goalId, input) => put(`/goals/${id(goalId)}`, input),
      remove: (goalId) => remove(`/goals/${id(goalId)}`),
    },
  }
}
