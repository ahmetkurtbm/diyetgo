import vercelJson from '../../../vercel.json?raw'
import { describe, expect, it } from 'vitest'

type Rule = { source: string; headers: { key: string; value: string }[] }

const config = JSON.parse(vercelJson) as {
  buildCommand: string
  outputDirectory: string
  rewrites: { source: string; destination: string }[]
  headers: Rule[]
}

describe('vercel.json', () => {
  it('derleme ve yönlendirme ayarlarını korur', () => {
    expect(config.buildCommand).toBe('VITE_DATA_MODE=demo npm run build')
    expect(config.outputDirectory).toBe('packages/web/dist')
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('tüm yollara güvenlik başlıklarını ekler', () => {
    const rule = config.headers.find((r) => r.source === '/(.*)')
    const headers = Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]))
    expect(headers).toEqual({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    })
  })

  it('içerik güvenlik ilkesi (CSP) eklemez', () => {
    const keys = config.headers.flatMap((r) => r.headers.map((h) => h.key.toLowerCase()))
    expect(keys).not.toContain('content-security-policy')
  })
})
