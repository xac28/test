const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst({ where: { email: 'xacsoftware@gmail.com' } })
  .then(u => console.log(u))
  .finally(() => prisma.$disconnect());
