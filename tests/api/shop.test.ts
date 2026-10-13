import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, db } from "./helpers"

const made = { products: [] as string[], emails: new Set<string>() }
afterAll(async () => {
  await db.order.deleteMany({ where: { email: { in: [...made.emails] } } })
  await db.product.deleteMany({ where: { id: { in: made.products } } })
  await db.$disconnect()
})

const rnd = () => Math.random().toString(16).slice(2, 8)
const productBody = (over: object = {}) => ({
  name: `Test mat ${rnd()}`, summary: "Test için oluşturulmuş kaymaz yoga matı.", description: "Bu ürün otomatik testler için oluşturuldu ve silinecek.",
  category: "matlar", priceTL: 300, stock: 5, images: [], status: "PUBLISHED", ...over,
})
async function makeProduct(admin: { token: string }, over: object = {}) {
  const r = await json("/api/admin/products", admin, "POST", productBody(over))
  expect(r.status).toBe(200)
  const p = (await r.json()).product
  made.products.push(p.id)
  return p
}
const buyer = () => {
  const email = `shop-${rnd()}@aya.test`
  made.emails.add(email)
  return { name: "Ayşe Yılmaz", email, phone: "05321234567", address: "Bahçelievler mah. 12. sok. No 4 D 2", city: "Ankara / Çankaya", payMethod: "havale" }
}
const place = (items: { productId: string; quantity: number }[], over: object = {}) => json("/api/shop/orders", null, "POST", { ...buyer(), items, ...over })
const stockOf = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock

describe("admin products", () => {
  it("only admins manage products; drafts are invisible to the shop; edits and delete work", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    expect((await json("/api/admin/products", null, "POST", productBody())).status).toBe(401)
    expect((await json("/api/admin/products", student, "POST", productBody())).status).toBe(403)
    expect((await json("/api/admin/products", admin, "POST", productBody({ priceTL: 0 }))).status).toBe(400)
    expect((await json("/api/admin/products", admin, "POST", productBody({ category: "araba" }))).status).toBe(400)

    const p = await makeProduct(admin, { status: "DRAFT", priceTL: 749.9 })
    expect(p.priceKurus).toBe(74990)
    expect(p.slug).toMatch(/^test-mat-/)
    const draftCart = await (await api(`/api/shop/cart?ids=${p.id}`)).json()
    expect(draftCart.products).toHaveLength(0)
    expect((await place([{ productId: p.id, quantity: 1 }])).status).toBe(409) // cannot buy a draft

    const pub = await json(`/api/admin/products/${p.id}`, admin, "PATCH", { status: "PUBLISHED", stock: 9, priceTL: 500 })
    expect(pub.status).toBe(200)
    const live = await (await api(`/api/shop/cart?ids=${p.id}`)).json()
    expect(live.products[0]).toMatchObject({ id: p.id, priceKurus: 50000, stock: 9 })
    expect((await api(`/shop/urun/${p.slug}`)).status).toBe(200)

    await json(`/api/admin/products/${p.id}`, admin, "PATCH", { status: "DRAFT" })
    expect((await api(`/shop/urun/${p.slug}`)).status).toBe(404)

    expect((await json(`/api/admin/products/${p.id}`, admin, "PATCH", { stock: -3 })).status).toBe(400)
    expect((await api(`/api/admin/products/${p.id}`, admin, { method: "DELETE" })).status).toBe(200)
    expect(await db.product.count({ where: { id: p.id } })).toBe(0)
  })
})

