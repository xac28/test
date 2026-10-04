/**
 * AYA Rehber's small talk and yoga/breath/meditation/platform knowledge.
 * Plain data + a tiny matcher (no model, no network): every answer is written by us and can be reviewed.
 *
 * Matching: the visitor's text is folded to ASCII (ç→c, ğ→g …), split into words, and each entry lists the
 * words/phrases that point to it. A word matches by prefix (so "hamilelikte" matches "hamilelik") or with one
 * typo for longer words ("meditasyn"). The entry with the highest score wins.
 */

import type { StyleId } from "@/lib/ai-guide"

export interface KnowledgeEntry {
  id: string
  /** words or phrases (ASCII-folded, lower-case). Longer phrases weigh more. */
  keys: string[]
  answer: string
  lang?: "tr" | "en"
  /** only answer when the whole message is short (acknowledgements like "tamam", "olur") */
  shortOnly?: boolean
  /** also recommend teachers for these styles */
  teachersFor?: StyleId[]
  links?: { label: string; href: string }[]
  /** follow-up questions shown as chips */
  next?: string[]
}

const MED = "\n\n_Bu bilgi genel amaçlıdır, tıbbi tavsiye yerine geçmez; sağlık sorunun varsa önce doktoruna danış._"

const E = (id: string, keys: string[], answer: string, o: Partial<Omit<KnowledgeEntry, "id" | "keys" | "answer">> = {}): KnowledgeEntry => ({ id, keys, answer, ...o })

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ───────────── small talk ─────────────
  E("how_are_you", ["nasilsin", "naber", "ne haber", "nasil gidiyor", "keyfin nasil", "iyi misin", "nasil hissediyorsun"],
    "İyiyim, teşekkür ederim! Nefes alıp vermek gibi sakin bir gündeyim 🙂 Sen nasılsın? İstersen kısa bir nefes egzersizi ya da sana uygun bir ders önerebilirim.",
    { next: ["Kısa bir nefes egzersizi", "Bana ders öner", "Canım sıkılıyor"] }),
  E("who_are_you", ["kimsin", "sen kimsin", "adin ne", "ismin ne", "adin nedir", "kendini tanit", "sen nesin", "robot musun", "insan misin", "yapay zeka misin"],
    "Ben **AYA Rehber**, bu sitenin yardımcısıyım. Bir insan değilim; yazdığın soruyu anlayıp yoga, nefes, meditasyon ve AYA hakkında bildiklerimle yanıtlarım, doğru sayfaya yönlendiririm.",
    { next: ["Neler yapabilirsin?", "Yoga nedir?", "Eğitmen öner"] }),
  E("what_can_you_do", ["neler yapabilirsin", "ne yapabilirsin", "ne is yapar", "yardim", "nasil kullanilir", "bana yardim et", "ne konusabiliriz", "ne sorabilirim"],
    "Şunlarda yardımcı olabilirim:\n• **Yoga bilgisi**: stiller, duruşlar, yeni başlayanlar için ipuçları\n• **Nefes ve meditasyon**: adım adım kısa egzersizler\n• **Sorunlara göre öneri**: stres, uyku, bel/boyun ağrısı, esneklik\n• **AYA**: eğitmen bulma, atölyeler, canlı yayın, üyelik, ödeme, kayıtlar\n\nBir şey yaz ya da aşağıdan seç.",
    { next: ["Yoga nedir?", "4-7-8 nefesi nasıl yapılır?", "Canlı yayın var mı?", "Üye olmak istiyorum"] }),
  E("age", ["kac yasindasin", "yasin kac", "dogum gunun"], "Yaş kavramım yok ama her sabah yeni bir nefesle başlıyorum 🙂 Sen yoga yolculuğunda neredesin?", { next: ["Yeni başlıyorum", "Orta seviyeyim"] }),
  E("where_from", ["nerelisin", "nerede yasiyorsun", "nerede oturuyorsun"], "Bulutta yaşıyorum ☁️ AYA'nın sunucularında. Sen evinden mi pratik yapıyorsun?", {}),
  E("morning", ["gunaydin", "hayirli sabahlar"], "Günaydın! ☀️ Güne bir dakikalık nefesle başlamak ister misin? Ya da sabah akışı için bir eğitmen önereyim.", { next: ["Kısa bir nefes egzersizi", "Sabah yogası öner"] }),
  E("night", ["iyi geceler", "hayirli geceler", "iyi aksamlar", "tatli ruyalar"], "İyi geceler 🌙 Uyumadan önce 4-7-8 nefesi ya da yatakta yapılan yoga nidra çok iyi gelir. Yarın görüşürüz!", { next: ["4-7-8 nefesi nasıl yapılır?", "Yoga nidra nedir?"] }),
  E("bye", ["gorusuruz", "hoscakal", "hosca kal", "bay bay", "cikiyorum", "kendine iyi bak", "bye", "gule gule"], "Görüşürüz, kendine iyi bak! 🙏 Aklına bir şey gelirse buradayım.", {}),
  E("yes_ok", ["tamam", "olur", "anladim", "peki", "tmm", "okey", "evet"], "Güzel! Başka bir şey öğrenmek ister misin?", { shortOnly: true, next: ["Yoga nedir?", "Eğitmen öner", "Neler yapabilirsin?"] }),
  E("no", ["hayir", "yok", "istemiyorum", "gerek yok"], "Tamam, sorun değil. Aklına bir şey gelirse sormaktan çekinme.", { shortOnly: true }),
  E("joke", ["espri yap", "saka yap", "fikra anlat", "bir espri", "güldür beni", "guldur beni", "komik bir sey"],
    "Yoga öğretmeni neden hiç geç kalmaz? Çünkü her zaman \"şimdiki an\"dadır 😄\n\nBir tane daha: Esneklik ne demek? Pazartesi sabahı alarmı kapatabilmek 😅",
    { next: ["Bir tane daha", "Kısa bir nefes egzersizi"] }),
  E("more_joke", ["bir tane daha", "bir daha", "baska espri"], "Hocaya sormuşlar: \"Meditasyon sırasında aklıma hep yemek geliyor.\" Hoca: \"O zaman dikkatin çok iyi, sadece yanlış yere bakıyor 🍲\"", {}),
  E("bored", ["canim sikiliyor", "sikildim", "sıkıldım", "keyifsizim", "bunaldim", "can sikintisi"],
    "Sıkıldığında vücudu hareket ettirmek iyi gelir. 3 dakikalık bir mola dene: ayakta dur, kollarını yukarı uzat, nefes alırken yukarı, verirken öne eğil; 5 kez tekrarla. Daha uzun bir şey istersen canlı yayına bakabiliriz.",
    { links: [{ label: "Canlı yayınlar", href: "/live" }, { label: "Atölyeler", href: "/atolyeler" }], next: ["Canlı yayın var mı?", "Kısa bir nefes egzersizi"] }),
  E("sad", ["uzgunum", "mutsuzum", "kotuyum", "moralim bozuk", "canim yanıyor", "canim yaniyor", "agliyorum", "yalnizim", "kendimi kotu hissediyorum"],
    "Üzgün olduğunu duyduğuma üzüldüm. Buradayım 🤍 Duyguların geçici ama kıymetli. Şimdi birlikte yavaş bir nefes alalım: 4 saniye burnundan al, 6 saniye ağzından ver. Üç kez tekrarla.\n\nUzun süredir kötü hissediyorsan yakınlarınla ya da bir uzmanla konuşmak çok iyi gelir.",
    { next: ["Kısa bir nefes egzersizi", "Stres için ne önerirsin?"] }),
  E("happy", ["mutluyum", "cok iyiyim", "harikayim", "keyfim yerinde", "enerjik hissediyorum"], "Ne güzel! 😊 Bu enerjiyi pratiğe taşımak ister misin? Akışlı bir vinyasa dersi tam sana göre olabilir.", { teachersFor: ["vinyasa"], next: ["Vinyasa nedir?"] }),
  E("stressed_feeling", ["cok stresliyim", "stresim cok", "gerginim", "kaygiliyim", "endiseliyim", "panik", "anksiyete", "sinirliyim", "ofkeliyim"],
    "Gerginlik yükseldiğinde en hızlı yol nefes. Dene: 4 saniye al, 4 tut, 4 ver, 4 bekle (kutu nefesi), 4 tur. Sonra omuzlarını geriye doğru yuvarlayıp bırak. Düzenli pratik için yin yoga ve meditasyon çok işe yarar.",
    { teachersFor: ["meditation", "yin"], next: ["Kutu nefesi nasıl yapılır?", "Meditasyona nasıl başlarım?", "Uyku için ne önerirsin?"] }),
  E("thanks_ai", ["tesekkurler", "tesekkur ederim", "sagol", "sag ol", "eyvallah", "cok iyisin", "harikasin", "bravo"], "Rica ederim, ne demek! 🙏 Başka bir şey lazım olursa buradayım.", { shortOnly: true }),
  E("insult", ["aptal", "salak", "gerizekali", "sacma", "berbat"], "Anlıyorum, bazen yanlış anlıyorum ve üzgünüm. Daha net sorarsan daha iyi yardımcı olurum; ya da yardım için bir eğitmenle yazışabilirsin.", { links: [{ label: "Eğitmenler", href: "/teachers" }] }),
  E("love", ["seni seviyorum", "evlenir misin", "askim"], "Teşekkür ederim, çok naziksin 🤍 Ben sadece bir yazılımım ama yoga yolculuğunda yanındayım.", {}),
  E("weather", ["hava nasil", "hava durumu", "yagmur yagacak mi"], "Hava durumunu bilmiyorum ama içeride de dışarıda da nefes alınır 🙂 Yağmurlu günlerde yin yoga ve meditasyon çok yakışır.", { next: ["Yin yoga nedir?"] }),
  E("time", ["saat kac", "bugun gunlerden ne", "bugun ne", "tarih ne"], "Saati tam bilemiyorum; cihazının saatine bakabilirsin. Canlı yayın ve ders saatleri her zaman senin saat diliminde gösterilir.", {}),
  E("out_of_scope", ["siyaset", "secim", "futbol", "mac sonucu", "borsa", "dolar", "bitcoin", "tarif ver", "yemek tarifi", "odev yap", "kod yaz"],
    "Bu konuda yardımcı olamam; ben yoga, nefes, meditasyon ve AYA konusunda uzmanım. İstersen onlardan birini konuşalım 🙂", { next: ["Yoga nedir?", "Neler yapabilirsin?"] }),

  // ───────────── yoga basics ─────────────
  E("what_is_yoga", ["yoga nedir", "yoga ne demek", "yoga hakkinda", "yogayi anlat", "yoga anlami"],
    "**Yoga**, beden duruşları (asana), nefes çalışmaları (pranayama) ve meditasyonu birleştiren, binlerce yıllık bir pratiktir. Amaç; esnekliği, gücü ve dengeyi artırırken zihni sakinleştirmek. Her yaş ve seviyeye uygun versiyonları vardır.",
    { next: ["Yoga stilleri nelerdir?", "Yeni başlayanlar için ipuçları", "Eğitmen öner"] }),
  E("yoga_history", ["yoga tarihi", "yoga nereden geliyor", "yoga ne zaman ortaya cikti", "yogayi kim buldu", "patanjali"],
    "Yoga, Hindistan'da yaklaşık 3000+ yıl önce ortaya çıktı. Patanjali'nin *Yoga Sutraları* (yaklaşık MÖ 2.-MS 4. yüzyıl) yoganın felsefesini sekiz basamakta anlatır. Bugün bildiğimiz hareket odaklı stiller ise 20. yüzyılda yaygınlaştı.",
    { next: ["Yoga stilleri nelerdir?"] }),
  E("yoga_styles", ["yoga stilleri", "yoga cesitleri", "yoga turleri", "yoga turu", "hangi stil", "stil farki", "yoga cesidi"],
    "Başlıca stiller:\n• **Hatha**: yavaş, temel duruşlar; yeni başlayanlara ideal\n• **Vinyasa**: nefesle akan, dinamik seri\n• **Yin**: duruşları 3-5 dk tutan derin esneme\n• **Ashtanga**: sabit seri, güçlü ve disiplinli\n• **Restoratif**: destekli, tam gevşeme\n• **Yoga Nidra**: yatarak yapılan rehberli gevşeme\n• **Kundalini**: nefes, ses ve hareket birlikte",
    { next: ["Hatha nedir?", "Vinyasa nedir?", "Yin yoga nedir?", "Bana stil öner"] }),
  E("hatha", ["hatha", "hatha yoga", "hatha nedir"], "**Hatha**, yavaş tempolu ve temel duruşları öğreten genel bir yoga şemsiyesidir. Duruşları nefesle birlikte tutarsın; yeni başlayanlar için en güvenli ve anlaşılır başlangıçtır.", { teachersFor: ["hatha"], next: ["Yeni başlayanlar için ipuçları", "Vinyasa nedir?"] }),
  E("vinyasa", ["vinyasa", "vinyasa nedir", "flow yoga", "akis yogasi"], "**Vinyasa**, hareketleri nefese bağlayarak akıcı bir seri halinde yapmaktır. Kalbi çalıştırır, güç ve dayanıklılık kazandırır; hareketli ve enerjik bir ders isteyenlere uygundur.", { teachersFor: ["vinyasa"], next: ["Hatha nedir?", "Ashtanga nedir?"] }),
  E("yin", ["yin yoga", "yin nedir", "yin yogasi"], "**Yin yoga**, duruşları 3-5 dakika boyunca pasif şekilde tutarak bağ dokusuna (fasya, bağlar) çalışır. Yavaştır, sakinleştirir; akşamları, stresli dönemlerde ve esneklik için çok iyidir.", { teachersFor: ["yin"], next: ["Uyku için ne önerirsin?", "Restoratif yoga nedir?"] }),
  E("ashtanga", ["ashtanga", "ashtanga nedir", "ashtanga yoga", "power yoga"], "**Ashtanga**, her seferinde aynı sırayla yapılan güçlü ve disiplinli bir seridir; terleten, kas çalıştıran bir stildir. Biraz deneyimin varsa keyif alırsın.", { teachersFor: ["ashtanga"], next: ["Vinyasa nedir?"] }),
  E("restorative", ["restoratif", "restorative", "onarici yoga", "destekli yoga"], "**Restoratif yoga**, yastık ve blokla desteklenen, uzun süre tutulan çok rahat duruşlardır. Sinir sistemini yatıştırır; tükenmişlik, uykusuzluk ve toparlanma dönemleri için idealdir.", { teachersFor: ["restorative"], next: ["Uyku için ne önerirsin?", "Yin yoga nedir?"] }),
  E("yoga_nidra", ["yoga nidra", "nidra", "yogik uyku"], "**Yoga Nidra**, sırt üstü yatarak yapılan, ses rehberliğinde bilinçli bir gevşeme pratiğidir. 20 dakikası birkaç saatlik uykunun dinlendirici etkisine yaklaşabilir; uyku ve stres için çok sevilir.", { teachersFor: ["meditation", "restorative"], next: ["Uyku için ne önerirsin?"] }),
  E("kundalini", ["kundalini"], "**Kundalini**, hareket, güçlü nefes teknikleri, ses ve meditasyonu birleştiren, enerjiyi uyandırmayı hedefleyen bir yoga ekolüdür. Sıra dışı gelebilir; ilk derste eğitmenine yeni olduğunu söylemen yeterli.", { next: ["Yoga stilleri nelerdir?"] }),
  E("face_yoga", ["yuz yogasi", "face yoga", "yuz egzersizi"], "**Yüz yogası**, yüz ve boyun kaslarına yönelik masaj ve egzersizlerdir. Gerginliği azaltmaya ve yüzü canlı hissettirmeye yardım eder; sonuçlar kişiden kişiye değişir.", { next: ["Yoga stilleri nelerdir?"] }),
  E("fascial", ["fasyal yoga", "fasya", "fascia"], "**Fasyal yoga**, kasları saran bağ dokusunu (fasya) yumuşatmaya odaklanır; uzun tutuşlar ve yavaş hareketlerle gerginliği çözmeyi hedefler.", { next: ["Yin yoga nedir?"] }),
  E("beginner", ["yeni basliyorum", "yeni baslayanlar", "baslangic", "hic yoga yapmadim", "ilk kez yoga", "yogaya nasil baslarim", "baslangic seviyesi", "yoga yapmayi bilmiyorum"],
    "Hoş geldin! Yeni başlayanlar için ipuçları:\n• **Hatha** ya da yeni başlayan seviyesi dersleri seç\n• Haftada 2-3 gün, 20-30 dakikayla başla\n• Zorlama; acı değil, hafif bir gerilme hissetmelisin\n• Nefesini tutma, burnundan akıcı nefes al\n• İlk dersi **yarı fiyatına** deneme dersi olarak alabilirsin",
    { teachersFor: ["hatha"], next: ["Yoga için ne gerekir?", "Haftada kaç gün yoga yapmalı?", "Eğitmen öner"] }),
  E("equipment", ["yoga icin ne gerekir", "yoga mati", "mat lazim mi", "ne almaliyim", "blok", "ekipman", "yoga kiyafeti", "ne giymeliyim", "malzeme"],
    "Başlamak için sadece **kaymayan bir mat** ve rahat, esneyen bir kıyafet yeter. Zamanla bir **blok** ve bir **kayış** esnekliğine destek olur. Çıplak ayakla, sakin bir köşede yap; kamera ve mikrofonunun çalıştığından emin ol.",
    { next: ["Yeni başlayanlar için ipuçları", "Derse nasıl katılırım?"] }),
  E("frequency", ["haftada kac gun", "ne siklikla", "her gun yoga", "gunde kac dakika", "ne kadar yoga", "kac dakika yoga"],
    "Başlangıç için **haftada 2-3 gün, 20-45 dakika** idealdir. Düzenlilik süreden önemlidir; her gün 10 dakika bile fark yaratır. Vücudunu dinle, dinlenme günlerini atlama.",
    { next: ["Sabah mı akşam mı yoga?", "Yeni başlayanlar için ipuçları"] }),
  E("time_of_day", ["sabah mi aksam mi", "sabah yogasi", "aksam yogasi", "yoga ne zaman yapilir", "hangi saatte yoga", "yoga saati"],
    "İkisi de güzel: **sabah** akışlı, canlandıran dersler; **akşam** yin ya da restoratif gibi yavaş dersler iyi gelir. Yemekten sonra en az 2 saat bekle.",
    { teachersFor: ["vinyasa", "yin"], next: ["Aç karnına yoga yapılır mı?"] }),
  E("empty_stomach", ["ac karnina", "yemekten sonra yoga", "yemekten once", "yoga ve yemek", "karnim tok"], "Yoga için ideal olan **hafif aç karnına** yapmaktır; ana yemekten sonra 2-3 saat, hafif atıştırmalıktan sonra 1 saat bekle. Bol su içmeyi unutma.", { next: ["Sabah mı akşam mı yoga?"] }),
  E("flexibility", ["esnek degilim", "esneklik gerekir mi", "esnek olmam lazim mi", "esnekligim yok", "parmaklarim yere degmiyor", "esnek olmak"], "Yoga için esnek olmak gerekmez; **yoga seni esnetir**. Herkes kendi seviyesinde başlar, blok ve kayış tam bunun için var. Karşılaştırma yapma, kendi bedenini dinle.", { teachersFor: ["hatha", "yin"], next: ["Yeni başlayanlar için ipuçları"] }),
  E("weight_loss", ["kilo vermek", "kilo verilir", "kilo verme", "zayiflamak", "kilo verir mi", "yagi yakmak", "zayiflama yogasi", "kalori"], "Yoga tek başına hızlı kilo verdirmez ama **vinyasa/power** gibi akışlı stiller kalori yakar, ayrıca stresi ve yeme alışkanlıklarını dengelemeye yardım eder. Dengeli beslenme ve düzenli hareketle birlikte etkilidir.", { teachersFor: ["vinyasa", "ashtanga"], next: ["Vinyasa nedir?"] }),
  E("strength", ["guc kazanmak", "kas yapmak", "karin kasi", "core", "guclenmek", "dayaniklilik"], "Güç için **ashtanga** ve **vinyasa**; tahta (plank), savaşçı ve sandalye duruşları kasları çalıştırır. Önemli olan form: karnını hafifçe içe çek, omuzlarını kulaklarından uzak tut.", { teachersFor: ["ashtanga", "vinyasa"], next: ["Savaşçı duruşu nasıl yapılır?"] }),
  E("pregnancy", ["hamile", "hamilelik", "gebelik", "bebek bekliyorum", "dogum sonrasi", "lohusa"], "Hamilelikte nazik yoga ve nefes çalışmaları birçok kişiye iyi gelir; ama **önce doktoruna sor**. Karın üstüne yatmaktan, derin burgulardan ve sıcak ortamdan kaçın; hamile yogasında deneyimli bir eğitmeni tercih et." + MED, { teachersFor: ["restorative", "hatha"], next: ["Eğitmen öner"] }),
  E("seniors", ["yasli", "yaslilar", "emekli", "60 yas", "70 yas", "ileri yas", "buyukanne", "buyukbaba"], "Yoga her yaşta yapılabilir. **Sandalyeli yoga**, hatha ve restoratif; denge, eklem hareketliliği ve özgüven için harikadır. Yavaş başla, destek kullan, gerekirse doktoruna danış.", { teachersFor: ["hatha", "restorative"], next: ["Denge için ne yapmalı?"] }),
  E("kids", ["cocuk yogasi", "cocuklar icin yoga", "cocugum", "cocuklar yoga"], "Çocuklar için yoga oyun gibi olmalı: hayvan duruşları (kedi, kobra, kurbağa), kısa nefes oyunları ve hikâyeler. 10-20 dakika yeterli. Ebeveyn eşliğinde yapmak daha keyiflidir.", { next: ["Kedi-inek duruşu nasıl yapılır?"] }),
  E("men", ["erkekler yoga", "erkek yoga yapar mi", "erkegim yoga"], "Elbette! Yoga kökeninde erkeklerin pratiğiydi. Güç, esneklik, bel ve kalça açıklığı ve stres yönetimi için herkese yarar.", { teachersFor: ["vinyasa", "ashtanga"] }),
  E("home_practice", ["evde yoga", "evde nasil", "kendi basima yoga", "evden yoga", "online yoga ise yarar mi", "online mi yuz yuze mi"], "Evde yoga çok işe yarar; canlı dersle eğitmen formunu düzeltir, kayıtlı derslerle kendi hızında çalışırsın. AYA'da **canlı yayınlar**, **atölyeler** ve **birebir dersler** var; dersler istenirse kaydedilip 30 gün indirilebilir.", { links: [{ label: "Canlı yayınlar", href: "/live" }, { label: "Atölyeler", href: "/atolyeler" }], next: ["Dersin kaydını nasıl indiririm?"] }),

  // ───────────── health & goals (general info) ─────────────
  E("back_pain", ["bel agrisi", "bel agrim", "belim agriyor", "sirt agrisi", "sirtim agriyor", "bel fitigi", "bel tutulmasi"], "Hafif bel ağrısında **kedi-inek**, **çocuk duruşu** ve **diz çekme** gibi yumuşak hareketler rahatlatabilir; ağrıyı artıran hareketi bırak, öne eğilirken zorlama. Ağrı sürüyor, bacağa yayılıyor ya da uyuşma varsa doktora git." + MED, { teachersFor: ["restorative", "yin"], next: ["Kedi-inek duruşu nasıl yapılır?", "Çocuk duruşu nasıl yapılır?"] }),
  E("neck_pain", ["boyun agrisi", "boynum agriyor", "boyun tutulmasi", "boyun fitigi", "omuz agrisi", "omuzlarim agriyor", "masa basinda calisiyorum", "gerginlik omuz"], "Boyun ve omuz gerginliği için: omuzları kulaklara çekip bırak (5 kez), kulağını yavaşça omzuna yaklaştır (her yan 30 sn), kollarını arkada kenetleyip göğsünü aç. Ekran başında her saat mola ver." + MED, { teachersFor: ["yin", "restorative"], next: ["Masa başı için yoga", "Stres için ne önerirsin?"] }),
  E("desk", ["masa basi", "ofis yogasi", "ofiste yoga", "bilgisayar basinda", "uzun sure oturmak", "sandalye yogasi"], "Masa başı için mini mola: oturduğun yerde dik otur, nefes alırken kollarını yukarı uzat, verirken bir yana dön (yan başına 3 nefes), sonra bileklerini ve boynunu çevir. Her 45-60 dakikada bir 2 dakika ayağa kalk.", { teachersFor: ["hatha", "yin"], next: ["Boyun ağrısı için ne yapayım?"] }),
  E("knee", ["diz agrisi", "dizim agriyor", "diz sakatligi", "diz problemi", "menisk"], "Diz hassasiyetinde derin diz bükmelerinden ve kapalı bağdaş kurmaktan kaçın; destek için battaniye/blok kullan, dizini ayak bileğinin üstünde tut. Ağrı keskinse zorlama." + MED, { teachersFor: ["restorative", "hatha"], next: ["Eğitmen öner"] }),
  E("sleep", ["uyku", "uyuyamiyorum", "uykusuzluk", "uyku problemi", "uyku duzeni", "gece uyanıyorum", "gece uyaniyorum", "insomnia", "rahat uyumak"], "Uyku için akşam rutini dene: ekranı kapat, **4-7-8 nefesi** (4 al, 7 tut, 8 ver) 4 tur, bacakları duvara dayayıp 5 dk yat, sonra **yoga nidra** dinle. Yin ve restoratif dersler sinir sistemini yatıştırır." + MED, { teachersFor: ["restorative", "yin", "meditation"], next: ["4-7-8 nefesi nasıl yapılır?", "Yoga nidra nedir?"] }),
  E("stress", ["stres", "stresli", "stres icin", "stresle basa cikmak", "gerginlik", "bunalim", "tukenmislik", "burnout", "yorgunum"], "Stres için üç basit araç: **uzun nefes verişi** (nefes verirken saymayı uzat), **yin/restoratif yoga**, **5 dakikalık meditasyon**. Düzenli, kısa pratikler uzun ve seyrek olandan daha etkilidir." + MED, { teachersFor: ["meditation", "yin", "restorative"], next: ["Kutu nefesi nasıl yapılır?", "Meditasyona nasıl başlarım?"] }),
  E("anxiety", ["kaygi", "anksiyete", "endise", "panik atak", "kalp carpintisi", "korku", "huzursuz"], "Kaygı anında nefesi **yavaşlat**: 4 saniye al, 6-8 saniye ver; ayaklarını yere bas, çevrende gördüğün 5 şeyi say (5-4-3-2-1 tekniği). Sık yaşıyorsan bir uzmandan destek almak önemlidir." + MED, { teachersFor: ["meditation", "restorative"], next: ["Kutu nefesi nasıl yapılır?", "Meditasyona nasıl başlarım?"] }),
  E("focus", ["odaklanamiyorum", "konsantrasyon", "dikkat dagınıklıgı", "dikkat daginikligi", "odaklanmak", "ders calisirken", "zihnim durmuyor", "zihin susmuyor"], "Odak için: 5 dakikalık **nefes sayma meditasyonu** (1'den 10'a say, dağılınca 1'e dön) ve **ağaç duruşu** gibi denge duruşları dikkati toplar. Telefonu uzağa koy, tek iş yap.", { teachersFor: ["meditation", "hatha"], next: ["Meditasyona nasıl başlarım?", "Ağaç duruşu nasıl yapılır?"] }),
  E("energy", ["enerjim yok", "enerji vermek", "sabah uyanamiyorum", "yorgun hissediyorum", "dinc hissetmek", "enerji icin"], "Enerji için sabah **güneşe selam**, 1 dakika **kapalabhati** (hızlı nefes verişler; hamileyse ve yüksek tansiyonda yapma) ve açık hava iyi gelir. Akşam ise uyku düzenine dikkat et.", { teachersFor: ["vinyasa"], next: ["Güneşe selam nedir?", "Vinyasa nedir?"] }),
  E("balance", ["denge", "dengemi kaybediyorum", "denge icin", "dengeli durmak", "denge duruslari"], "Denge için **ağaç**, **savaşçı III** ve **kartal** duruşlarını duvarın yanında dene. Gözünü sabit bir noktaya diker, nefesi akıcı tutarsın; sallanman normal ve işe yarıyor.", { teachersFor: ["hatha"], next: ["Ağaç duruşu nasıl yapılır?"] }),
  E("posture", ["durus bozuklugu", "durusum kotu", "kamburluk", "omuz one", "durusu duzeltmek", "dik durmak"], "Duruş için göğüs açan hareketler (kobra, köprü, kollar arkada kenetli) ve güçlü sırt/karın kasları gerekir. Aynaya yan dön, kulak-omuz-kalça hizasını kontrol et.", { teachersFor: ["hatha"], next: ["Kobra duruşu nasıl yapılır?", "Köprü duruşu nasıl yapılır?"] }),
  E("hips", ["kalca acma", "kalca esnekligi", "kalcalarim sert", "kalca yoga", "ciyan"], "Kalça açmak için **güvercin**, **kelebek** ve **düşük hamle** duruşları iyidir; yin yogada 2-3 dk tutulur. Dizlerini zorlama, destek kullan.", { teachersFor: ["yin"], next: ["Yin yoga nedir?"] }),
  E("headache", ["bas agrisi", "migren", "bas donmesi"], "Gerilim tipi baş ağrısında boyun-omuz gevşetmek, yavaş nefes ve karanlık sessiz bir ortamda dinlenmek yardımcı olabilir. Sık ya da şiddetli baş ağrılarında mutlaka doktora git." + MED, { next: ["Boyun ağrısı için ne yapayım?"] }),
  E("blood_pressure", ["tansiyon", "yuksek tansiyon", "kalp hastaligi", "diyabet", "seker hastaligi", "astim", "ameliyat", "sakatlik", "rahatsizligim var"], "Sağlık sorunun varsa (tansiyon, kalp, diyabet, ameliyat sonrası, sakatlık…) yogaya başlamadan **doktoruna danış** ve eğitmene önceden haber ver. Kafanın kalptan aşağıda olduğu duruşları ve zorlayıcı nefes tutmaları genelde doktor onayı ister." + MED, { teachersFor: ["restorative", "hatha"], next: ["Eğitmen öner"] }),
  E("injury", ["yaralandim", "burkulma", "kas cekmesi", "agri var yoga yapabilir miyim"], "Yaralıyken akut dönemde dinlenmek en iyisi; iyileşirken doktorun onayıyla çok hafif hareketlerle dön. Yoga'da acı sinyaldir: keskin ağrıda dur." + MED, {}),

  // ───────────── breathing ─────────────
  E("breath_basic", ["nefes egzersizi", "nefes teknikleri", "kisa bir nefes", "nefes calismasi", "pranayama", "nefes almak", "nefes alma teknigi", "nefes nasil alinir"],
    "Basit bir başlangıç: **1)** rahat otur, sırtın uzun. **2)** Burnundan 4 saniye nefes al. **3)** 6 saniye yavaşça ver. **4)** 2 dakika tekrarla; omuzların aşağı insin. Uzun verilen nefes sinir sistemini yatıştırır.",
    { next: ["Kutu nefesi nasıl yapılır?", "4-7-8 nefesi nasıl yapılır?", "Nadi shodhana nedir?"] }),
  E("box_breath", ["kutu nefesi", "box breathing", "4-4-4-4", "kare nefes"], "**Kutu nefesi**: 4 saniye burundan al, 4 saniye tut, 4 saniye ver, 4 saniye boş bekle. 4-6 tur yap. Odak ve sakinlik için çok kullanılır; baş dönerse normal nefese dön.", { next: ["4-7-8 nefesi nasıl yapılır?", "Meditasyona nasıl başlarım?"] }),
  E("478", ["4-7-8", "478 nefes", "dort yedi sekiz", "4 7 8 nefes"], "**4-7-8 nefesi**: dilini üst dişlerinin arkasına koy; burundan 4 saniye al, 7 saniye tut, ağızdan \"fuuu\" sesiyle 8 saniye ver. 4 tur yeter; uyumadan önce harikadır. Yeni başlıyorsan tutuşu kısalt.", { next: ["Uyku için ne önerirsin?", "Kutu nefesi nasıl yapılır?"] }),
  E("nadi", ["nadi shodhana", "nadi sodhana", "dönüşümlü nefes", "donusumlu nefes", "burun deligi nefesi", "alternate nostril"], "**Nadi shodhana** (dönüşümlü burun nefesi): sağ baş parmağınla sağ burun deliğini kapat, soldan al; sonra yüzük parmağınla sol deliği kapatıp sağdan ver, sağdan al, soldan ver. Bu 1 tur; 5-10 tur yap. Dengeleyici ve sakinleştiricidir.", { next: ["Kutu nefesi nasıl yapılır?"] }),
  E("ujjayi", ["ujjayi", "okyanus nefesi", "ocean breath"], "**Ujjayi** (okyanus nefesi): boğazını hafifçe daralt, ağzını kapalı tutup burundan hafif deniz sesi çıkararak nefes al ve ver. Vinyasa'da tempoyu ve odağı korur.", { next: ["Vinyasa nedir?"] }),
  E("kapalabhati", ["kapalabhati", "ates nefesi", "hizli nefes"], "**Kapalabhati**: pasif nefes alıp karnı hızla içe çekerek nefesi burundan kısa kısa vermektir (30 vuruşla başla). Hamilelikte, yüksek tansiyonda, epilepside ya da baş dönmesinde yapma." + MED, {}),
  E("diaphragm", ["diyafram nefesi", "karin nefesi", "karindan nefes", "derin nefes"], "**Diyafram nefesi**: bir elin karnında, bir elin göğsünde; nefes alırken karnın şişsin, verirken insin. Göğüs az hareket etmeli. Günde 5 dakika stresi azaltır.", { next: ["Kutu nefesi nasıl yapılır?"] }),

  // ───────────── meditation ─────────────
  E("meditation_start", ["meditasyona nasil baslarim", "meditasyon nasil yapilir", "meditasyon nedir", "meditasyon yapmak", "meditasyon baslangic", "meditasyon", "mindfulness", "farkindalik", "zihin sakinlestirme"],
    "**Meditasyon**, dikkatini bir noktada (çoğu zaman nefes) tutma çalışmasıdır. 5 dakikayla başla: rahat otur, gözlerini kapat, nefesini say (1'den 10'a). Zihin dağılınca kendine kızma, nazikçe nefese dön; asıl pratik bu geri dönüştür.",
    { teachersFor: ["meditation"], next: ["Meditasyon ne kadar sürmeli?", "Kutu nefesi nasıl yapılır?", "Mindfulness nedir?"] }),
  E("meditation_time", ["meditasyon ne kadar", "kac dakika meditasyon", "meditasyon suresi", "meditasyon ne zaman"], "Başlangıç için **5-10 dakika**, her gün aynı saatte. Alışınca 15-20 dakikaya çıkabilirsin. Sabah uyanınca ya da uyumadan önce en kolayıdır.", { next: ["Meditasyona nasıl başlarım?"] }),
  E("mindfulness_def", ["mindfulness nedir", "farkindalik nedir", "bilincli farkindalik"], "**Mindfulness (bilinçli farkındalık)**, şu anda olanı yargılamadan fark etmektir: nefesin, sesler, bedendeki hisler. Yemek yerken, yürürken bile yapılabilir.", { teachersFor: ["meditation"], next: ["Meditasyona nasıl başlarım?"] }),
  E("mind_wander", ["aklim dagiliyor", "meditasyon yapamiyorum", "zihnim susmuyor", "dusunceler durmuyor", "meditasyon zor"], "Zihnin dağılması **normaldir**, meditasyonun parçasıdır. Fark ettiğin an kendine \"dağıldım\" de, nazikçe nefese dön. Her dönüş zihin kası için bir tekrar sayılır.", { next: ["Meditasyona nasıl başlarım?"] }),
  E("chakra", ["cakra", "cakralar", "chakra", "enerji merkezleri"], "**Çakralar**, yoga geleneğinde omurga boyunca uzandığı düşünülen yedi enerji merkezidir (kök, sakral, solar pleksus, kalp, boğaz, üçüncü göz, taç). Bilimsel bir kanıtı yok ama odaklanma ve niyet için sembolik bir çerçeve olarak kullanılır.", {}),
  E("om", ["om sesi", "om nedir", "mantra", "mantra nedir"], "**Om**, yoga geleneğinde evrenin ilk sesi olarak kabul edilen bir mantradır. Uzun nefes verirken söylemek titreşimi hissettirir ve zihni toplar. Dilersen kendi anlamlı bir kelimeni de mantra yapabilirsin.", {}),
  E("shavasana", ["savasana", "shavasana", "ceset durusu", "son gevseme"], "**Şavasana** (ölü/ceset duruşu), dersin sonunda sırt üstü yatıp tüm bedeni bırakmaktır; 3-10 dakika. Kolay görünür ama en zor duruşlardan biridir: hiçbir şey yapmamak. Pratiğin etkisini yerleştirir.", {}),

  // ───────────── poses ─────────────
  E("pose_downdog", ["asagi bakan kopek", "downward dog", "kopek durusu"], "**Aşağı bakan köpek**: eller ve ayaklar yerde, kalçan yukarı, vücudun ters V. Ellerini omuz genişliğinde aç, parmakları yay, dizlerin hafif bükülü olabilir; sırtını uzat. Bileğin ağrırsa yumruk ya da dirsek varyasyonu dene.", { next: ["Çocuk duruşu nasıl yapılır?", "Kobra duruşu nasıl yapılır?"] }),
  E("pose_child", ["cocuk durusu", "child pose", "balasana"], "**Çocuk duruşu**: dizlerin üstüne otur, topuklara doğru kalçanı bırak, alnın yere ve kollar önde uzun. Bel ve omuzları dinlendirir; herhangi bir duruş sırasında dinlenme noktasıdır. Dizin acırsa altına battaniye koy.", { next: ["Kedi-inek duruşu nasıl yapılır?"] }),
  E("pose_catcow", ["kedi inek", "kedi-inek", "cat cow", "marjaryasana"], "**Kedi-inek**: dört ayak üstünde, nefes alırken karnı yere bırakıp başı kaldır (inek), verirken sırtı yuvarla ve çeneyi göğse getir (kedi). 8-10 tur; omurgayı ısıtır, bel ağrısına nazik bir başlangıçtır.", { next: ["Çocuk duruşu nasıl yapılır?"] }),
  E("pose_cobra", ["kobra", "cobra durusu", "bhujangasana"], "**Kobra**: yüzüstü yat, avuçlar göğüs hizasında, nefes alırken göğsünü kaldır; dirsekler hafif bükülü, kalçan gevşek. Alt belinde sıkışma hissedersen yüksekliği azalt. Sırtı güçlendirir, göğsü açar.", { next: ["Köprü duruşu nasıl yapılır?"] }),
  E("pose_bridge", ["kopru durusu", "bridge pose", "setu bandha"], "**Köprü**: sırt üstü yat, dizler bükülü, ayaklar kalça genişliğinde; nefes alırken kalçanı kaldır, omuzların yerde. Kalça ve bacak arkasını güçlendirir, göğsü açar. Boynu çevirme.", { next: ["Kobra duruşu nasıl yapılır?"] }),
  E("pose_warrior", ["savasci", "warrior", "virabhadrasana", "savasci durusu"], "**Savaşçı II**: bacakları geniş aç, ön diz 90° bükülü ve ayak bileğinin üstünde, kollar yanlara uzun, bakış ön elin üstünde. Bacakları ve dayanıklılığı güçlendirir; omuzlar gevşek kalsın.", { next: ["Ağaç duruşu nasıl yapılır?"] }),
  E("pose_tree", ["agac durusu", "tree pose", "vrksasana"], "**Ağaç**: bir ayağın üstünde dur, diğer ayağın tabanını iç baldır ya da uyluğa koy (dize değil), ellerini göğüste birleştir ya da yukarı uzat. Gözünü sabit bir noktaya diker; denge ve odak için harika.", { next: ["Denge için ne yapmalı?"] }),
  E("pose_mountain", ["dag durusu", "mountain pose", "tadasana"], "**Dağ duruşu**: ayaklar kalça genişliğinde, ağırlık eşit, dizler yumuşak, kuyruk sokumu aşağı, başın tepesi tavana. Tüm duruşların temelidir; sakin ve uzun nefes al.", { next: ["Ağaç duruşu nasıl yapılır?"] }),
  E("pose_sun", ["gunese selam", "surya namaskar", "sun salutation"], "**Güneşe selam**, 12 duruşluk akışlı bir seridir: dağ → yukarı uzanış → öne eğiliş → plank → kobra/köpek … Sabah ısınma için idealdir; yavaş başlayıp tempoyu artır.", { teachersFor: ["vinyasa"], next: ["Vinyasa nedir?"] }),
  E("pose_pigeon", ["guvercin", "pigeon pose"], "**Güvercin**: ön bacağı bükerek kalçayı açan derin bir duruştur; yin yogada 2-3 dakika tutulur. Kalçan yerden yükseliyorsa altına blok koy; dizde ağrı olursa çık.", { teachersFor: ["yin"] }),
  E("pose_plank", ["plank", "tahta durusu"], "**Plank**: omuzlar bileklerin üstünde, vücut düz bir çizgi, karın hafif içeride. Belin çökmesin. Zorsa dizlerini yere indir. Karın ve omuz gücü için temel duruş.", { next: ["Savaşçı duruşu nasıl yapılır?"] }),
  E("pose_lotus", ["nilufer durusu", "padmasana", "bagdas kurmak", "bagdas"], "**Bağdaş/Nilüfer**: rahat bağdaş (sukhasana) için kalçanın altına katlanmış battaniye koy; dizler kalçadan aşağıda olsun. Tam nilüfer için kalça esnekliği gerekir; dizini zorlama, ağrı olursa çık.", {}),
  E("sitting_long", ["uzun sure bagdas", "otururken belim agriyor", "meditasyonda belim"], "Uzun oturmada beli yormamak için kalçanı dizlerinden yüksek tut (yastık/blok), sırt duvara yaslı olabilir ya da sandalyede otur. Beden rahat olunca zihin de rahat eder.", {}),

  // ───────────── platform FAQ ─────────────
  E("how_join_class", ["derse nasil katilirim", "ders odasi", "derse giris", "ders saatinde", "odaya girmek", "derse baglanamiyorum", "derse katilmak"], "Ders saatinde **Panelim → Yaklaşan dersler** bölümünden odaya girersin. Tarayıcı kamera ve mikrofon izni ister; izin ver. Girişte sorun olursa sayfayı yenile ve başka sekmelerin kamerayı kullanmadığından emin ol.", { links: [{ label: "Panelim", href: "/dashboard" }], next: ["Kamera çalışmıyor", "Dersin kaydını nasıl indiririm?"] }),
  E("camera_problem", ["kamera calismiyor", "mikrofon calismiyor", "ses gelmiyor", "goruntu yok", "kamera acilmiyor", "sesim gitmiyor", "izin vermedim"], "Kamera/mikrofon için: **1)** adres çubuğundaki kilit simgesinden izin ver, **2)** başka uygulama (Zoom vb.) kamerayı kullanıyorsa kapat, **3)** sayfayı yenile, **4)** farklı bir tarayıcı (güncel Chrome/Edge/Safari) dene. Canlı yayında bağlantı yavaşsa kaliteyi düşür (360p).", { next: ["Yayında kalite nasıl değişir?"] }),
  E("quality_choose", ["kalite", "1080p", "720p", "goruntu kalitesi", "yayin donuyor", "yayin takiliyor", "internet yavas"], "Canlı yayında oynatıcının altındaki **dişli (Kalite)** menüsünden Otomatik, 1080p, 720p, 360p ya da yalnız ses seçebilirsin. İnternet yavaşsa 360p ya da yalnız ses akıcı kalır.", { links: [{ label: "Canlı yayınlar", href: "/live" }] }),
  E("time_zone", ["saat dilimi", "saat farki", "ders saati kac", "yurt disindayim", "timezone"], "Tüm ders ve yayın saatleri **senin cihazının saat diliminde** gösterilir; yurt dışındaysan da doğru saati görürsün. Ders ayırırken saat, eğitmenin müsait olduğu saatlerden seçilir.", {}),
  E("payment_methods", ["odeme yontemleri", "nasil odeme yapilir", "nasil odeme yaparim", "kredi karti", "iyzico", "stripe", "havale", "taksit", "odeme guvenli mi"], "Birebir derslerde ödeme **Stripe** ya da **Iyzico** üzerinden yapılır; kart bilgin bizde saklanmaz. Ücretli atölyelerde önce yerin ayrılır, ödeme eğitmen tarafından onaylanınca katılımın kesinleşir.", { links: [{ label: "Paketler", href: "/pricing" }], next: ["İade var mı?"] }),
  E("refund", ["iade", "para iadesi", "ucret iadesi", "dersi iptal", "iptal etmek", "ders iptali", "iptal politikasi"], "İptal ve iade koşulları **Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi**'nde yazılıdır. Bir sorun yaşadıysan ders odasındaki ya da profildeki **Bildir/Sorun bildir** düğmesiyle yöneticilere ulaşabilirsin; iade ödeme sağlayıcı üzerinden yapılır.", { links: [{ label: "Sözleşme", href: "/terms" }], next: ["Sorun nasıl bildirilir?"] }),
  E("trial_lesson", ["deneme dersi", "ilk ders", "ilk ders fiyati", "yarim fiyat", "deneme", "ucretsiz ders"], "Her eğitmenin **ilk deneme dersi yarı fiyatadır**. Bir eğitmen seç, profildeki müsait saatten birini işaretle, ödemeyi tamamla. Atölyelerin bir kısmı da ücretsizdir.", { links: [{ label: "Eğitmenler", href: "/teachers" }, { label: "Atölyeler", href: "/atolyeler" }], next: ["Eğitmen öner"] }),
  E("teacher_approval", ["egitmen onayi", "onayli egitmen", "onaysiz egitmen", "neden onayli", "egitmen guvenilir mi", "sertifikali mi", "sertifika"], "AYA'da ders veren herkes önce **başvuru + sertifika incelemesinden** geçer, sonra yöneticilerle canlı bir **deneme yayını** yapar. Onay almayan eğitmen halka açık ders ve yayın veremez, listede de görünmez.", { next: ["Eğitmen olmak istiyorum"] }),
  E("commission", ["komisyon", "yuzde kac", "eğitmen kazanci", "egitmen kazanci", "ne kadar kazanirim", "kazanc oranı"], "Platform komisyonu varsayılan olarak **%15**'tir (deneme derslerinden komisyon alınmaz). Kazancını panelindeki **Kazançlar** sayfasından takip eder, ödeme talebi oluşturursun.", { links: [{ label: "Eğitmen başvurusu", href: "/become-teacher" }] }),
  E("recording_how", ["dersi kaydet", "kayit nasil", "kayit alinir mi", "dersi kaydedebilir miyim", "kayit baslat", "ders kaydi"], "Eğitmen ders ya da yayın sırasında **\"Dersi kaydet\"** düğmesine basar; herkes odada kayıt bilgisini görür. Kayıt yalnızca o dersin **eğitmeni ve öğrencisi** tarafından indirilebilir ve **30 gün** sonra silinir.", { links: [{ label: "Panelim", href: "/dashboard" }] }),
  E("password", ["sifremi unuttum", "sifre degistir", "sifre sifirla", "giris yapamiyorum", "sifre hatali", "hesabima giremiyorum"], "Giriş sorunu yaşıyorsan e-posta ve şifrenin doğru olduğundan emin ol; Google ile kaydolduysan **\"Google ile devam et\"** ile gir. Şifre sıfırlama bağlantısı henüz yok; yardım için destek ekibine yazabilirsin.", { links: [{ label: "Giriş yap", href: "/login" }] }),
  E("delete_account", ["hesabimi sil", "hesap silme", "uyeligi iptal", "uyelikten cik", "verilerimi sil", "kvkk"], "Hesap silme ve veri talepleri için **Gizlilik Politikası**'ndaki iletişim kanalını kullanabilirsin; talebin kimlik doğrulamasıyla işleme alınır.", { links: [{ label: "Gizlilik", href: "/privacy" }] }),
  E("language", ["dil degistir", "ingilizce", "turkce", "english", "dil secenegi", "language"], "Sitenin sağ üstündeki **TR / EN** düğmesiyle dili değiştirebilirsin; yeni sayfalar ve içerikler iki dilde de gösterilir.", {}),
  E("mobile_app", ["mobil uygulama", "uygulama var mi", "android", "iphone", "ios", "telefondan", "app store", "play store"], "AYA'nın mobil uygulaması var: kayıt, giriş, sözleşme onayı, fotoğraf/video yükleme ve ders odasında sorun bildirme. Web sitesi de telefonda sorunsuz çalışır.", {}),
  E("is_safe", ["guvenli mi", "gizlilik", "verilerim guvende mi", "ders kaydini kim gorur", "kamera guvenligi"], "Güvenliğin bizim için önemli: ders kayıtlarını yalnızca eğitmen ve öğrenci indirebilir, 30 gün sonra silinir; sohbet ve içerikler bildirilebilir ve yöneticiler tarafından incelenir. Bildirdiğin kişi kimliğini göremez.", { links: [{ label: "Gizlilik", href: "/privacy" }, { label: "Raporlarım", href: "/dashboard/reports" }] }),
  E("chat_rules", ["sohbet kurallari", "yayin sohbeti", "yavas mod", "mesaj atamiyorum", "sohbet kapali", "kick", "atildim"], "Canlı yayın sohbetinde saygılı ol: hakaret, reklam ve spam yasaktır. Eğitmen **yavaş mod** açabilir (mesajlar arası bekleme) ya da sohbeti kapatabilir; kurala uymayanlar yayından çıkarılabilir. Uygunsuz bir mesajı yanındaki bayrakla bildirebilirsin.", { next: ["Sorun nasıl bildirilir?"] }),
  E("how_report", ["sorun nasil bildirilir", "nasil sikayet", "kullaniciyi bildirmek", "bildir butonu", "rahatsiz edici mesaj"], "Canlı yayında **\"Yayını bildir\"**, bir mesajın yanındaki **bayrak**, atölye/eğitmen sayfasındaki **\"Bildir\"** ve ders odasındaki **\"Sorun bildir\"** ile bildirim yapabilirsin. Durumu **Panel → Raporlarım**'de görürsün.", { links: [{ label: "Raporlarım", href: "/dashboard/reports" }] }),
  E("community_how", ["topluluk", "fotograf paylasmak", "fotograf yukle", "yorum yapmak", "begeni", "paylasim kurallari", "kufur yasak mi", "yorum silindi", "fotografim yayinlanmadi", "fotografim neden gorunmuyor"], "**Topluluk** sayfasında pratiğinden fotoğraf paylaşabilir, başkalarının fotoğraflarını beğenebilir ve yorum yapabilirsin. Küfür, hakaret, reklam ve iletişim bilgisi otomatik engellenir; tekrarında geçici susturma uygulanır. İlk fotoğrafların yönetici onayından geçer, yayınlandığında bildirim alırsın. Beğeni ve yorumlar da zil simgesine bildirim olarak düşer.", { links: [{ label: "Topluluk", href: "/community" }, { label: "Kurallar", href: "/community/rules" }, { label: "Bildirimler", href: "/dashboard/notifications" }] }),
  E("workshop_how", ["atolye nasil", "atolyeye nasil katilirim", "atolye kaydi", "yer ayirtmak", "atolye ucreti", "atolye nedir"], "**Atölyeler**, küçük gruplarla canlı ya da kayıtlı özel çalışmalardır. Atölye sayfasından yerini ayırırsın; ücretliyse eğitmen ödemeni onaylayınca katılımın kesinleşir ve canlı yayına/videoya erişirsin.", { links: [{ label: "Atölyeler", href: "/atolyeler" }], next: ["Ödeme yöntemleri neler?"] }),
  E("live_how", ["canli yayin nasil", "yayini nasil izlerim", "yayina nasil girerim", "canli yayin nedir", "yayin ucretli mi"], "**Canlı yayınlar** `Canlı Yayın` sayfasında listelenir; üye olup giriş yaptıktan sonra izleyebilir, sohbete katılabilirsin. Atölyeye bağlı yayınlar yalnızca o atölyenin onaylı katılımcılarına açıktır.", { links: [{ label: "Canlı yayınlar", href: "/live" }], next: ["Yayında kalite nasıl değişir?"] }),
  E("gamification", ["rozet", "puan", "seri", "gunluk seri", "basari", "sıralama", "siralama"], "Panelinde **günlük seri, puan ve rozetler** ilerlemeni gösterir; her tamamladığın dersle seri ve puan artar. Rozetleri açmak için düzenli pratik yap.", { links: [{ label: "Panelim", href: "/dashboard" }] }),
  E("contact_support", ["destek", "iletisim", "yetkili ile konusmak", "sikayetim var", "bize ulasin", "mail atmak", "canli destek", "insan ile konusmak"], "Bir yetkiliye ulaşmak için ders odasındaki ya da sayfadaki **Bildir/Sorun bildir** düğmesini kullan; mesajın yöneticilere iletilir ve **Raporlarım**'den takip edersin. Ben yardımcı olamadığımda en hızlı yol budur.", { links: [{ label: "Raporlarım", href: "/dashboard/reports" }] }),


  // ───────────── more small talk & everyday questions ─────────────
  E("what_doing", ["napiyorsun", "ne yapiyorsun", "ne var ne yok", "napiyon", "ne ariyorsun"], "Seninle sohbet edip doğru sayfayı bulmana yardım ediyorum 🙂 Sen ne yapıyorsun, bugün pratik yaptın mı?", { next: ["Kısa bir nefes egzersizi", "Bana ders öner"] }),
  E("motivation", ["motive et", "motivasyon", "motivasyonum yok", "pes etmek istiyorum", "yapamiyorum", "vazgecmek", "tembellik", "yoga yapmak icin istek yok", "ertelemek"], "Küçük başla: bugün sadece **5 dakika** matını ser, 3 uzun nefes al. Başlamak en zor kısımdır; çoğu zaman başlayınca devam edersin. Her gün yaptığın küçük pratik, ayda bir yaptığın uzun dersten güçlüdür. Sen yapabilirsin 💪", { next: ["5 dakikalık yoga öner", "Haftada kaç gün yoga yapmalı?"] }),
  E("no_time", ["vaktim yok", "zamanim yok", "5 dakikalik yoga", "kisa yoga", "hizli yoga", "kisa pratik", "10 dakika yoga"], "5 dakikada yapabileceklerin: **1)** ayakta kollarını yukarı uzat, öne eğil (5 nefes) **2)** kedi-inek (8 tur) **3)** çocuk duruşu (5 nefes) **4)** 1 dakika yavaş nefes. Her gün yapmak haftada bir uzun dersten iyidir.", { next: ["Kedi-inek duruşu nasıl yapılır?", "Çocuk duruşu nasıl yapılır?"] }),
  E("morning_routine", ["sabah rutini", "sabah akisi", "sabah yogasi rutini", "sabah ne yapmaliyim"], "Basit bir sabah akışı: 1 dk nefes → kedi-inek (8 tur) → aşağı bakan köpek (5 nefes) → öne eğiliş → dağ duruşu → **güneşe selam** 3 tur. Toplam 10-15 dakika; telefonu sonra aç.", { teachersFor: ["vinyasa", "hatha"], next: ["Güneşe selam nedir?"] }),
  E("evening_routine", ["aksam rutini", "yatmadan once", "uyumadan once yoga", "aksam rahatlama"], "Akşam için: ışıkları kıs → kelebik duruşu (2 dk) → bacakları duvara dayama (5 dk) → **4-7-8 nefesi** (4 tur) → şavasana. Ekran yok, sakin müzik olabilir.", { teachersFor: ["yin", "restorative"], next: ["4-7-8 nefesi nasıl yapılır?"] }),
  E("music", ["muzik", "hangi muzik", "yoga muzigi", "muzik oner", "calma listesi", "sessiz mi"], "Yoga müziği zorunlu değil. Akışlı derslerde ritmik/ambient, yin ve meditasyonda çok sakin müzik ya da doğa sesi iyi gider; dikkatini dağıtıyorsa **sessizlik** de güzeldir. Eğitmenin kendi seçimi dersin havasını belirler.", {}),
  E("religion", ["yoga din mi", "yoga dini mi", "yoga ibadet mi", "yoga haram mi", "yoga inanc", "yoga caiz mi", "inancima aykiri mi"], "Yoga bir din değil; kökeni Hint felsefesine dayansa da bugün çoğu kişi onu **beden, nefes ve zihin egzersizi** olarak yapar. Mantra, \"Om\" ya da felsefi kısımlar isteğe bağlıdır; sadece hareket ve nefesle de yapılabilir. Rahat hissetmediğin kısmı atlayabilirsin, eğitmene söylemen yeterli.", { next: ["Yoga nedir?"] }),
  E("is_sport", ["yoga spor mu", "yoga sayilir mi", "yoga yeterli mi", "yoga mi pilates mi", "yoga ve pilates", "yoga kardiyo", "yoga ve fitness"], "Yoga hem beden egzersizi hem zihin pratiğidir; güç, esneklik ve denge geliştirir. **Kardiyo** için vinyasa/power yoga yardımcı olur, ama yoğun kardiyo ihtiyacını tek başına karşılamayabilir. Pilates daha çok çekirdek (core) odaklıdır; ikisi birbirini tamamlar.", { teachersFor: ["vinyasa"] }),
  E("diet", ["beslenme", "vegan", "vejetaryen", "diyet", "ne yemeliyim", "yoga diyeti", "su icmek"], "Yoga için özel bir diyet şart değil. Dengeli beslen, derse hafif karınla gir, bol su iç. Vejetaryen/vegan olmak zorunda değilsin; bu kişisel bir tercih." + MED, {}),
  E("alcohol_smoking", ["sigara", "alkol", "kahve ve yoga", "kafein"], "Yoga sigarayı/alkolü bırakmayı kolaylaştırdığını söyleyenler çok; nefes çalışması isteği yönetmeye yardımcı olabilir. Ders öncesi alkolden kaçın; kahve içiyorsan yarım saat önce, az içmen daha rahat nefes almanı sağlar." + MED, {}),
  E("period", ["adet donemi", "regl", "regl doneminde yoga", "mensturasyon", "adet sirasinda"], "Regl döneminde yoga yapılabilir; çoğu kişi **yin, restoratif ve yumuşak** akışları rahat bulur. Ters duruşlardan (omuz/baş üstü) ve çok yoğun karın çalışmalarından kaçınmak yaygın bir tercihtir. Bedenini dinle." + MED, { teachersFor: ["restorative", "yin"] }),
  E("soreness", ["kaslarim agriyor", "yoga sonrasi agri", "yogadan sonra agri", "kas agrisi", "pegli", "agriyor yogadan sonra"], "Başlangıçta yogadan sonra hafif kas ağrısı normaldir (1-2 gün). Su iç, hafif yürü, sıcak duş al; yeni hareketlere kademeli geç. Keskin, eklemde ya da giderek artan ağrı varsa dur ve uzmana danış." + MED, {}),
  E("dizzy", ["basim donuyor", "yoga sonrasi bas donmesi", "gozum kararıyor", "gozum karariyor", "ayakta durunca"], "Baş dönmesi için hemen otur ya da yat, nefesi yavaşlat, su iç. Duruşlardan **yavaş** çık; nefes tutma. Sık oluyorsa ya da yüksek tansiyon/şeker sorunun varsa doktora danış." + MED, {}),
  E("eyes", ["gozler acik mi", "gozlerimi kapatmali miyim", "gozler kapali", "bakis noktasi", "drishti"], "Meditasyonda gözler kapalı ya da yarı açık olabilir; dengede ise sabit bir noktaya bak (**drishti**). Sıkıldığında ya da baş döndüğünde gözlerini açmak tamamen normaldir.", {}),
  E("breath_hold", ["nefes tutmak", "nefesimi tutuyorum", "nefes nasil alinir yogada", "burundan mi agizdan mi"], "Yogada nefes genelde **burundan** alınıp verilir ve **tutulmaz**; hareketin zorlaştığı yerde nefesin bozuluyorsa duruşu hafiflet. Genel kural: açılırken al, kapanırken ver.", { next: ["Nefes egzersizi öner"] }),
  E("choose_teacher", ["egitmen nasil secilir", "hangi egitmeni secmeliyim", "egitmen secimi", "iyi egitmen", "egitmen bulmak", "hocayi nasil secerim"], "Eğitmen seçerken **stile**, **seviyene**, **puana/yorumlara** ve tarzına bak; tanıtım videosu ve biyografi fikir verir. Emin değilsen yarı fiyatlı **deneme dersiyle** iki farklı eğitmeni karşılaştır.", { links: [{ label: "Eğitmenler", href: "/teachers" }], next: ["Eğitmen öner"] }),
  E("first_class", ["ilk derste ne beklemeliyim", "ilk ders nasil gecer", "derse hazirlik", "derse nasil hazirlanirim", "derse ne giyerim"], "İlk derste eğitmen seni tanır: hedefini, sağlık durumunu ve deneyimini sorar. Mat, su, rahat kıyafet ve sessiz bir köşe yeter; kamerayı açman iyi olur ki formunu görsün. Zorlanırsan duruşu hafiflet, dinlenmek serbest.", { next: ["Derse nasıl katılırım?", "Yoga için ne gerekir?"] }),
  E("wall_yoga", ["duvar yogasi", "duvarla yoga", "bacak duvara", "viparita karani"], "**Bacakları duvara dayama** (viparita karani): kalçanı duvara yaklaştır, sırt üstü yat, bacakları duvarda dik tut; 5-10 dk. Bacak yorgunluğunu ve gerginliği alır, uykuya iyi gelir. Gözlerin kapalı, nefes yavaş.", { next: ["Uyku için ne önerirsin?"] }),
  E("butterfly", ["kelebek durusu", "baddha konasana", "kelebek"], "**Kelebek**: oturup ayak tabanlarını birleştir, dizlerin yanlara açık; sırtını uzat, hafifçe öne eğil. Kalça ve iç bacağı açar. Dizler yüksekte kalıyorsa altlarına yastık koy.", {}),
  E("forward_fold", ["one egilme", "one egilis", "parmak ucuna", "uttanasana", "oturarak one egilme"], "**Öne eğiliş**: dizlerini yumuşat, karnını uyluğa yaklaştır, sırtı uzun tut; elin yere değmesi şart değil, blok ya da dizlerine tutun. Bacak arkasını esnetir, zihni sakinleştirir.", {}),
  E("twist", ["burgu", "burgu duruslari", "omurga burgusu", "sirt cevirmek"], "**Oturarak burgu**: dik otur, nefes alırken omurgayı uzat, verirken yavaşça bir yana dön; kalçalar yerde. Omurgayı ve sindirimi rahatlatır. Hamilelikte derin burgulardan kaçın.", {}),
  E("goals", ["hedef", "hedef belirleme", "niyet", "niyet belirleme", "sankalpa", "yoga hedefi"], "Pratiğe bir **niyet (sankalpa)** ile başla: kısa, olumlu bir cümle (\"sakinim\", \"kendime zaman ayırıyorum\"). Haftalık küçük bir hedef koy (ör. 3 ders) ve panelindeki **seri ve rozetlerle** takip et.", { links: [{ label: "Panelim", href: "/dashboard" }] }),
  E("journal", ["yoga gunlugu", "gunluk tutmak", "ilerleme takibi", "ilerlemeyi takip"], "Her dersten sonra 1-2 cümle yaz: nasıl hissettin, neyi zor buldun? Panelindeki seri, puan ve rozetler de ilerlemeni gösterir; haftalık bir bakış motivasyonu artırır.", { links: [{ label: "Panelim", href: "/dashboard" }] }),
  E("couple", ["cift yogasi", "partner yoga", "arkadasla yoga", "eşimle yoga", "esimle yoga"], "**Çift yogası** güveni ve iletişimi güçlendiren, oyuncu bir pratiktir: karşılıklı çekmeler, denge ve nefes eşleşmesi. Yeni başlayanlar basit duruşlarla başlamalı; birbirinizi zorlamayın.", {}),
  E("mat_choice", ["hangi mat", "mat nasil secilir", "kaymaz mat", "mat kalinligi", "mat onerisi"], "Başlangıç için **4-6 mm**, kaymaz yüzeyli bir mat yeterli; dizin hassassa biraz daha kalın olabilir. Kayıyorsan ıslak havlu ya da kaymaz havlu işe yarar.", { next: ["Yoga için ne gerekir?"] }),
  E("gratitude", ["sukran", "minnettarlik", "gratitude", "sukur"], "Minnettarlık pratiği: gün sonunda 3 şeyi yaz ya da içinden say; nefes verirken \"teşekkür ederim\" demeyi dene. Küçük ama sinir sistemini yumuşatan bir alışkanlık.", {}),

  // ───────────── English basics ─────────────
  E("en_hello", ["hello", "hi there", "hey there", "good morning", "good evening", "howdy"], "Hello! I'm **AYA Guide**. I can recommend teachers, workshops and live streams, explain yoga and breathing basics, or help with sign-up. What are you looking for?", { lang: "en", next: ["What is yoga?", "Find me a teacher", "How do I sign up?"] }),
  E("en_how_are_you", ["how are you", "how's it going", "how are things"], "I'm doing well, thank you! How about you? I can suggest a short breathing exercise or a class if you like.", { lang: "en", next: ["Short breathing exercise", "Find me a teacher"] }),
  E("en_who", ["who are you", "what are you", "your name", "are you a bot", "are you human"], "I'm **AYA Guide**, a helper built into this site. I'm not a person; I answer questions about yoga, breathing, meditation and AYA, and point you to the right page.", { lang: "en" }),
  E("en_help", ["what can you do", "help me", "how can you help"], "I can recommend teachers, workshops and live streams, explain yoga styles and poses, guide short breathing and meditation exercises, and answer questions about accounts, payments and recordings.", { lang: "en", next: ["What is yoga?", "Breathing exercise"] }),
  E("en_yoga", ["what is yoga", "about yoga", "explain yoga"], "**Yoga** combines postures, breathing and meditation. It builds flexibility, strength and balance while calming the mind, and there are gentle versions for every age and level.", { lang: "en", next: ["Yoga styles", "Find me a teacher"] }),
  E("en_styles", ["yoga styles", "types of yoga", "which yoga", "different yoga"], "Main styles: **Hatha** (slow, basics), **Vinyasa** (flowing), **Yin** (long deep stretches), **Ashtanga** (strong fixed series), **Restorative** (supported rest), **Yoga Nidra** (guided relaxation).", { lang: "en", teachersFor: ["hatha"] }),
  E("en_breath", ["breathing exercise", "short breathing", "breathe", "box breathing", "calm down"], "Try this: breathe in through your nose for 4 seconds, out slowly for 6. Repeat for two minutes, shoulders relaxed. A longer exhale calms the nervous system.", { lang: "en" }),
  E("en_signup", ["how do i sign up", "join", "register", "create account", "sign up"], "Membership is free: sign up with e-mail or Google in about a minute. You'll confirm the terms when you register.", { lang: "en", links: [{ label: "Join for free", href: "/login?mode=register" }] }),
  E("en_thanks", ["thank you", "thanks", "cheers", "appreciate it"], "You're welcome! Ask me anything else any time. 🙏", { lang: "en" }),
  E("en_bye", ["goodbye", "see you", "bye bye", "talk later"], "Take care! I'm here whenever you need me. 🙏", { lang: "en" }),
]

