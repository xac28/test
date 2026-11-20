#!/usr/bin/env node
/**
 * Removes what the automated tests leave behind in a LOCAL database: accounts on the reserved test domain
 * (…@aya.test, e.g. "Test TEACHER 0272e2b3") and everything they own — workshops ("Sabah Yogası c946"),
 * articles ("E2E Yazısı …"), posts, live rooms, bookings … (all cascade from the user) — plus their
 * memberships, taught AI answers, newsletter sign-ups and shop orders.
 *
 *   node scripts/clean-test-data.js                  # dry run: shows what would go
 *   node scripts/clean-test-data.js --yes            # delete
 *   node scripts/clean-test-data.js --yes --with-deleted   # also the anonymised "Silinmiş kullanıcı" rows
 *
 * The demo accounts (scripts/seed-demo.js) are kept; add more with KEEP_EMAILS="a@aya.test,b@aya.test".
 * Refuses to run against anything but a database on this machine. Run `npm run seed:demo` afterwards to
 * put the demo content back to how it was.
 */
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

if (!process.env.DATABASE_URL && fs.existsSync(path.join(process.cwd(), ".env"))) {
  for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const args = new Set(process.argv.slice(2))
const apply = args.has("--yes")
const withDeleted = args.has("--with-deleted")

const url = process.env.DATABASE_URL || ""
let host = ""
try { host = new URL(url).hostname } catch {}
if (!/^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(host) || process.env.NODE_ENV === "production") {
  console.error(`Refusing: this only cleans a local test database (DATABASE_URL host is "${host || "?"}").`)
  process.exit(1)
}

const KEEP = new Set(["admin@aya.test", "elif@aya.test", "mert@aya.test", "ayse@aya.test", "canli.ogrenci@aya.test",
  ...(process.env.KEEP_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)])

const db = new PrismaClient()

async function main() {
  const where = {
    OR: [{ email: { endsWith: "@aya.test" } }, ...(withDeleted ? [{ email: { endsWith: "@aya.invalid" } }] : [])],
    NOT: { email: { in: [...KEEP] } },
  }
  const users = await db.user.findMany({ where, select: { id: true } })
  const ids = users.map((u) => u.id)
  const teacherIds = (await db.teacher.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((t) => t.id)
  const counts = {
    users: ids.length,
    workshops: await db.workshop.count({ where: { teacherId: { in: teacherIds } } }),
    articles: await db.article.count({ where: { authorId: { in: ids } } }),
    posts: await db.post.count({ where: { authorId: { in: ids } } }),
    liveRooms: await db.liveRoom.count({ where: { teacherId: { in: teacherIds } } }),
    subscriptions: await db.subscription.count({ where: { userId: { in: ids } } }),
    taughtAnswers: await db.aiTaughtAnswer.count({ where: { createdById: { in: ids } } }),
    newsletter: await db.newsletterSubscriber.count({ where: { email: { endsWith: "@aya.test" } } }),
    orders: await db.order.count({ where: { email: { endsWith: "@aya.test" } } }),
  }
  console.log(apply ? "Deleting:" : "Would delete (dry run, add --yes):", counts)
  if (!apply || !ids.length && !counts.newsletter && !counts.orders) return

  // rows that point at a user without a foreign key go first
  await db.subscriptionPass.deleteMany({ where: { userId: { in: ids } } })
  await db.subscription.deleteMany({ where: { userId: { in: ids } } })
  await db.aiTaughtAnswer.deleteMany({ where: { createdById: { in: ids } } })
  await db.order.deleteMany({ where: { email: { endsWith: "@aya.test" } } })
  await db.newsletterSubscriber.deleteMany({ where: { email: { endsWith: "@aya.test" } } })
  // users in batches: everything they own goes with them (onDelete: Cascade)
  for (let i = 0; i < ids.length; i += 200) {
    await db.user.deleteMany({ where: { id: { in: ids.slice(i, i + 200) } } })
  }
  console.log("Done. Run `npm run seed:demo` to restore the demo content.")
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => db.$disconnect())
