/** Yoga styles explained for newcomers (original text). */
export interface YogaStyle {
  slug: string
  name: string
  tagline: string
  /** pose used as the cover picture */
  cover: string
  /** card gradient */
  tone: "peach" | "mint" | "lilac" | "sun" | "rose" | "sky"
  intensity: 1 | 2 | 3 | 4 | 5
  pace: string
  level: string
  duration: string
  intro: string
  forYou: string[]
  expect: string[]
  benefits: string[]
  session: { time: string; part: string }[]
  gear: string[]
  poses: string[]
  faq: { q: string; a: string }[]
  /** AYA workshop category / teacher specialty keyword */
  category: string
}

export const STYLES: YogaStyle[] = [
  {
    slug: "hatha", name: "Hatha", tagline: "Temelleri sakince öğrenmek isteyenler için yavaş ve hizalı pratik.", cover: "savasci-2", tone: "peach", intensity: 2, pace: "Yavaş, duruşlar uzun tutulur", level: "Başlangıç – Orta", duration: "45–75 dk",
    intro: "Hatha, çoğu stilin atasıdır. Duruşlar birer birer, bol açıklamayla ve uzun nefeslerle yapılır; böylece bedenini, nefesini ve sınırlarını tanımak için tam zaman olur. Yoga'ya yeni başlıyorsan en güvenli kapıdır.",
    forYou: ["Yoga'ya ilk kez başlayanlar", "Sakin bir tempoda güçlenmek ve esnemek isteyenler", "Duruş ve hizalamayı doğru öğrenmek isteyenler", "Yaralanma sonrası nazikçe dönenler (doktor onayıyla)"],
    expect: ["Ayakta ve yerde sırayla duruşlar", "Her duruşta 5–8 nefes bekleme", "Nefes çalışması ve kısa meditasyonla açılış/kapanış", "Eğitmenin net yönlendirmesi ve alternatifler"],
    benefits: ["Esnekliği ve dengeyi artırır", "Kasları nazikçe güçlendirir", "Stresi azaltır, odaklanmayı artırır", "Doğru duruş alışkanlığı kazandırır"],
    session: [{ time: "0–10 dk", part: "Karşılama, nefes ve ısınma" }, { time: "10–40 dk", part: "Ayakta ve yerde duruşlar" }, { time: "40–55 dk", part: "Esneme ve denge" }, { time: "55–70 dk", part: "Savasana ve kapanış" }],
    gear: ["Kaymaz yoga matı", "Rahat, esnek kıyafet", "İsteğe bağlı: blok ve kemer"],
    poses: ["dag-durusu", "savasci-1", "savasci-2", "agac", "ucgen", "savasana"],
    faq: [{ q: "Hiç esnek değilim, başlayabilir miyim?", a: "Evet. Yoga esnek olanlara değil, esnekliği geliştirmek isteyenlere göredir. Hatha'da her duruşun kolaylaştırılmış bir hali vardır." }, { q: "Haftada kaç gün yapmalıyım?", a: "Haftada 2–3 seans, birkaç haftada fark yaratır. Düzenli olmak yoğun olmaktan önemlidir." }],
    category: "Hatha",
  },
  {
    slug: "vinyasa", name: "Vinyasa", tagline: "Nefesle akan, ısıtan ve enerji veren dinamik seriler.", cover: "savasci-1", tone: "sun", intensity: 4, pace: "Akıcı, her harekete bir nefes", level: "Orta", duration: "45–60 dk",
    intro: "Vinyasa'da duruşlar nefesle birbirine bağlanır; bir hareket diğerine akar. Kalbi hızlandırır, bedeni ısıtır ve zihni hareketin ritmine bağlar. Her ders farklı olduğu için sıkılmaz.",
    forYou: ["Hareketli, terleten bir pratik isteyenler", "Hatha'yı öğrenip tempoyu artırmak isteyenler", "Kardiyo ve esnekliği birleştirmek isteyenler", "Sabah enerji arayanlar"],
    expect: ["Güneşe Selam serileri ve geçişler", "Nefesle eşleşen akış", "Isınan beden, terleme", "Eğitmene göre değişen yaratıcı sıralamalar"],
    benefits: ["Kalp-damar dayanıklılığını artırır", "Güç ve esnekliği birlikte geliştirir", "Enerji verir, zihni canlandırır", "Nefes-hareket uyumunu güçlendirir"],
    session: [{ time: "0–8 dk", part: "Isınma ve merkezlenme" }, { time: "8–20 dk", part: "Güneşe Selam seri" }, { time: "20–45 dk", part: "Ayakta akışlar ve denge" }, { time: "45–60 dk", part: "Soğuma, esneme ve Savasana" }],
    gear: ["Kaymaz mat (ter için)", "Havlu ve su", "Terlemeye uygun kıyafet"],
    poses: ["ayakta-yukari-uzanis", "savasci-1", "savasci-2", "asagi-bakan-kopek", "sandalye", "kopru"],
    faq: [{ q: "Hatha ile farkı ne?", a: "Hatha'da duruşlar ayrı ayrı ve uzun tutulur; Vinyasa'da duruşlar nefesle akıcı biçimde birbirine bağlanır ve tempo daha yüksektir." }, { q: "Başlangıç için uygun mu?", a: "Temel duruşları biliyorsan evet. Tamamen yeniyseniz önce birkaç Hatha dersi iyi bir temel olur." }],
    category: "Vinyasa",
  },
  {
    slug: "yin", name: "Yin", tagline: "Derin dokuları açan, pasif ve uzun süreli esneme.", cover: "cocuk", tone: "lilac", intensity: 1, pace: "Çok yavaş, her duruşta 2–5 dakika", level: "Her seviye", duration: "60–75 dk",
    intro: "Yin, kasları değil bağ dokuyu ve eklemleri hedefler. Duruşlarda dakikalarca kalır, kasları gevşetir ve yerçekimine bırakırsın. Hareketli bir yaşamın dengeleyicisi, zihin için ise bir sessizlik pratiğidir.",
    forYou: ["Kalça ve bel gerginliği çekenler", "Yoğun spor yapanlar (dengeleyici olarak)", "Stresli, yorgun ve uykusuzlar", "Sakin ve içe dönük pratik arayanlar"],
    expect: ["Çoğunlukla yerde, destekli duruşlar", "Bloklar, yastıklar ve battaniyeler", "Uzun beklemeler, sessizlik", "Hafif rahatsızlık olur; keskin ağrı olmaz"],
    benefits: ["Kalça, bel ve bacak esnekliğini artırır", "Eklem hareketliliğini destekler", "Sinir sistemini yatıştırır", "Sabrı ve içsel farkındalığı geliştirir"],
    session: [{ time: "0–5 dk", part: "Yerleşme ve nefes" }, { time: "5–55 dk", part: "6–8 uzun duruş (2–5 dk)" }, { time: "55–70 dk", part: "Savasana ve kapanış" }],
    gear: ["Mat", "Battaniye ve yastık / bolster", "Çorap ve sıcak bir üst"],
    poses: ["cocuk", "kolay-oturus", "malasana", "sfenks", "savasana"],
    faq: [{ q: "Hiç hareket yok mu?", a: "Az hareket var; amaç beklemek. Yin'in gücü hareketsizlikte, rahatsızlığa nefesle kalabilmektedir." }, { q: "Vinyasa'yla birlikte yapılır mı?", a: "Evet, çoğu kişi haftada bir Yin ile Vinyasa'yı dengeler." }],
    category: "Yin",
  },
  {
    slug: "ashtanga", name: "Ashtanga", tagline: "Sabit sıralı, güçlü ve disiplinli geleneksel seri.", cover: "kayik", tone: "rose", intensity: 5, pace: "Sabit sıra, nefesle sürekli akış", level: "Orta – İleri", duration: "60–90 dk",
    intro: "Ashtanga her seferinde aynı sırayı izler; bu tekrar, ilerlemeyi ölçmeyi ve zihni sadeleştirmeyi sağlar. Güç, dayanıklılık ve disiplin ister. Deneyimli eğitmen eşliğinde adım adım öğrenilir.",
    forYou: ["Düzenli ve yapılandırılmış pratik sevenler", "Güçlenmek ve disiplin kazanmak isteyenler", "Vinyasa'dan ilerlemek isteyenler"],
    expect: ["Sabit duruş sırası", "Uzun, ritmik nefes ve bakış noktaları", "Yoğun terleme ve kuvvet", "Öğrenmede yavaş ilerleme"],
    benefits: ["Güç, dayanıklılık ve esnekliği birlikte artırır", "Odağı ve iradeyi geliştirir", "Kardiyo etkisi yüksektir", "Ritüel ve düzen duygusu verir"],
    session: [{ time: "0–5 dk", part: "Açılış ve nefes" }, { time: "5–20 dk", part: "Güneşe Selam A ve B" }, { time: "20–60 dk", part: "Ayakta ve oturarak seri" }, { time: "60–90 dk", part: "Kapanış serisi ve dinlenme" }],
    gear: ["Kaymaz mat", "Havlu", "Su"],
    poses: ["ayakta-yukari-uzanis", "asagi-bakan-kopek", "savasci-2", "kayik", "deve"],
    faq: [{ q: "Çok zor mu?", a: "Yoğun bir stildir ama doğru eğitmenle kademeli öğrenilir; ilk haftalarda sıranın yalnızca başı yapılır." }, { q: "Her gün yapmalı mıyım?", a: "Geleneksel olarak haftada 5–6 gün önerilir ama başlangıçta haftada 2–3 gün yeterlidir." }],
    category: "Vinyasa",
  },
  {
    slug: "restoratif", name: "Restoratif", tagline: "Destekli duruşlarla tam dinlenme: bedenin onarılma modu.", cover: "savasana", tone: "mint", intensity: 1, pace: "Çok yavaş, tamamen destekli", level: "Her seviye", duration: "60 dk",
    intro: "Restoratif yoga, bolster, battaniye ve bloklarla bedeni tamamen destekleyerek derin gevşeme sağlar. Zorlanmak yok; amaç sinir sistemini “dinlen ve sindir” moduna almak. Yorgunluk, tükenmişlik ve uykusuzlukta iyi gelir.",
    forYou: ["Yorgun, tükenmiş ve stresli olanlar", "Uyku sorunu yaşayanlar", "Hastalık ya da yoğun dönem sonrası toparlananlar", "Yoğun spor yapanlar"],
    expect: ["4–6 destekli duruş", "Her duruşta 5–10 dakika", "Düşük ışık, sakin müzik ve rehberli gevşeme", "Neredeyse hiç kas çalışması"],
    benefits: ["Derin gevşeme, daha iyi uyku", "Stres hormonlarının düşmesine yardım eder", "Yorgun kasları dinlendirir", "Nefesi ve sinir sistemini dengeler"],
    session: [{ time: "0–10 dk", part: "Yerleşme ve nefes" }, { time: "10–50 dk", part: "Destekli duruşlar" }, { time: "50–60 dk", part: "Uzun Savasana" }],
    gear: ["Mat, battaniye, yastıklar ya da bolster", "Sıcak tutacak örtü", "Göz örtüsü (isteğe bağlı)"],
    poses: ["savasana", "cocuk", "kopru", "kolay-oturus"],
    faq: [{ q: "Gerçekten bir şey yapmıyor muyum?", a: "Evet, yapmamak burada pratiktir. Beden dinlenirken sinir sistemi toparlanır." }],
    category: "Restoratif",
  },
  {
    slug: "meditasyon", name: "Meditasyon ve Nefes", tagline: "Zihni sakinleştiren, odak ve farkındalık kazandıran sessiz pratik.", cover: "kolay-oturus", tone: "sky", intensity: 1, pace: "Sessiz ve içe dönük", level: "Her seviye", duration: "15–45 dk",
    intro: "Meditasyon ve nefes çalışmaları (pranayama) yoganın zihinsel yüzüdür. Kısa seanslarla bile günlük stresi azaltır, odağı artırır ve duyguları tanımayı kolaylaştırır. Oturabildiğin her yerde yapılabilir.",
    forYou: ["Stres, kaygı ve zihinsel yorgunluk yaşayanlar", "Daha iyi uyumak isteyenler", "Odaklanmayı geliştirmek isteyenler", "Bedensel yogaya ek olarak içsel pratik arayanlar"],
    expect: ["Rahat oturuş ya da uzanma", "Rehberli nefes ve dikkat çalışmaları", "Kısa sessiz bekleyişler", "Her seviyeye uygun, zorlamasız yönlendirme"],
    benefits: ["Stresi ve kaygıyı azaltır", "Dikkat ve odağı güçlendirir", "Duygusal dengeyi destekler", "Uykuya geçişi kolaylaştırır"],
    session: [{ time: "0–5 dk", part: "Oturuş ve nefese varma" }, { time: "5–25 dk", part: "Rehberli nefes ve farkındalık" }, { time: "25–30 dk", part: "Sessizlik ve kapanış" }],
    gear: ["Yastık ya da battaniye", "Sessiz bir köşe", "Rahat kıyafet"],
    poses: ["kolay-oturus", "savasana", "dag-durusu"],
    faq: [{ q: "Zihnimi susturamıyorum, yanlış mı yapıyorum?", a: "Hayır. Meditasyon düşünceleri durdurmak değil, fark edip nazikçe nefese dönmektir. Dağılmak sürecin kendisidir." }, { q: "Günde kaç dakika yeter?", a: "Günde 5–10 dakikayla başla; düzenlilik süreden önemlidir." }],
    category: "Meditasyon",
  },
]
export const STYLE_BY_SLUG: Record<string, YogaStyle> = Object.fromEntries(STYLES.map((s) => [s.slug, s]))
export const TONE_CLASS: Record<YogaStyle["tone"], string> = {
  peach: "from-clay-100 to-saffron-100", mint: "from-teal-50 to-teal-100", lilac: "from-lilac-100 to-lotus-100", sun: "from-saffron-100 to-clay-100", rose: "from-lotus-100 to-clay-100", sky: "from-teal-100 to-lilac-100",
}
