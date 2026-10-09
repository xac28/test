import { afterEach, describe, expect, it, vi } from "vitest"
import { iyzicoMode, retrieveShopCheckout, startShopCheckout, tl } from "@/lib/iyzico"

const order = { code: "AYA-TEST01", totalKurus: 24990, shippingKurus: 0, email: "a@b.com", name: "Ayşe Yılmaz", phone: "05320000000", address: "Test mah. 1", city: "Bursa", items: [{ id: "p1", name: "Mat", unitKurus: 24990, quantity: 1 }] }
afterEach(() => vi.unstubAllEnvs())

describe("iyzico modes", () => {
  it("is off without keys, live with real keys, and the stand-in only outside production", () => {
    vi.stubEnv("IYZICO_API_KEY", ""); vi.stubEnv("IYZICO_SECRET_KEY", ""); vi.stubEnv("IYZICO_MOCK", "")
    expect(iyzicoMode()).toBe("off")
    vi.stubEnv("IYZICO_API_KEY", "sandbox-api-key"); vi.stubEnv("IYZICO_SECRET_KEY", "sandbox-secret-key")
    expect(iyzicoMode()).toBe("off") // the old placeholders do not count
    vi.stubEnv("IYZICO_API_KEY", "sandbox-AbCdEf123"); vi.stubEnv("IYZICO_SECRET_KEY", "xyz987")
    expect(iyzicoMode()).toBe("live") // iyzico's real sandbox keys also start with "sandbox-"
    vi.stubEnv("IYZICO_API_KEY", "dummy"); vi.stubEnv("IYZICO_SECRET_KEY", "change-me")
    expect(iyzicoMode()).toBe("off")
    vi.stubEnv("IYZICO_API_KEY", "AbCdEf123"); vi.stubEnv("IYZICO_SECRET_KEY", "xyz987")
    expect(iyzicoMode()).toBe("live")
    vi.stubEnv("IYZICO_API_KEY", ""); vi.stubEnv("IYZICO_SECRET_KEY", ""); vi.stubEnv("IYZICO_MOCK", "1"); vi.stubEnv("NODE_ENV", "test")
    expect(iyzicoMode()).toBe("mock")
    vi.stubEnv("NODE_ENV", "production")
    expect(iyzicoMode()).toBe("off") // the stand-in can never run in production
  })

  it("formats amounts the way the provider wants them", () => {
    expect(tl(24990)).toBe("249.90")
    expect(tl(5)).toBe("0.05")
    expect(tl(100000)).toBe("1000.00")
  })
})

describe("the local stand-in", () => {
  it("gives a signed token per outcome and reads it back", async () => {
    vi.stubEnv("IYZICO_API_KEY", ""); vi.stubEnv("IYZICO_SECRET_KEY", ""); vi.stubEnv("IYZICO_MOCK", "1"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("AUTH_SECRET", "unit-secret")
    const s = await startShopCheckout(order, { callbackUrl: "https://x/cb", ip: "1.2.3.4" })
    const [ok, fail] = [...s.html.matchAll(/name="token" value="([^"]+)"/g)].map((m) => m[1])
    expect(await retrieveShopCheckout(ok)).toMatchObject({ ok: true, code: "AYA-TEST01", paidKurus: 24990 })
    expect(await retrieveShopCheckout(fail)).toMatchObject({ ok: false, code: "AYA-TEST01" })
    expect(await retrieveShopCheckout(`${ok}x`)).toMatchObject({ ok: false, code: null })
    expect(await retrieveShopCheckout("garbage")).toMatchObject({ ok: false })
    expect(await retrieveShopCheckout("mock.e30.abc")).toMatchObject({ ok: false })
    // a token signed with another secret is refused
    vi.stubEnv("AUTH_SECRET", "other-secret")
    expect(await retrieveShopCheckout(ok)).toMatchObject({ ok: false, code: null })
  })

  it("refuses to start when switched off", async () => {
    vi.stubEnv("IYZICO_API_KEY", ""); vi.stubEnv("IYZICO_SECRET_KEY", ""); vi.stubEnv("IYZICO_MOCK", "")
    await expect(startShopCheckout(order, { callbackUrl: "x", ip: "1" })).rejects.toThrow()
    expect(await retrieveShopCheckout("mock.x.y")).toMatchObject({ ok: false, error: "off" })
  })
})
