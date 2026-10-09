/** What the guide knows about needs: which style fits which goal or body area, what to say, what to be careful about. */
import { StyleId } from "@/lib/ai-guide"
import { YogaPose, PoseCategory } from "@/lib/yoga-poses"
import { Area, Condition, Goal, Level } from "./lexicon"

export const GOAL_STYLES: Record<Goal, StyleId[]> = {
  sleep: ["restorative", "yin", "meditation"],
  stress: ["meditation", "yin", "hatha"],
  energy: ["vinyasa", "hatha"],
  flexibility: ["yin", "hatha"],
  strength: ["ashtanga", "vinyasa"],
  balance: ["hatha"],
  weight: ["vinyasa", "ashtanga"],
  focus: ["meditation", "hatha"],
  relax: ["restorative", "yin", "meditation"],
  posture: ["hatha", "yin"],
  pregnancy: ["restorative", "hatha"],
  seniors: ["hatha", "restorative"],
  kids: ["hatha", "vinyasa"],
  breath: ["meditation"],
  pain: ["restorative", "hatha"],
  mood: ["meditation", "vinyasa"],
  digestion: ["hatha", "yin"],
}

export const AREA_STYLES: Record<Area, StyleId[]> = {
  back_low: ["restorative", "hatha"],
  back: ["yin", "hatha"],
  neck: ["restorative", "yin"],
  shoulder: ["hatha", "yin"],
  hip: ["yin", "hatha"],
  knee: ["restorative", "hatha"],
  wrist: ["hatha"],
  foot: ["hatha"],
  head: ["restorative", "meditation"],
  belly: ["hatha", "yin"],
  eyes: ["meditation"],
  legs: ["yin", "hatha"],
  chest: ["hatha", "meditation"],
}

/** With these the guide only suggests gentle styles. */
export const GENTLE_CONDITIONS: Condition[] = ["pregnancy", "injury", "pressure", "heart", "osteoporosis", "surgery", "back", "knee", "neck", "shoulder", "wrist"]

export const STYLE_SLUG: Record<StyleId, string> = { hatha: "hatha", vinyasa: "vinyasa", yin: "yin", meditation: "meditasyon", ashtanga: "ashtanga", restorative: "restoratif" }

/** Words that signal a condition inside a pose's "avoid" texts. */
export const CONDITION_WORDS: Record<Condition, string[]> = {
  pregnancy: ["hamile"], knee: ["diz"], wrist: ["bilek"], neck: ["boyun"], back: ["bel ", "sirt", "omurga", "fitik", "disk"], pressure: ["tansiyon"], heart: ["kalp"],
  shoulder: ["omuz"], osteoporosis: ["kemik", "osteopor"], glaucoma: ["goz tansiyon", "glokom", "goz "], period: ["adet", "regl"], surgery: ["ameliyat"], injury: ["sakat", "yaralan"],
}

export const CONDITION_ADVICE: Record<Condition, string> = {
  pregnancy: "Hamilelikte pratiğe başlamadan önce doktoruna danış; mümkünse hamilelik yogası bilen bir eğitmenle çalış ve sırtüstü uzun yatmaktan, derin burgulardan kaçın.",
  knee: "Dizinde sorun varsa dizi derin bükmeden, ağrı hissettiğin yerde dur; kalın katlanmış battaniye ya da blok destek olur.",
  wrist: "Bileğin hassassa ağırlığı kollara vermeden, yumruk ya da önkol üzerinde çalışan seçenekleri tercih et.",
  neck: "Boynunu geriye kırmadan, çenen hafif içeride, yavaş hareket et; ağrı artarsa bırak.",
  back: "Bel ya da sırt rahatsızlığında (fıtık, skolyoz, disk) önce doktorun onayını al; öne eğilmeleri dizler hafif bükükken, burgu ve geriye eğilmeleri ise çok nazik yap.",
  pressure: "Tansiyon sorununda ters duruşlardan (baş aşağı) ve nefes tutmaktan kaçın; ayağa kalkarken yavaş ol.",
  heart: "Kalp rahatsızlığında yoga programına başlamadan önce mutlaka doktoruna danış; yorucu akışlar ve nefes tutmalar yerine yumuşak pratik seç.",
  injury: "Yeni ya da iyileşmekte olan bir sakatlıkta doktor/fizyoterapist onayı olmadan pratik yapma; ağrı veren hareketi bırak.",
  shoulder: "Omuzda sıkışma ya da donukluk varsa kollarını yalnızca ağrısız aralıkta kaldır, yük bindirme.",
  osteoporosis: "Kemik erimesinde öne eğilme ve burgu derin olmasın; omurgayı yuvarlamadan, düz tutarak çalış ve doktoruna danış.",
  glaucoma: "Göz tansiyonu varsa ters (baş aşağı) duruşlardan uzak dur ve doktoruna danış.",
  period: "Adet döneminde ters duruşlar yerine yumuşak, dinlendirici pratik çoğu kişiye iyi gelir; bedenini dinle.",
  surgery: "Ameliyat sonrasında doktorun izin verdiği zamandan önce pratik yapma; başlarken çok nazik ve kısa tut.",
}

