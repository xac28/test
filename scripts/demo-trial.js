/** Windows quick start: makes the demo teacher "Mert" a trial-phase teacher so the supervised-broadcast flow can be tried. */
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")
try {
  for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}
const db = new PrismaClient()
db.teacher
  .updateMany({ where: { user: { email: "mert@aya.test" } }, data: { isTrialMode: true } })
  .then((r) => console.log(`Deneme öğretmeni: ${r.count} kayıt güncellendi (mert@aya.test)`))
  .catch((e) => { console.error(e.message); process.exitCode = 1 })
  .finally(() => db.$disconnect())