describe("orders and stock", () => {
  it("reserves stock, snapshots prices, charges shipping under the free line, and hides private data from the public lookup", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin, { priceTL: 300, stock: 5 })
    const r = await place([{ productId: p.id, quantity: 1 }])
    expect(r.status).toBe(200)
    const { code } = await r.json()
    expect(code).toMatch(/^AYA-[A-Z2-9]{6}$/)
    expect(await stockOf(p.id)).toBe(4)

    const o = await db.order.findUniqueOrThrow({ where: { code }, include: { items: true } })
    expect(o).toMatchObject({ subtotalKurus: 30000, shippingKurus: 4990, totalKurus: 34990, status: "PENDING_PAYMENT", payMethod: "havale" })
    expect(o.items[0]).toMatchObject({ name: p.name, unitKurus: 30000, quantity: 1 })

    // a later price change never rewrites the order
    await json(`/api/admin/products/${p.id}`, admin, "PATCH", { priceTL: 999 })
    expect((await db.order.findUniqueOrThrow({ where: { code }, include: { items: true } })).items[0].unitKurus).toBe(30000)

    const big = await place([{ productId: p.id, quantity: 2 }]) // 2 × 999 ≥ 500 TL → free shipping
    expect((await db.order.findUniqueOrThrow({ where: { code: (await big.json()).code } })).shippingKurus).toBe(0)

    const pub = await (await api(`/api/shop/orders/${code.toLowerCase()}`)).json()
    expect(pub).toMatchObject({ code, status: "PENDING_PAYMENT", totalKurus: 34990 })
    const text = JSON.stringify(pub)
    for (const secret of ["Bahçelievler", "05321234567", "@aya.test", "Ayşe"]) expect(text).not.toContain(secret)
    expect((await api("/api/shop/orders/AYA-NOPE22")).status).toBe(404)
  })

  it("is all-or-nothing: one short line rejects the order and releases the other lines", async () => {
    const admin = await makeUser("ADMIN")
    const a = await makeProduct(admin, { stock: 5 })
    const b = await makeProduct(admin, { stock: 1 })
    const r = await place([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 3 }])
    expect(r.status).toBe(409)
    expect((await r.json()).error).toContain(b.name)
    expect(await stockOf(a.id)).toBe(5)
    expect(await stockOf(b.id)).toBe(1)
  })

  it("never oversells under concurrent orders", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin, { stock: 3 })
    const results = await Promise.all(Array.from({ length: 6 }, () => place([{ productId: p.id, quantity: 1 }])))
    expect(results.filter((r) => r.status === 200)).toHaveLength(3)
    expect(results.filter((r) => r.status === 409)).toHaveLength(3)
    expect(await stockOf(p.id)).toBe(0)
  })

  it("rejects malformed orders", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin)
    for (const bad of [{ items: [] }, { items: [{ productId: p.id, quantity: 0 }] }, { email: "x" }, { phone: "1" }, { payMethod: "kredi" }]) {
      expect((await place([{ productId: p.id, quantity: 1 }], bad)).status, JSON.stringify(bad)).toBe(400)
    }
    expect(await stockOf(p.id)).toBe(5)
  })
})