// ───────── how to talk about a need ─────────

export const GOAL_LEAD: Record<Goal, string[]> = {
  sleep: ["Uyku düzeni için akşamları yavaşlayan bir pratik çok işe yarar.", "Uykuya geçmekte zorlanıyorsan beden ve zihni gece için yavaşlatan, uzun nefesli çalışmalar iyi gelir."],
  stress: ["Stres ve gerginlikte en hızlı yol nefes; düzenli yavaş pratik de sinir sistemini gerçekten yatıştırır.", "Gerginliğin üzerine gitmek yerine nefesle yumuşatmak çoğu kişide daha iyi sonuç veriyor."],
  energy: ["Enerjin düşükse hafif tempolu, nefesle akan bir pratik seni uyandırır.", "Yorgunlukta zorlayıcı değil, canlandırıcı bir tempo iyi gelir."],
  flexibility: ["Esnekliği artırmanın sırrı düzenlilik: haftada birkaç kez, uzun süre tutulan esnemeler en etkili yol.", "Esneme hedefinde acele etmeden, nefes verirken derinleşmek en güvenlisi."],
  strength: ["Güç hedefinde ayakta duruşlar ve akışlar kasları dengeli çalıştırır.", "Kas gücü için düzenli, kontrollü ve hizalı bir pratik hem güç hem denge kazandırır."],
  balance: ["Denge, tek ayak üstünde sabit bir bakış noktası ve yavaş nefesle çok hızlı gelişir.", "Dengeyi geliştirmek için duvar yanında başlayıp zamanla desteği azaltmak güzel bir yol."],
  weight: ["Form ve kondisyon için akışlı (vinyasa) ve güçlü stiller kalori yakarken kasları da çalıştırır; yanında düzenli uyku ve beslenme belirleyici.", "Yoga tek başına mucize değil ama düzenli akışlar hem kondisyon hem beden farkındalığı kazandırır."],
  focus: ["Odaklanmak için kısa ama düzenli meditasyon ve tek noktaya dikkat çalışmaları en iyi yatırım.", "Dağınık dikkat için nefes sayma ve yavaş, bilinçli duruşlar harika bir antrenman."],
  relax: ["Gevşemek için yavaş, destekli ve uzun nefesli çalışmalar tam yerinde.", "Rahatlamak istiyorsan bedeni zorlamayan, uzun tutulan duruşlar çok iyi gelir."],
  posture: ["Duruş sorunlarında göğüs ve kalça önünü açıp sırt kaslarını güçlendiren çalışmalar fark yaratır; masa başında kısa molalar da şart.", "Duruşu düzeltmek için omuz, göğüs ve karın-sırt dengesine çalışmak gerekir."],
  pregnancy: ["Hamilelikte nazik, doğum öncesine özel hazırlanmış çalışmalar hem beden hem zihin için iyi geliyor.", "Hamilelik yogası nefes, kalça açıklığı ve gevşemeye odaklanır."],
  seniors: ["İleri yaşta yavaş, destekli ve dengeye odaklı çalışmalar hem güvenli hem çok faydalı.", "Her yaşta başlanabilir; önemli olan nazik ilerlemek ve destek (sandalye, duvar) kullanmaktan çekinmemek."],
  kids: ["Çocuklar için oyunlaştırılmış, kısa ve hareketli yoga hem eğlenceli hem odak geliştirici.", "Çocuk yogasında hayvan isimleri ve hikâyeler pratiği oyuna çevirir."],
  breath: ["Nefes çalışmaları yogayı yoga yapan şeylerden biri; kısa ve düzenli yapıldığında hızla fark edilir.", "Nefesle başlamak, yogaya girmenin en kolay ve etkili yolu."],
  pain: ["Ağrıda ağrıyan bölgeyi zorlamadan çevresini yumuşatan, nazik hareketler daha güvenli olur; ağrı sürüyorsa doktora görün.", "Ağrı bir uyarıdır; hareket nazikçe iyi gelebilir ama keskin ağrıda durmak gerekir."],
  mood: ["Ruh halin için hareket ve nefes birlikte çok destekleyici; ama uzun süreli çökkünlükte bir uzmandan destek almak da önemli.", "Kötü hissettiğinde bile 5 dakikalık yavaş nefes ve esneme duygu durumunu hafifletebilir."],
  digestion: ["Sindirim için karın bölgesini nazikçe masajlayan burgu ve öne eğilmeler yardımcı olur (tok karnına yapma).", "Sindirimi rahatlatmak için yemekten en az 2 saat sonra nazik burgular ve nefes iyi gelir."],
}

