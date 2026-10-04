/**
 * Demo content for local development — NOT for production.
 *   npm run seed:demo
 * Creates (idempotently): an admin, two teachers, a student, workshops and articles.
 * All accounts use the password "Passw0rd!".
 */
const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

try {
  for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

const db = new PrismaClient()
const TERMS_VERSION = "2026-10"
const hours = (h) => new Date(Date.now() + h * 3_600_000)

async function user(email, name, role, extra = {}) {
  const password = await bcrypt.hash("Passw0rd!", 10)
  return db.user.upsert({
    where: { email },
    update: { role, name },
    create: {
      email, name, role, password, profileCompleted: true,
      termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, ...extra,
    },
  })
}

async function teacher(u, bio, specialties) {
  return db.teacher.upsert({
    where: { userId: u.id },
    update: {},
    create: { userId: u.id, bio, hourlyRate: 40, isTrialMode: false, specialties: JSON.stringify(specialties) },
  })
}

const WORKSHOPS = (t1, t2) => [
  {
    slug: "demo-sabah-yogasi-gunese-selam", title: "Sabah Yogası: Güneşe Selam", category: "Hatha", level: "Başlangıç", mode: "LIVE",
    subtitle: "Güne yumuşak bir başlangıç: nefes, esneme ve kısa bir meditasyon.",
    description: "Bu atölyede Güneşe Selam dizisini adım adım öğreneceğiz. Her pozun bedende ne yaptığını, nefesle nasıl birleştiğini ve evde güvenle nasıl tekrarlanacağını konuşacağız.\n\nYanınıza bir mat, bir bardak su ve rahat bir kıyafet alın. Önceden yoga deneyimi gerekmez.",
    startsAt: hours(30), durationMin: 75, priceUsd: 0, capacity: 25, teacherId: t1.id,
  },
  {
    slug: "demo-yin-yoga-derin-gevseme", title: "Yin Yoga: Derin Gevşeme Akşamı", category: "Yin", level: "Tüm seviyeler", mode: "LIVE",
    subtitle: "Uzun tutuşlar, yavaş nefes, sakin bir sinir sistemi.",
    description: "Yin yoga, bağ dokuyu ve zihni yavaşlatmaya odaklanır. Bu akşam atölyesinde altı pozu üçer dakika tutacak, aralarda nefes farkındalığı çalışacağız.\n\nBolster ya da birkaç yastık işinize yarayacak.",
    startsAt: hours(80), durationMin: 90, priceUsd: 15, capacity: 12, teacherId: t2.id,
  },
  {
    slug: "demo-nefes-calismasi-temelleri", title: "Nefes Çalışmasının Temelleri", category: "Nefes", level: "Başlangıç", mode: "RECORDED",
    subtitle: "Kutu nefesi, 4-7-8 ve alternatif burun nefesi — kayıtlı seri.",
    description: "Üç temel nefes tekniğini, ne zaman ve nasıl uygulanacağıyla birlikte öğreten kayıtlı bir atölye. Her teknik için kısa bir teori, ardından rehberli bir uygulama var.\n\nVideoyu istediğiniz zaman, istediğiniz kadar izleyebilirsiniz.",
    videoUrl: "https://cdn.example.com/demo/nefes.mp4", durationMin: 48, priceUsd: 9, capacity: 500, teacherId: t1.id,
  },
  {
    slug: "demo-yoga-nidra-uyku", title: "Yoga Nidra: Uykudan Önce Rehberli Yolculuk", category: "Yoga Nidra", level: "Tüm seviyeler", mode: "LIVE",
    subtitle: "Yatakta yapabileceğiniz, 40 dakikalık rehberli gevşeme.",
    description: "Yoga Nidra, uyku ile uyanıklık arasındaki eşikte yapılan rehberli bir gevşeme pratiğidir. Atölye boyunca yalnızca dinleyeceksiniz; hareket gerekmiyor.\n\nİsterseniz yatağınızdan katılabilirsiniz.",
    startsAt: hours(120), durationMin: 45, priceUsd: 0, capacity: 40, teacherId: t2.id,
  },
]

const ARTICLES = (authorId) => [
  {
    slug: "demo-nefesin-sessiz-gucu", title: "Nefesin Sessiz Gücü", category: "Nefes",
    excerpt: "Yavaş ve derin nefes, sinir sistemini nasıl sakinleştirir? Bilimin ve yoganın ortak noktasına kısa bir bakış.",
    body: "Nefes, hem otomatik hem de bilinçle yönlendirilebilen nadir işlevlerden biridir. Bu iki yönlülük onu bedenle zihin arasında bir köprü yapar.\n\n## Neden yavaş nefes?\n\nUzun bir nefes verişi, parasempatik sinir sistemini devreye sokar: kalp atışı yavaşlar, kaslar gevşer, zihin sakinleşir. Bu yüzden yogada nefes, pozlar kadar önemlidir.\n\n> Nefesi yönetebilen, dikkatini de yönetebilir.\n\n## Üç basit başlangıç\n\n- Kutu nefesi: dört say al, dört say tut, dört say ver, dört say tut.\n- 4-7-8: dört say al, yedi say tut, sekiz say ver.\n- Alternatif burun nefesi: sağ ve sol burun deliklerini sırayla kullan.\n\n### Ne kadar süre?\n\nGünde beş dakika bile fark yaratır. Önemli olan düzenli olmak; uzun seanslara sonra geçersiniz.\n\nBu pratikleri bir eğitmenle birlikte öğrenmek, özellikle tutuş içeren tekniklerde güvenlidir.",
  },
  {
    slug: "demo-evde-yoga-icin-bes-ipucu", title: "Evde Yoga İçin Beş İpucu", category: "Yoga",
    excerpt: "Evde düzenli bir pratik kurmanın sırrı; büyük hedefler değil, küçük ve tekrarlanabilir alışkanlıklar.",
    body: "Evde yoga yapmak özgürleştirici, ama ilk haftalardan sonra motivasyon düşebiliyor. İşte işe yarayan beş küçük alışkanlık.\n\n## 1. Matı açık bırakın\n\nMat katlı dolapta durursa pratik yapma ihtimaliniz azalır. Odanın bir köşesinde açık kalsın.\n\n## 2. Süreyi küçük tutun\n\nOn dakikalık bir pratik, yapılmayan kırk beş dakikalık pratikten iyidir.\n\n## 3. Aynı saati seçin\n\nBeyin, saatle alışkanlık kurar. Sabah kahveden önce ya da akşam yemekten sonra.\n\n## 4. Bir eğitmenle başlayın\n\nYanlış hizalanmış bir pozu yüz kez tekrarlamak yerine, birkaç canlı ders alıp temeli sağlam atın.\n\n## 5. İlerlemeyi not edin\n\nTakvimde işaretlenen her gün, bir sonraki gün için küçük bir söz olur.",
  },
  {
    slug: "demo-meditasyon-baslangic", title: "Meditasyona Nereden Başlanır?", category: "Meditasyon",
    excerpt: "Zihnini susturmak zorunda değilsin. Meditasyonun ilk dersi, düşüncelerin gelip geçmesine izin vermek.",
    body: "Meditasyona yeni başlayanların en sık yanlış anladığı şey, hedefin düşüncesiz kalmak olduğudur. Oysa hedef, düşünceleri fark etmek ve onlara kapılmamaktır.\n\n## İlk beş dakika\n\nSırtınız dik ama rahat oturun. Gözlerinizi kapatın ve nefesinizin burun deliklerinizden girip çıkışını izleyin. Zihin dağıldığında, bunu fark edin ve nazikçe nefese dönün.\n\n> Dönmek, meditasyonun kendisidir.\n\n## Sık sorulanlar\n\n- Hiç düşünmeden durabilir miyim? Pek mümkün değil; ve gerek de yok.\n- Ne kadar sürmeli? Beş dakika ile başlayın.\n- Sabah mı akşam mı? Size uyan zaman.\n\nRehberli meditasyonlar, ilk haftalarda yol gösterici olur.",
  },
]

async function main() {
  const admin = await user("admin@aya.test", "AYA Yönetici", "ADMIN")
  const u1 = await user("elif@aya.test", "Elif Demir", "TEACHER")
  const u2 = await user("mert@aya.test", "Mert Kaya", "TEACHER")
  await user("ayse@aya.test", "Ayşe Yıldız", "STUDENT")
  const t1 = await teacher(u1, "Hatha ve nefes çalışması üzerine 8 yıllık deneyim.", ["Hatha", "Nefes", "Meditasyon"])
  const t2 = await teacher(u2, "Yin yoga ve yoga nidra eğitmeni.", ["Yin", "Yoga Nidra", "Restoratif"])

  for (const w of WORKSHOPS(t1, t2)) {
    await db.workshop.upsert({ where: { slug: w.slug }, update: { startsAt: w.startsAt ?? null }, create: w })
  }
  for (const a of ARTICLES(admin.id)) {
    await db.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: { ...a, authorId: admin.id, status: "PUBLISHED", publishedAt: new Date() },
    })
  }
  console.log("Demo content ready. Logins (password Passw0rd!): admin@aya.test, elif@aya.test, mert@aya.test, ayse@aya.test")
}

main().finally(() => db.$disconnect())
