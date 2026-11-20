import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, db } from "./helpers"

const brandIds: string[] = []
const productIds: string[] = []
const orderCodes: string[] = []
afterAll(async () => {
  await db.orderItem.deleteMany({ where: { order: { code: { in: orderCodes } } } })
  await db.order.deleteMany({ where: { code: { in: orderCodes } } })
  await db.brandPayout.deleteMany({ where: { brandId: { in: brandIds } } })
  await db.product.deleteMany({ where: { id: { in: productIds } } })
  await db.brand.deleteMany({ where: { id: { in: brandIds } } })
  await db.$disconnect()
})

const rnd = () => Math.random().toString(16).slice(2, 8)
const brandBody = (over: object = {}) => ({ name: `Test Marka ${rnd()}`, contactEmail: `marka-${rnd()}@aya.test`, commissionRate: 0.2, ...over })
async function makeBrand(admin: { token: string }, over: object = {}) {
  const r = await json("/api/admin/brands", admin, "POST", brandBody(over))
  expect(r.status).toBe(200)
  const { brand } = await r.json()
  brandIds.push(brand.id)
  return brand
}
const productBody = (over: object = {}) => ({
  name: `Marka Matı ${rnd()}`, summary: "Test için oluşturulmuş ürün.", description: "Bu ürün otomatik testler için oluşturuldu ve silinecek.",
  category: "matlar", priceTL: 400, stock: 10, images: [], status: "PUBLISHED", ...over,
})
async function makeProduct(admin: { token: string }, over: object = {}) {
  const r = await json("/api/admin/products", admin, "POST", productBody(over))
  expect(r.status).toBe(200)
  const { product } = await r.json()
  productIds.push(product.id)
  return product
}
const buyer = () => ({ name: "Deniz Kaya", email: `brand-buyer-${rnd()}@aya.test`, phone: "05321234567", address: "Test mah. 1. sok. No 1", city: "İzmir", payMethod: "havale" })
const place = (items: { productId: string; quantity: number }[]) => json("/api/shop/orders", null, "POST", { ...buyer(), items })

describe("brand partners: admin CRUD", () => {
  it("only admins manage brands", async () => {
    const student = await makeUser("STUDENT")
    expect((await json("/api/admin/brands", null, "POST", brandBody())).status).toBe(401)
    expect((await json("/api/admin/brands", student, "POST", brandBody())).status).toBe(403)
  })

  it("validates input: short name, bad e-mail, out-of-range commission, bad IBAN", async () => {
    const admin = await makeUser("ADMIN")
    for (const bad of [{ name: "A" }, { contactEmail: "nope" }, { commissionRate: 1.5 }, { commissionRate: -0.1 }, { iban: "not-an-iban" }]) {
      expect((await json("/api/admin/brands", admin, "POST", brandBody(bad))).status, JSON.stringify(bad)).toBe(400)
    }
  })

  it("creates, lists with product count, edits and deactivates (never hard-deletes)", async () => {
    const admin = await makeUser("ADMIN")
    const brand = await makeBrand(admin, { commissionRate: 0.25 })
    expect(brand).toMatchObject({ commissionRate: 0.25, active: true })

    const list = await (await api("/api/admin/brands", admin)).json()
    const row = list.brands.find((b: any) => b.id === brand.id)
    expect(row._count.products).toBe(0)
    await makeProduct(admin, { brandId: brand.id })
    const list2 = await (await api("/api/admin/brands", admin)).json()
    expect(list2.brands.find((b: any) => b.id === brand.id)._count.products).toBe(1)

    const patched = await json(`/api/admin/brands/${brand.id}`, admin, "PATCH", { name: "Yeni İsim" })
    expect(patched.status).toBe(200)
    expect((await patched.json()).brand.name).toBe("Yeni İsim")

    expect((await api(`/api/admin/brands/${brand.id}`, admin, { method: "DELETE" })).status).toBe(200)
    const detail = await (await api(`/api/admin/brands/${brand.id}`, admin)).json()
    expect(detail.brand.active).toBe(false) // deactivated, not deleted — its products and sales history must stay intact
  })
})