describe("order handling by the admin", () => {
  it("bank transfer follows pending → paid → shipped (tracking required) → delivered and cannot go back", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    const p = await makeProduct(admin)
    const { code } = await (await place([{ productId: p.id, quantity: 1 }])).json()
    const o = await db.order.findUniqueOrThrow({ where: { code } })
    const go = (status: string, extra: object = {}, as: any = admin) => json(`/api/admin/orders/${o.id}`, as, "POST", { status, ...extra })

    expect((await go("PAID", {}, student)).status).toBe(403)
    expect((await go("SHIPPED")).status).toBe(409) // must be paid first
    expect((await go("NOPE")).status).toBe(400)
    expect((await go("PAID")).status).toBe(200)
    expect((await go("SHIPPED")).status).toBe(409) // no tracking number
    const shipped = await go("SHIPPED", { trackingNo: "TR123456789" })
    expect(shipped.status).toBe(200)
    expect((await (await api(`/api/shop/orders/${code}`)).json()).trackingNo).toBe("TR123456789")
    expect((await go("PAID")).status).toBe(409)
    expect((await go("CANCELLED")).status).toBe(409)
    expect((await go("DELIVERED")).status).toBe(200)
    expect((await go("CANCELLED")).status).toBe(409)
    expect(await db.auditLog.count({ where: { actorId: admin.id, targetId: o.id, action: { startsWith: "ORDER_" } } })).toBe(3)
  })

  it("cancelling puts the stock back exactly once; pay on delivery may ship unpaid", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin, { stock: 5 })
    const { code } = await (await place([{ productId: p.id, quantity: 2 }])).json()
    const o = await db.order.findUniqueOrThrow({ where: { code } })
    expect(await stockOf(p.id)).toBe(3)
    expect((await json(`/api/admin/orders/${o.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(200)
    expect(await stockOf(p.id)).toBe(5)
    expect((await json(`/api/admin/orders/${o.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(409)
    expect(await stockOf(p.id)).toBe(5)

    const cod = await (await place([{ productId: p.id, quantity: 1 }], { payMethod: "kapida" })).json()
    const c = await db.order.findUniqueOrThrow({ where: { code: cod.code } })
    expect((await json(`/api/admin/orders/${c.id}`, admin, "POST", { status: "SHIPPED", trackingNo: "KRY1" })).status).toBe(200)
    expect((await json(`/api/admin/orders/${c.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(200) // refused at the door
    expect(await stockOf(p.id)).toBe(5)
  })

  it("lists, filters, searches and exports orders (admin only)", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    const p = await makeProduct(admin)
    const { code } = await (await place([{ productId: p.id, quantity: 1 }])).json()
    expect((await api("/api/admin/orders", student)).status).toBe(403)
    const hit = await (await api(`/api/admin/orders?q=${code}`, admin)).json()
    expect(hit.orders).toHaveLength(1)
    expect(hit.orders[0].items[0].name).toBe(p.name)
    expect((await (await api(`/api/admin/orders?q=${code}&status=PAID`, admin)).json()).orders).toHaveLength(0)
    expect((await (await api("/api/admin/orders", admin)).json()).statusCounts.PENDING_PAYMENT).toBeGreaterThan(0)
    const csv = await api(`/api/admin/orders?format=csv&q=${code}`, admin)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(await csv.text()).toContain(code)
  })
})

describe("shop maintenance cron", () => {
  it("cancels bank-transfer orders unpaid for 3+ days and releases their stock; leaves fresh and cash orders alone", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin, { stock: 5 })
    const mk = async (over: object) => {
      const { code } = await (await place([{ productId: p.id, quantity: 1 }], over)).json()
      return db.order.findUniqueOrThrow({ where: { code } })
    }
    const stale = await mk({})
    const staleCod = await mk({ payMethod: "kapida" })
    const fresh = await mk({})
    expect(await stockOf(p.id)).toBe(2)
    const old = new Date(Date.now() - 4 * 86_400_000)
    await db.order.updateMany({ where: { id: { in: [stale.id, staleCod.id] } }, data: { createdAt: old } })

    expect((await api("/api/cron/shop-maintenance", null, { method: "POST" })).status).toBe(401)
    expect((await api("/api/cron/shop-maintenance", null, { method: "POST", headers: { authorization: "Bearer wrong" } })).status).toBe(401)
    const res = await api("/api/cron/shop-maintenance", null, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    expect(res.status).toBe(200)
    expect((await db.order.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("CANCELLED")
    expect((await db.order.findUniqueOrThrow({ where: { id: staleCod.id } })).status).toBe("PENDING_PAYMENT")
    expect((await db.order.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("PENDING_PAYMENT")
    expect(await stockOf(p.id)).toBe(3)
    await api("/api/cron/shop-maintenance", null, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    expect(await stockOf(p.id)).toBe(3) // a second run changes nothing
  })
})

describe("card payments (iyzico)", () => {
  const CRON = process.env.CRON_SECRET!
  const form = (token: string) => { const f = new FormData(); f.set("token", token); return f }
  const callback = (token: string) => api("/api/iyzico/shop-callback", null, { method: "POST", body: form(token), redirect: "manual" })
  const where = (r: Response) => r.headers.get("location") ?? ""
  const tokens = (html: string) => [...html.matchAll(/name="token" value="([^"]+)"/g)].map((m) => m[1])

  /** The card option exists only where iyzico (or its local stand-in) is switched on; elsewhere these tests have nothing to check. */
  async function cardOn(admin: { token: string }) {
    const p = await makeProduct(admin, { stock: 1 })
    const r = await place([{ productId: p.id, quantity: 1 }], { payMethod: "kart" })
    if (r.status === 400) return false
    const code = (await r.json()).code
    await db.order.deleteMany({ where: { code } })
    return true
  }
  async function cardOrder(admin: { token: string }, quantity = 1, stock = 5) {
    const p = await makeProduct(admin, { stock })
    const body = buyer()
    const r = await json("/api/shop/orders", null, "POST", { ...body, payMethod: "kart", items: [{ productId: p.id, quantity }] })
    expect(r.status).toBe(200)
    const code = (await r.json()).code as string
    const pay = await json(`/api/shop/orders/${code}/pay`, null, "POST", { email: body.email })
    expect(pay.status).toBe(200)
    const html = (await pay.json()).htmlContent as string
    const [ok, fail] = tokens(html)
    return { p, code, email: body.email, ok, fail, html }
  }

  it("is offered only when switched on; elsewhere a card order is refused", async () => {
    const admin = await makeUser("ADMIN")
    const p = await makeProduct(admin)
    const r = await place([{ productId: p.id, quantity: 1 }], { payMethod: "kart" })
    if (r.status === 400) {
      expect((await r.json()).error).toContain("Kartla ödeme")
      expect(await stockOf(p.id)).toBe(5) // nothing reserved
    } else expect(r.status).toBe(200)
  })

  it("holds the stock, opens the payment page only for the order's e-mail, and marks the order paid after a successful payment — once", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const o = await cardOrder(admin, 2)
    expect(await stockOf(o.p.id)).toBe(3)
    const order = () => db.order.findUniqueOrThrow({ where: { code: o.code } })
    expect((await order()).status).toBe("PENDING_PAYMENT")
    expect((await order()).payMethod).toBe("kart")
    expect((await json(`/api/shop/orders/${o.code}/pay`, null, "POST", { email: "baska@aya.test" })).status).toBe(404)
    expect((await json(`/api/shop/orders/${o.code}/pay`, null, "POST", {})).status).toBe(404)
    expect(o.html).toContain("mock-pay-ok")

    const done = await Promise.all([callback(o.ok), callback(o.ok)]) // the provider may call twice
    for (const r of done) { expect(r.status).toBe(303); expect(where(r)).toContain(`/shop/siparis/${o.code}?odeme=ok`) }
    const paid = await order()
    expect(paid.status).toBe("PAID")
    expect(paid.paymentRef).toBeTruthy()
    expect(await stockOf(o.p.id)).toBe(3)
    // a third call changes nothing; paying an already paid order is refused
    expect(where(await callback(o.ok))).toContain("odeme=ok")
    expect((await order()).status).toBe("PAID")
    expect((await json(`/api/shop/orders/${o.code}/pay`, null, "POST", { email: o.email })).status).toBe(409)
    // the public lookup shows the new status
    expect((await (await api(`/api/shop/orders/${o.code}`)).json()).status).toBe("PAID")
  })

  it("keeps the order open after a declined payment so it can be tried again", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const o = await cardOrder(admin)
    const r = await callback(o.fail)
    expect(where(r)).toContain(`/shop/siparis/${o.code}?odeme=hata`)
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe("PENDING_PAYMENT")
    expect((await json(`/api/shop/orders/${o.code}/pay`, null, "POST", { email: o.email })).status).toBe(200)
  })

  it("never trusts a forged token or a wrong amount", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const o = await cardOrder(admin)
    const [tag, payload, sig] = o.ok.split(".")
    const forged = `${tag}.${Buffer.from(JSON.stringify({ c: o.code, a: 1, r: "ok" })).toString("base64url")}.${sig}`
    expect(where(await callback(forged))).not.toContain("odeme=ok")
    expect(where(await callback("rastgele"))).toMatch(/\/shop$/)
    expect(where(await callback(""))).toMatch(/\/shop$/)
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe("PENDING_PAYMENT")
    // the total changed after the token was made (e.g. an edit): the payment no longer matches, the order is not confirmed
    await db.order.update({ where: { code: o.code }, data: { totalKurus: { increment: 500 } } })
    expect(where(await callback(o.ok))).toContain("odeme=hata")
    expect((await db.order.findUniqueOrThrow({ where: { code: o.code } })).status).toBe("PENDING_PAYMENT")
    void payload
  })

  it("a payment that arrives after the order was cancelled is flagged for a refund, not lost", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const o = await cardOrder(admin, 2)
    const order = await db.order.findUniqueOrThrow({ where: { code: o.code } })
    expect((await json(`/api/admin/orders/${order.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(200)
    expect(await stockOf(o.p.id)).toBe(5)
    const r = await callback(o.ok)
    expect(where(r)).toContain("odeme=iptal")
    const after = await db.order.findUniqueOrThrow({ where: { code: o.code } })
    expect(after.status).toBe("CANCELLED")
    expect(after.paymentRef).toBeTruthy()
    expect(after.adminNote).toContain("iade gerekli")
    expect(await stockOf(o.p.id)).toBe(5) // the shelf is not taken again
  })

  it("the maintenance job frees the stock of card orders left unpaid for 2 hours, but not fresh ones or bank transfers", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const old = await cardOrder(admin, 1)
    const fresh = await cardOrder(admin, 1)
    const bank = await place([{ productId: (await makeProduct(admin)).id, quantity: 1 }])
    const bankCode = (await bank.json()).code
    const past = new Date(Date.now() - 3 * 3_600_000)
    await db.order.updateMany({ where: { code: { in: [old.code, bankCode] } }, data: { createdAt: past } })
    const res = await api("/api/cron/shop-maintenance", null, { method: "POST", headers: { authorization: `Bearer ${CRON}` } })
    expect(res.status).toBe(200)
    const status = async (c: string) => (await db.order.findUniqueOrThrow({ where: { code: c } })).status
    expect(await status(old.code)).toBe("CANCELLED")
    expect(await stockOf(old.p.id)).toBe(5)
    expect(await status(fresh.code)).toBe("PENDING_PAYMENT")
    expect(await status(bankCode)).toBe("PENDING_PAYMENT") // bank transfers get 3 days
    // a late payment for the cancelled one is then caught by the refund rule above
    expect(where(await callback(old.ok))).toContain("odeme=iptal")
  })

  it("only a card order can be paid by card", async () => {
    const admin = await makeUser("ADMIN")
    if (!(await cardOn(admin))) return
    const p = await makeProduct(admin)
    const body = buyer()
    const code = (await (await json("/api/shop/orders", null, "POST", { ...body, items: [{ productId: p.id, quantity: 1 }] })).json()).code
    expect((await json(`/api/shop/orders/${code}/pay`, null, "POST", { email: body.email })).status).toBe(400)
  })
})