/** Words that signal real distress: answered first, with care, never with a sales link. */
export const CRISIS_KEYS = ["intihar", "kendimi oldur", "kendime zarar", "yasamak istemiyorum", "olmek istiyorum", "hayatima son", "kendimi asacagim", "kendimi kesiyorum", "suicide", "kill myself", "end my life", "self harm"]

export const CRISIS_REPLY =
  "Bunu paylaştığın için teşekkür ederim; yalnız değilsin ve önemlisin 🤍 Şu an kendine zarar verme düşüncen varsa lütfen **hemen 112 Acil'i ara** ya da güvendiğin biriyle (aile, arkadaş) konuş. Aile ve Sosyal Hizmetler **ALO 183** hattı da destek verir. Ben bir yazılımım ve bu durumda sana gerçek bir insan desteği lazım. Hazır olunca yavaşça nefes alıp vermeyi birlikte deneyebiliriz."

// ───────────── matcher ─────────────

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Does this query word satisfy this key word? Prefix match; one typo allowed for words of 6+ letters. */
export function wordMatches(queryWord: string, keyWord: string): boolean {
  if (queryWord === keyWord) return true
  if (keyWord.length >= 4 && queryWord.startsWith(keyWord)) return true
  if (keyWord.length >= 6) {
    if (editDistanceAtMost1(queryWord.slice(0, keyWord.length), keyWord)) return true
    if (editDistanceAtMost1(queryWord.slice(0, keyWord.length + 1), keyWord)) return true
  }
  return false
}