describe("products reference a brand (or none = AYA's own)", () => {
  it("refuses an unknown brandId and accepts a real one", async () => {
    const admin = await makeUser("ADMIN")
    expect((await json("/api/admin/products", admin, "POST", productBody({ brandId: "does-not-exist" }))).status).toBe(400)
    const brand = await makeBrand(admin)
    const product = await makeProduct(admin, { brandId: brand.id })
    expect(product.brandId).toBe(brand.id)
    const noBrand = await makeProduct(admin)
    expect(noBrand.brandId).toBeNull()
  })

  it("shows the brand name on the public shop (cover list, category page and product page)", async () => {
    const admin = await makeUser("ADMIN")
    const brand = await makeBrand(admin, { name: `Görünür Marka ${rnd()}` })
    const product = await makeProduct(admin, { brandId: brand.id, featured: true })
    const detail = await (await api(`/shop/urun/${product.slug}`)).text()
    expect(detail).toContain(brand.name)
    const category = await (await api(`/shop/${product.category}`)).text()
    expect(category).toContain(brand.name)
    const shopHome = await (await api("/shop")).text()
    expect(shopHome).toContain(brand.name)
  })
})

describe("brand earnings and payouts follow real sales", () => {
  it("earns from paid orders only, using the commission rate snapshotted at sale time, and lets the admin record a payout", async () => {
    const admin = await makeUser("ADMIN")
    const brand = await makeBrand(admin, { commissionRate: 0.2 }) // brand keeps 80%
    const product = await makeProduct(admin, { brandId: brand.id, priceTL: 1000, stock: 5 })

    const before = await (await api(`/api/admin/brands/${brand.id}`, admin)).json()
    expect(before).toMatchObject({ earnedKurus: 0, claimedKurus: 0, availableKurus: 0 })

    // an unpaid order earns nothing yet
    const pending = await place([{ productId: product.id, quantity: 1 }])
    expect(pending.status).toBe(200)
    const { code } = await pending.json()
    orderCodes.push(code)
    const order = await db.order.findUniqueOrThrow({ where: { code } })
    expect((await (await api(`/api/admin/brands/${brand.id}`, admin)).json()).earnedKurus).toBe(0)

    // changing the brand's rate afterwards must not touch this still-pending sale's eventual earnings
    await json(`/api/admin/brands/${brand.id}`, admin, "PATCH", { commissionRate: 0.5 })

    // now mark it paid — 1000 TL × 80% (the rate at the time of the sale, not the new 50%) = 800 TL = 80000 kuruş
    expect((await json(`/api/admin/orders/${order.id}`, admin, "POST", { status: "PAID" })).status).toBe(200)
    const afterPaid = await (await api(`/api/admin/brands/${brand.id}`, admin)).json()
    expect(afterPaid.earnedKurus).toBe(80_000)
    expect(afterPaid.availableKurus).toBe(80_000)

    // payout: rejects under the minimum and over the available balance
    expect((await json(`/api/admin/brands/${brand.id}/payouts`, admin, "POST", { amountKurus: 100 })).status).toBe(400)
    expect((await json(`/api/admin/brands/${brand.id}/payouts`, admin, "POST", { amountKurus: 999_999 })).status).toBe(400)

    const paid = await json(`/api/admin/brands/${brand.id}/payouts`, admin, "POST", { amountKurus: 50_000, note: "Kasım" })
    expect(paid.status).toBe(200)
    const afterPayout = await (await api(`/api/admin/brands/${brand.id}`, admin)).json()
    expect(afterPayout).toMatchObject({ earnedKurus: 80_000, claimedKurus: 50_000, availableKurus: 30_000 })
    expect(afterPayout.payouts).toHaveLength(1)
    expect(afterPayout.payouts[0]).toMatchObject({ amountKurus: 50_000, note: "Kasım" })

    // cancelling (refunding) the order afterwards claws the earnings back automatically
    expect((await json(`/api/admin/orders/${order.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(200)
    const afterCancel = await (await api(`/api/admin/brands/${brand.id}`, admin)).json()
    expect(afterCancel.earnedKurus).toBe(0)
    expect(afterCancel.availableKurus).toBe(0) // already paid out 50000 but now owed 0 — never negative
  })
})
