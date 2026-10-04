import { PrismaClient } from "@prisma/client"
import crypto from "crypto"
import bcrypt from "bcryptjs"

export const BASE = process.env.AYA_TEST_URL || "http://localhost:3000"
export const db = new PrismaClient()

const tag = () => crypto.randomBytes(4).toString("hex")

export interface TestUser {
  id: string
  email: string
  token: string
  role: string
  password: string
}

/** Creates a user + a mobile Bearer session directly in the DB (no UI, no rate limits). */
export async function makeUser(
  role: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT",
  opts: { terms?: boolean } = {}
): Promise<TestUser> {
  const password = "Passw0rd!"
  const email = `t-${tag()}@aya.test`
  const { CURRENT_TERMS_VERSION } = await import("../../src/lib/terms")
  const user = await db.user.create({
    data: {
      name: `Test ${role} ${tag()}`,
      email,
      password: await bcrypt.hash(password, 4),
      role,
      profileCompleted: true,
      ...(opts.terms === false ? {} : { termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION }),
    },
  })
  const token = crypto.randomBytes(48).toString("hex")
  await db.session.create({
    data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 3_600_000) },
  })
  return { id: user.id, email, token, role, password }
}

export async function makeTeacher(opts: { terms?: boolean } = {}) {
  const user = await makeUser("TEACHER", opts)
  const teacher = await db.teacher.create({
    data: { userId: user.id, bio: "t", hourlyRate: 40, isTrialMode: false },
  })
  return { user, teacher }
}

export async function makeBooking(
  teacherId: string,
  studentId: string,
  status: "CONFIRMED" | "COMPLETED" | "PENDING" = "CONFIRMED",
  price = 40
) {
  const start = new Date(Date.now() + 3_600_000)
  return db.booking.create({
    data: { teacherId, studentId, startTime: start, endTime: new Date(start.getTime() + 3_600_000), status, price },
  })
}

export function api(path: string, user?: { token: string } | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (user) headers.set("Authorization", `Bearer ${user.token}`)
  return fetch(`${BASE}${path}`, { ...init, headers })
}

export function json(path: string, user: { token: string } | null, method: string, body: unknown) {
  return api(path, user, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
