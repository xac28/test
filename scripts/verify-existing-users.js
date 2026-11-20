// Run once before switching REQUIRE_EMAIL_VERIFICATION=true on a site that already has members:
// marks every existing account as verified so nobody is locked out. New sign-ups still have to verify.
//   node scripts/verify-existing-users.js
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
prisma.user
  .updateMany({ where: { emailVerified: null, deletedAt: null }, data: { emailVerified: new Date() } })
  .then((r) => console.log(`${r.count} account(s) marked as verified`))
  .finally(() => prisma.$disconnect())
