import { describe, expect, it } from 'vitest'
import { ApiError } from '../errors'
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, pageOf } from '../services/common'
import { pageParams } from './params'

describe('pageOf', () => {
  it('varsayılan olarak 500 satır ve 0 ofset verir', () => {
    expect(DEFAULT_LIST_LIMIT).toBe(500)
    expect(pageOf()).toEqual({ limit: 500, offset: 0 })
    expect(pageOf({})).toEqual({ limit: 500, offset: 0 })
  })

  it('limit en çok 1000 olur; küçük değerler ve ofset korunur', () => {
    expect(MAX_LIST_LIMIT).toBe(1000)
    expect(pageOf({ limit: 5000 }).limit).toBe(1000)
    expect(pageOf({ limit: 1000 }).limit).toBe(1000)
    expect(pageOf({ limit: 10, offset: 20 })).toEqual({ limit: 10, offset: 20 })
  })
})

describe('pageParams', () => {
  it('sorgu verilmemişse boş sayfa isteği döndürür', () => {
    expect(pageParams({})).toEqual({ limit: undefined, offset: undefined })
  })

  it('tam sayı metinlerini sayıya çevirir', () => {
    expect(pageParams({ limit: '25', offset: '50' })).toEqual({ limit: 25, offset: 50 })
    expect(pageParams({ offset: '0' }).offset).toBe(0)
  })

  it.each([
    { limit: '0' },
    { limit: '-1' },
    { limit: 'abc' },
    { limit: '1.5' },
    { limit: '' },
    { limit: ['1', '2'] },
    { offset: '-5' },
    { offset: 'x' },
  ])('geçersiz değeri %j reddeder', (query) => {
    expect(() => pageParams(query)).toThrow(ApiError)
  })
})
