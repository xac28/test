import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const IBAN = "TR33 0006 1005 1978 6457 8413 26"

async function teacherWithEarnings(completedPrices: number[]) {
  const { user, teacher } = await makeTeacher()
  const student = await makeUser("STUDENT")
  for (const p of completedPrices) await makeBooking(teacher.id, student.id, "COMPLETED", p)
  return { user, teacher }
}

describe("teacher payout requests", () => {
  it("balance = completed lessons minus commission; requests reduce it; rejection restores it", async () => {
    const { user } = await teacherWithEarnings([100, 100]) // 200 * 0.85 = 170
    const admin = await makeUser("ADMIN")

    const bal = await (await api("/api/teacher/payouts", user)).json()
    expect(bal.earned).toBe(170)
    expect(bal.available).toBe(170)

    // validation
    expect((await json("/api/teacher/payouts", user, "POST", { amount: 5, iban: IBAN, accountName: "Ayşe Yılmaz" })).status).toBe(400)
    expect((await json("/api/teacher/payouts", user, "POST", { amount: 500, iban: IBAN, accountName: "Ayşe Yılmaz" })).status).toBe(400)
    expect((await json("/api/teacher/payouts", user, "POST", { amount: 50, iban: "TR00", accountName: "Ayşe Yılmaz" })).status).toBe(400)

    const created = await json("/api/teacher/payouts", user, "POST", { amount: 120, iban: IBAN, accountName: "Ayşe Yılmaz" })
    expect(created.status).toBe(200)
    const { request } = await created.json()
    expect(request.status).toBe("PENDING")

    expect((await (await api("/api/teacher/payouts", user)).json()).available).toBe(50)
    // cannot over-claim the remainder
    expect((await json("/api/teacher/payouts", user, "POST", { amount: 60, iban: IBAN, accountName: "Ayşe Yılmaz" })).status).toBe(400)

    // admin rejects (reason required) → balance is restored
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "reject" })).status).toBe(400)
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "reject", note: "IBAN hatalı" })).status).toBe(200)
    const after = await (await api("/api/teacher/payouts", user)).json()
    expect(after.available).toBe(170)
    expect(after.requests[0].status).toBe("REJECTED")
    expect(after.requests[0].adminNote).toBe("IBAN hatalı")
  })

  it("parallel requests cannot both claim the same balance", async () => {
    const { user } = await teacherWithEarnings([100]) // 85 available
    const results = await Promise.all(
      [0, 1, 2, 3].map(() => json("/api/teacher/payouts", user, "POST", { amount: 60, iban: IBAN, accountName: "Ayşe Yılmaz" }))
    )
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    const bal = await (await api("/api/teacher/payouts", user)).json()
    expect(bal.claimed).toBe(60)
  })

  it("admin approve → paid; only admins can act; bad transitions are 409", async () => {
    const { user } = await teacherWithEarnings([100])
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    const { request } = await (await json("/api/teacher/payouts", user, "POST", { amount: 40, iban: IBAN, accountName: "Ayşe Yılmaz" })).json()

    // permissions
    expect((await json(`/api/admin/payouts/${request.id}`, user, "PATCH", { action: "approve" })).status).toBe(401)
    expect((await json(`/api/admin/payouts/${request.id}`, student, "PATCH", { action: "approve" })).status).toBe(401)
    expect((await api("/api/admin/payouts", user)).status).toBe(401)

    // cannot mark paid before approval
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "mark_paid" })).status).toBe(409)
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "approve" })).status).toBe(200)
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "approve" })).status).toBe(409)
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "mark_paid" })).status).toBe(200)
    expect((await json(`/api/admin/payouts/${request.id}`, admin, "PATCH", { action: "reject", note: "x" })).status).toBe(409)

    const list = await (await api("/api/admin/payouts?status=PAID", admin)).json()
    const row = list.requests.find((r: any) => r.id === request.id)
    expect(row.paidAt).toBeTruthy()
    expect(row.iban).toBe("TR330006100519786457841326")

    // paid money stays claimed
    expect((await (await api("/api/teacher/payouts", user)).json()).available).toBe(45)

    // audit trail
    const logs = await db.auditLog.findMany({ where: { targetId: request.id } })
    expect(logs.map((l) => l.action).sort()).toEqual(["PAYOUT_APPROVE", "PAYOUT_MARK_PAID"])
  })

  it("students cannot request payouts", async () => {
    const student = await makeUser("STUDENT")
    expect((await json("/api/teacher/payouts", student, "POST", { amount: 20, iban: IBAN, accountName: "Ayşe Yılmaz" })).status).toBe(403)
    expect((await api("/api/teacher/payouts", null)).status).toBe(401)
  })
})
