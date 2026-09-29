import { describe, expect, it } from 'vitest'
import { appPathFromUrl } from '../lib/links'

describe('appPathFromUrl', () => {
  it('maps customer-app links to router paths', () => {
    expect(appPathFromUrl('https://www.ngopu.app/app/store/furra-e-lagjes')).toBe('/store/furra-e-lagjes')
    expect(appPathFromUrl('https://ngopu.app/app/orders/o_123')).toBe('/orders/o_123')
    expect(appPathFromUrl('https://www.ngopu.app/app')).toBe('/')
    expect(appPathFromUrl('https://www.ngopu.app/app/')).toBe('/')
  })

  it('keeps the query string for email links', () => {
    expect(appPathFromUrl('https://www.ngopu.app/app/verify?token=abc')).toBe('/verify?token=abc')
    expect(appPathFromUrl('https://www.ngopu.app/app/reset?token=abc&x=1')).toBe('/reset?token=abc&x=1')
  })

  it('maps short store links', () => {
    expect(appPathFromUrl('https://www.ngopu.app/store/sushi-koi')).toBe('/store/sushi-koi')
  })

  it('accepts the bare website paths used in push payloads', () => {
    expect(appPathFromUrl('/app/orders/o_1')).toBe('/orders/o_1')
    expect(appPathFromUrl('/app')).toBe('/')
  })

  it('leaves the website pages to the browser', () => {
    expect(appPathFromUrl('https://www.ngopu.app/')).toBeNull()
    expect(appPathFromUrl('https://www.ngopu.app/dashboard/orders')).toBeNull()
    expect(appPathFromUrl('https://www.ngopu.app/privacy')).toBeNull()
    expect(appPathFromUrl('https://www.ngopu.app/terms')).toBeNull()
    expect(appPathFromUrl('https://www.ngopu.app/application')).toBeNull()
  })

  it('ignores other hosts and schemes', () => {
    expect(appPathFromUrl('https://example.com/app/store/x')).toBeNull()
    expect(appPathFromUrl('mailto:hello@ngopu.app')).toBeNull()
    expect(appPathFromUrl('not a url')).toBeNull()
  })
})