/** Fold to ASCII exactly like ai-guide's normalize (kept local to avoid a circular import). */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "i")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const PREP = KNOWLEDGE.map((e) => ({ e, keys: e.keys.map((k) => fold(k).split(" ").filter(Boolean)) }))

/** Chat shorthand people really type. */
const SLANG: Record<string, string> = {
  slm: "selam", mrb: "merhaba", nbr: "naber", nslsn: "nasilsin", nasilsn: "nasilsin", tsk: "tesekkurler", tskler: "tesekkurler", sagol: "tesekkurler", eyw: "eyvallah",
  napiyon: "napiyorsun", napiyom: "napiyorum", gn: "gunaydin", ig: "iyi geceler", yok: "yok", hic: "hic", bnm: "benim", bi: "bir", yardim: "yardim",
}

export interface Match {
  entry: KnowledgeEntry
  score: number
}

/** Best entry for a message, or null. A phrase scores 3 per word; an entry scores its best phrase plus a little for extra hits. */
export function matchKnowledge(message: string, minScore = 3): Match | null {
  const words = fold(message).split(" ").map((w) => SLANG[w] ?? w).flatMap((w) => (w.includes("-") ? [w, ...w.split("-")] : [w])).filter(Boolean)
  if (!words.length) return null
  let best: Match | null = null
  for (const { e, keys } of PREP) {
    if (e.shortOnly && words.length > 2) continue
    let top = 0
    let hits = 0
    for (const phrase of keys) {
      if (phrase.every((kw) => words.some((qw) => wordMatches(qw, kw)))) {
        // longer phrases and longer words are more specific
        const score = phrase.reduce((s, kw) => s + (kw.length >= 4 ? 3 : 1), 0) + (phrase.length > 1 ? 2 : 0)
        top = Math.max(top, score)
        hits++
      }
    }
    const score = top + Math.min(hits - 1, 2)
    if (top > 0 && (!best || score > best.score)) best = { entry: e, score }
  }
  return best && best.score >= minScore ? best : null
}

export function isCrisis(message: string): boolean {
  const f = fold(message)
  return CRISIS_KEYS.some((k) => f.includes(fold(k)))
}