export const AREA_LEAD: Record<Area, string[]> = {
  back_low: ["Bel için derin esnemekten çok nazik hareket ve karın-kalça desteği önemli.", "Bel ağrısında nazik, destekli hareketler genellikle iyi gelir; keskin ağrıda dur."],
  back: ["Sırt için omurgayı nazikçe uzatan ve göğsü açan çalışmalar rahatlatır.", "Sırtın sıkıştıysa yavaş omurga hareketleri ve nefes en iyi başlangıç."],
  neck: ["Boyunda sertlik için omuzları gevşetmek ve çeneyi yumuşatmak kadar yavaş hareket de önemli.", "Boyun için çok nazik, küçük hareketler yeter; zorlama."],
  shoulder: ["Omuz için göğüs ve üst sırtı açan, kolları nazikçe çalıştıran hareketler iyi gelir.", "Omuzlarda yük çoğunlukla masa başından; açıp gevşeten duruşlar çok işe yarar."],
  hip: ["Kalçalar uzun oturmaktan sıkışır; derin ama sabırlı esnemeler (yin) en iyi çözüm.", "Kalça açıklığı için yavaş, uzun tutulan duruşlar harika."],
  knee: ["Dizler için bacak kaslarını (kalça, uyluk) güçlendirip dizi zorlamamak asıl mesele.", "Dizi korumak için hizalamaya dikkat edip derin bükmelerden kaçın."],
  wrist: ["Bileklerde yükü azaltan seçenekler ve nazik esneme önemli.", "Bilek hassasiyetinde ağırlık vermeyen alternatifler var; zorlama."],
  foot: ["Ayak ve topuk için nazik esneme ve ayak kaslarını uyandıran basit hareketler iyi gelir.", "Ayaklar vücudun temeli; birkaç dakikalık ayak çalışması sürpriz fark yaratır."],
  head: ["Baş ağrılarında boyun-omuz gerginliğini çözmek ve nefesi yavaşlatmak genelde yardım eder.", "Baş ağrısında zorlayıcı akışlar yerine sakin pratik ve boyun gevşetme daha iyi."],
  belly: ["Karın ve sindirim için nazik burgular ve nefes çalışmaları rahatlatır.", "Sindirim sistemini nazikçe uyaran hareketler (tok karnına değil) çok işe yarar."],
  eyes: ["Gözler için ekrandan uzaklaşıp gözleri dinlendiren kısa egzersizler çok işe yarar.", "Göz yorgunluğunda avuç içi ısıtma ve uzak bir noktaya bakma iyi gelir."],
  legs: ["Bacaklar için dolaşımı açan, kasları uzatan hareketler rahatlatır.", "Bacak yorgunluğunda duvara bacak yaslamak ve yavaş esnemeler harika."],
  chest: ["Göğüs bölgesini açan, nefes alanını genişleten hareketler iyi gelir.", "Göğüs açıldıkça nefes de derinleşir."],
}

export const SEQUENCE: PoseCategory[] = ["Ayakta", "Denge", "Ters ve güç", "Oturarak", "Öne eğilme", "Geriye eğilme", "Dinlenme"]

/** Categories that fit a goal (for routines when the pose texts alone do not decide). */
export const GOAL_CATEGORIES: Partial<Record<Goal, PoseCategory[]>> = {
  sleep: ["Dinlenme", "Oturarak", "Öne eğilme"],
  relax: ["Dinlenme", "Oturarak", "Öne eğilme"],
  stress: ["Dinlenme", "Oturarak", "Öne eğilme", "Ayakta"],
  energy: ["Ayakta", "Geriye eğilme", "Ters ve güç"],
  strength: ["Ayakta", "Ters ve güç", "Denge"],
  weight: ["Ayakta", "Ters ve güç", "Denge"],
  balance: ["Denge", "Ayakta"],
  flexibility: ["Öne eğilme", "Oturarak", "Ayakta"],
  posture: ["Ayakta", "Geriye eğilme", "Oturarak"],
  pain: ["Dinlenme", "Oturarak", "Geriye eğilme"],
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: "başlangıç", intermediate: "orta", advanced: "ileri" }
export const poseLevelOk = (p: YogaPose, level: Level | undefined) => {
  if (!level || level === "advanced") return true
  if (level === "beginner") return p.level === "Başlangıç"
  return p.level !== "İleri"
}
