/**
 * AYA pose library: original descriptions written for this site (Turkish), illustrated with our own 3D character
 * (see scripts/render-poses and src/lib/pose-rigs.ts). General wellness information, not medical advice.
 */
export type PoseLevel = "Başlangıç" | "Orta" | "İleri"
export type PoseCategory = "Ayakta" | "Oturarak" | "Öne eğilme" | "Geriye eğilme" | "Denge" | "Dinlenme" | "Ters ve güç"

export interface YogaPose {
  slug: string
  name: string
  english: string
  sanskrit: string
  category: PoseCategory
  level: PoseLevel
  /** how long to stay, in breaths */
  hold: string
  /** one-sentence teaser */
  summary: string
  intro: string
  benefits: string[]
  steps: string[]
  breath: string
  focus: string[]
  avoid: string[]
  easier: string
  harder: string
  counter: string[]
  /** styles (see yoga-styles.ts) in which the pose is common */
  styles: string[]
}

export const POSE_CATEGORIES: PoseCategory[] = ["Ayakta", "Oturarak", "Öne eğilme", "Geriye eğilme", "Denge", "Dinlenme", "Ters ve güç"]
export const POSE_LEVELS: PoseLevel[] = ["Başlangıç", "Orta", "İleri"]

export const POSES: YogaPose[] = [
  {
    slug: "dag-durusu", name: "Dağ Duruşu", english: "Mountain Pose", sanskrit: "Tadasana", category: "Ayakta", level: "Başlangıç", hold: "5–10 nefes",
    summary: "Tüm ayakta duruşların temeli: sağlam, uzun ve sakin bir duruş.",
    intro: "Dağ Duruşu basit görünür ama ayaklarından tepene kadar tüm bedeni hizalamayı öğretir. Her akışa buradan başlar, buradan dinlenirsin; günlük hayattaki duruşunu fark etmenin en kolay yolu da budur.",
    benefits: ["Duruşu ve omurga hizasını geliştirir", "Bacak ve karın kaslarını hafifçe çalıştırır", "Dengeyi ve beden farkındalığını artırır", "Sinir sistemini yatıştırır, odaklanmayı kolaylaştırır"],
    steps: ["Ayaklarını kalça genişliğinde ya da birleşik koy; ağırlığı iki ayağa eşit dağıt.", "Ayak parmaklarını açıp yere yay, dizlerini kilitlemeden hafifçe yumuşat.", "Kuyruk sokumunu hafifçe aşağı doğru uzat, karnını nazikçe içeri çek.", "Omuzlarını geriye ve aşağı bırak, göğsünü aç.", "Başının tepesinden tavana doğru uzandığını hayal et, çeneni yere paralel tut.", "Avuçların bir arada göğüs hizasında ya da kollar yanlarda; yumuşak bir nefes al."],
    breath: "Burundan yavaş ve derin; nefes alırken boyun uzar, verirken omuzlar yerleşir.",
    focus: ["Ayak tabanları", "Kalça hizası", "Omurga"], avoid: ["Baş dönmesi yaşıyorsan gözlerini sabit bir noktaya odakla ya da duvarın yanında dur."],
    easier: "Sırtını duvara dayayıp ayaklarını duvardan bir adım uzakta tut.", harder: "Gözlerini kapat ya da topukları kaldırıp parmak uçlarında dengelen.",
    counter: ["one-egilme"], styles: ["hatha", "vinyasa"],
  },
  {
    slug: "ayakta-yukari-uzanis", name: "Yukarı Selam", english: "Upward Salute", sanskrit: "Urdhva Hastasana", category: "Ayakta", level: "Başlangıç", hold: "3–5 nefes",
    summary: "Kolları yukarı uzatarak omurgayı ve yan gövdeyi uzatan enerji verici bir duruş.",
    intro: "Güneşe Selam serilerinin açılışı olan bu duruş, sabah bedenini uyandırmanın en güzel yollarından biri. Kollar yükselirken göğüs açılır, nefes derinleşir.",
    benefits: ["Omuz, göğüs ve yan gövdeyi açar", "Omurgayı uzatır", "Enerjiyi artırır, sabah ağırlığını atar", "Nefes kapasitesini genişletir"],
    steps: ["Dağ Duruşu'nda dur.", "Nefes alırken kollarını yanlardan geniş bir yayla yukarı kaldır.", "Avuçlarını birbirine bak ya da birleştir; omuzlarını kulaklarından uzak tut.", "Kuyruk sokumunu hafif içe al, bel çukurunu aşırı çökertme.", "Bakışını başparmaklarına ya da öne sabitle; birkaç nefes kal.", "Nefes verirken kolları yanlardan indir."],
    breath: "Kollar yükselirken nefes al, inerken ver.", focus: ["Omuz hattı", "Yan gövde", "Bel hizası"], avoid: ["Omuz sorunun varsa kollarını omuz genişliğinde, paralel tut.", "Boynunu geriye kırma."],
    easier: "Kollarını yalnızca omuz hizasına kadar kaldır.", harder: "Hafif bir geriye esnemeyle göğsünü tavana aç.", counter: ["one-egilme"], styles: ["hatha", "vinyasa"],
  },
  {
    slug: "savasci-1", name: "Savaşçı I", english: "Warrior I", sanskrit: "Virabhadrasana I", category: "Ayakta", level: "Başlangıç", hold: "5 nefes (her yan)",
    summary: "Güçlü bir bacak duruşu ile yükselen kollar: kararlılık ve açıklık.",
    intro: "Savaşçı I bacakları güçlendirirken göğsü ve kalça önünü açar. Ön diz bükülürken arka bacak sağlam kalır; bu zıtlık hem güç hem esneklik öğretir.",
    benefits: ["Bacak ve kalçayı güçlendirir", "Kalça fleksörlerini ve göğsü açar", "Dengeyi ve dayanıklılığı artırır", "Özgüven ve kararlılık hissi verir"],
    steps: ["Dağ Duruşu'ndan sağ ayağınla büyük bir adım geriye at.", "Arka ayağını yaklaşık 45° dışa çevir, topuğu yere bastır.", "Ön dizini topukla aynı hizada olacak biçimde 90°'ye doğru bük.", "Kalçalarını öne bakacak şekilde hizala.", "Nefes alırken kollarını yukarı uzat, avuçlar birleşsin ya da paralel kalsın.", "Birkaç nefes sonra ayaklarını birleştir ve diğer yanla tekrarla."],
    breath: "Kollar yükselirken nefes al; pozda uzun ve eşit nefeslerle kal.", focus: ["Ön diz hizası", "Arka topuk", "Kalça önü"], avoid: ["Diz sorunun varsa dizini 90°'ye kadar bükme.", "Tansiyonun yüksekse kollarını yukarıda tutmak yerine kalçana koy."],
    easier: "Adımı kısalt, kollarını kalçana koy.", harder: "Kollarını yukarı uzatıp hafifçe geriye esne.", counter: ["savasci-2", "one-egilme"], styles: ["hatha", "vinyasa"],
  },
  {
    slug: "savasci-2", name: "Savaşçı II", english: "Warrior II", sanskrit: "Virabhadrasana II", category: "Ayakta", level: "Başlangıç", hold: "5–8 nefes (her yan)",
    summary: "Geniş bir duruşta açık kollar: bacaklarda güç, omuzlarda hafiflik.",
    intro: "Savaşçı II dayanıklılık kazandırır. Alt beden yere sağlam basarken üst beden hafif ve açık kalır; odaklanmayı ve sabrı geliştirmek için ideal bir duruştur.",
    benefits: ["Uyluk ve kalçayı güçlendirir", "İç bacak ve kasıkları açar", "Omuz ve göğüs kaslarını çalıştırır", "Dayanıklılığı ve odağı artırır"],
    steps: ["Bacaklarını yaklaşık bir bacak boyu açarak geniş duruşa gel.", "Sağ ayağını dışa 90°, sol ayağı hafifçe içe çevir.", "Sağ dizini bük; diz ayak bileğinin üzerinde, ikinci ve üçüncü parmak hizasında kalsın.", "Kollarını omuz hizasında iki yana uzat, avuçlar aşağı baksın.", "Gövdeyi iki bacağın ortasında dik tut, omuzları kalçanın üzerinde topla.", "Bakışını ön elinin ötesine sabitle; birkaç nefesten sonra yan değiştir."],
    breath: "Düzenli ve derin; her nefeste omurgayı biraz daha uzat.", focus: ["Ön diz hizası", "Omuzlar", "Bakış noktası"], avoid: ["Diz ya da kalça ağrısında bükülmeyi azalt.", "Dizini ayak parmaklarının önüne taşıma."],
    easier: "Duruşu daralt, bükülmeyi azalt; elini duvara yaslayabilirsin.", harder: "Ön dizi daha derin bük ve kolları daha uzun süre havada tut.", counter: ["ucgen", "one-egilme"], styles: ["hatha", "vinyasa", "ashtanga"],
  },
  {
    slug: "ucgen", name: "Üçgen", english: "Triangle Pose", sanskrit: "Trikonasana", category: "Ayakta", level: "Orta", hold: "5 nefes (her yan)",
    summary: "Yana uzanan, bacak arkasını ve yan gövdeyi açan geniş bir duruş.",
    intro: "Üçgen duruşu bedenin yan hattını uzatır. Bacaklar sabit, gövde yana uzanırken omurga uzun kalır; doğru yapıldığında hem esnetir hem hizalar.",
    benefits: ["Bacak arkası ve kasıkları esnetir", "Yan gövdeyi ve omurgayı uzatır", "Kalça ve omuzları açar", "Sindirimi destekler, bedeni canlandırır"],
    steps: ["Savaşçı II'deki gibi geniş duruşa gel; bacaklarını düzelt.", "Ön ayağın üzerinde kalçayı geriye iterek gövdeyi öne uzat.", "Ön elini bacağının dış tarafına (kaval, ayak bileği ya da blok) koy.", "Arka kolunu tavana uzat; iki kol bir çizgi oluştursun.", "Göğsünü tavana doğru aç, boynunu rahat tut.", "Nefes alıp doğrulurken kolunu kaldır, yan değiştir."],
    breath: "Uzayarak nefes al, yan gövdeyi açarak ver.", focus: ["Yan gövde", "Bacak arkası", "Göğüs açıklığı"], avoid: ["Düşük tansiyon ya da boyun sorununda başını nötr tut, yukarı bakma."],
    easier: "Elini kaval kemiğine ya da bir yoga bloğuna koy.", harder: "Elini ayağının önüne taşı ve bakışını yukarı çevir.", counter: ["dag-durusu"], styles: ["hatha", "vinyasa"],
  },
  {
    slug: "agac", name: "Ağaç", english: "Tree Pose", sanskrit: "Vrksasana", category: "Denge", level: "Başlangıç", hold: "5–8 nefes (her yan)",
    summary: "Tek ayak üzerinde dengelenirken sakinleşen ve odaklanan bir duruş.",
    intro: "Ağaç duruşu denge ve odak için klasiktir. Kök salan ayak ve yükselen kollar, hem fiziksel hem zihinsel bir dengeyi simgeler. Sallanman normaldir; asıl pratik, sakin kalmaktır.",
    benefits: ["Ayak bileği ve bacak kaslarını güçlendirir", "Dengeyi ve konsantrasyonu geliştirir", "Kalçayı açar", "Zihni sakinleştirir"],
    steps: ["Dağ Duruşu'nda dur, ağırlığını sağ ayağa ver.", "Sol dizini bükerek tabanını sağ baldırın ya da iç uyluğunun üzerine yerleştir (diz üzerine değil).", "Kalçanı hizada tut, sol dizi yana açık kalsın.", "Gözlerini sabit bir noktaya odakla.", "Avuçlarını göğüste birleştir ya da kollarını yukarı uzat.", "Birkaç nefesten sonra yavaşça indir ve diğer yanı dene."],
    breath: "Düzgün ve yumuşak; dengeni kaybedersen nefesi uzat.", focus: ["Duran ayak", "Bakış noktası", "Kalça hizası"], avoid: ["Ayağı asla diz kapağının üzerine koyma.", "Denge sorunun varsa duvara yakın dur."],
    easier: "Ayağını ayak bileğinin yanına koy, parmak ucu yerde kalsın.", harder: "Gözlerini kapat ya da kolları başın üzerinde sallandır.", counter: ["one-egilme"], styles: ["hatha"],
  },
  {
    slug: "sandalye", name: "Sandalye", english: "Chair Pose", sanskrit: "Utkatasana", category: "Ayakta", level: "Başlangıç", hold: "5–8 nefes",
    summary: "Görünmez bir sandalyeye oturur gibi bükülen, bacakları ateşleyen güçlü duruş.",
    intro: "Sandalye duruşu kısa sürede ısındırır. Uyluk ve kalçayı çalıştırırken kollar yükselir; zorlandığında bile nefesi düzenli tutmak bu duruşun asıl dersidir.",
    benefits: ["Uyluk, kalça ve baldır kaslarını güçlendirir", "Omurgayı destekleyen kasları çalıştırır", "Kalp atışını hızlandırır, ısıtır", "Direnç ve odak kazandırır"],
    steps: ["Ayaklarını birleşik ya da kalça genişliğinde koy.", "Nefes verirken dizlerini bükerek kalçanı geriye oturt.", "Dizler ayak parmaklarını geçmesin; ağırlık topuklarda kalsın.", "Kollarını kulaklarının yanından yukarı uzat.", "Karnını hafifçe içeri çek, sırtını uzun tut.", "Birkaç nefes sonra bacaklarını düzelterek doğrul."],
    breath: "Nefes alırken omurgayı uzat, verirken biraz daha derinleş.", focus: ["Topuklar", "Kuyruk sokumu", "Omuz hattı"], avoid: ["Diz ağrısında bükülmeyi azalt.", "Bel çukurunu çökertme; kuyruk sokumunu uzat."],
    easier: "Daha az bük, kollarını kalçana koy.", harder: "Daha derin otur, kollarını yukarıda tut ya da gövdeyi hafif bük.", counter: ["one-egilme"], styles: ["hatha", "vinyasa"],
  },
  {
    slug: "one-egilme", name: "Ayakta Öne Eğilme", english: "Standing Forward Fold", sanskrit: "Uttanasana", category: "Öne eğilme", level: "Başlangıç", hold: "5–10 nefes",
    summary: "Bacak arkasını ve sırtı uzatan, zihni yatıştıran ters bir sarkma.",
    intro: "Öne eğilme omurgayı rahatlatır ve baş kalbin altına geldiği için sakinleştirici etkisi vardır. Esnekliğin sınırına zorlamak yerine yerçekimine teslim olmak amaçtır.",
    benefits: ["Bacak arkasını, bel ve sırtı esnetir", "Sinir sistemini yatıştırır, stresi azaltır", "Kan dolaşımını destekler", "Boyun ve omuz gerginliğini bırakır"],
    steps: ["Dağ Duruşu'nda dur, ayaklar kalça genişliğinde.", "Nefes verirken kalçadan öne doğru eğil; sırtı uzun tut.", "Dizlerini yumuşat; bu bel ve bacak arkasını korur.", "Ellerini yere, bloklara ya da dirseklerini tutarak sarkıt.", "Başını ve boynunu tamamen serbest bırak.", "Çıkarken karnını içeri çekip sırtı uzun tutarak yavaşça doğrul."],
    breath: "Her nefes verişte biraz daha sal, almada omurgayı uzat.", focus: ["Bacak arkası", "Boyun gevşekliği", "Kalça hattı"], avoid: ["Bel fıtığı ya da yüksek göz tansiyonunda dizlerini bükerek ve yavaşça yap.", "Hızlı kalkma, baş dönebilir."],
    easier: "Dizlerini bol bük, ellerini bloğa koy.", harder: "Bacakları düzleştir, avuçlarını ayakların yanına bastır.", counter: ["dag-durusu"], styles: ["hatha", "vinyasa", "yin"],
  },
  {
    slug: "asagi-bakan-kopek", name: "Aşağı Bakan Köpek", english: "Downward-Facing Dog", sanskrit: "Adho Mukha Svanasana", category: "Ters ve güç", level: "Başlangıç", hold: "5–8 nefes",
    summary: "Ters V şeklinde: omuzları, bacak arkasını ve tüm sırtı uzatan yoga klasiği.",
    intro: "Hem güçlendiren hem esneten nadir duruşlardandır. Eller ve ayaklar yerde, kalçalar yukarıdayken omurga uzar; vinyasa akışlarında dinlenme ve geçiş noktasıdır.",
    benefits: ["Omuz, kol ve sırtı güçlendirir", "Bacak arkası ve baldırları esnetir", "Omurgayı uzatır", "Hafif ters etkisiyle zihni ferahlatır"],
    steps: ["Dört ayak üzerinde başla; eller omuzların biraz önünde, parmaklar açık.", "Parmak uçlarını kıvırıp kalçanı yukarı ve geriye kaldır.", "Dizlerini bükük tutarak önce omurgayı uzat, sonra bacakları düzelt.", "Avuçlarını yere bastır, omuzları kulaklardan uzaklaştır.", "Topukların yere doğru gitmesine izin ver, zorlamadan.", "Başını kollarının arasında rahat bırak; birkaç nefesten sonra dizlere in."],
    breath: "Derin ve eşit; her nefeste kalçanı biraz daha yukarı ve geriye gönder.", focus: ["Avuç içi basıncı", "Omurga uzunluğu", "Kalça yüksekliği"], avoid: ["Bilek ağrısında yumruk ya da bilek altına havlu kullan.", "Yüksek tansiyon ya da göz basıncında kısa kal."],
    easier: "Dizleri bükük tut, topukları kaldır.", harder: "Bir bacağı havaya kaldır ya da topukları yere bastır.", counter: ["cocuk"], styles: ["hatha", "vinyasa", "ashtanga"],
  },
  {
    slug: "cocuk", name: "Çocuk Pozu", english: "Child's Pose", sanskrit: "Balasana", category: "Dinlenme", level: "Başlangıç", hold: "5–15 nefes",
    summary: "Tüm gerilimi bırakıp dinlendiğin güvenli liman.",
    intro: "Çocuk Pozu bir akışın ortasında dinlenmek için en sevilen duruştur. Alnın yere değer, kalçan topuklarına yaklaşır; dünya bir an için sessizleşir.",
    benefits: ["Bel, kalça ve uyluk gerginliğini bırakır", "Omurgayı nazikçe uzatır", "Sinir sistemini yatıştırır", "Nefesi derinleştirir"],
    steps: ["Dizlerinin üzerine otur, büyük ayak parmakları birbirine değsin.", "Dizlerini kalça genişliğinde ya da biraz daha geniş aç.", "Nefes verirken gövdeni uyluklarının arasına ya da üzerine sar.", "Kollarını öne uzat ya da yanlara bırak.", "Alnını yere ya da bir yastığa koy.", "Nefesini sırtına ve beline doğru gönder."],
    breath: "Yavaş ve derin; her verişte biraz daha yerleş.", focus: ["Bel gevşekliği", "Alın desteği", "Karın nefesi"], avoid: ["Diz ağrısında altına battaniye koy.", "Hamileliğin ilerleyen döneminde dizleri geniş aç."],
    easier: "Kalçanın altına yastık ya da blok koy.", harder: "Kollarını öne uzatıp avuçlarla yere bastırarak omuzları da aç.", counter: ["asagi-bakan-kopek", "sfenks"], styles: ["yin", "hatha", "restoratif"],
  },
  {
    slug: "sfenks", name: "Sfenks", english: "Sphinx Pose", sanskrit: "Salamba Bhujangasana", category: "Geriye eğilme", level: "Başlangıç", hold: "5–10 nefes",
    summary: "Kobra'nın nazik hali: önkolların üstünde göğsü açan hafif bir geriye esneme.",
    intro: "Sfenks, geriye esnemeye alışmak için güvenli bir başlangıçtır. Dirsekler omuzların altında, göğüs hafifçe kalkar; bel yük almadan omurga doğal eğrisini bulur.",
    benefits: ["Omurgayı nazikçe geriye esnetir", "Göğüs ve omuz önünü açar", "Sırt kaslarını güçlendirir", "Karın organlarını hafifçe uyarır"],
    steps: ["Yüzüstü uzan, bacaklar kalça genişliğinde uzak.", "Önkollarını yere koy; dirsekler omuzların tam altında.", "Nefes alırken göğsünü yerden kaldır, omuzlar kulaklardan uzak.", "Pubis kemiğini yere bastır, kalçayı hafifçe sık.", "Boynunu uzun tut, bakışını hafifçe önde bir noktaya çevir.", "Nefes verirken yavaşça yere in."],
    breath: "Alırken göğsü uzat, verirken omuzları geriye yerleştir.", focus: ["Dirseklerin yeri", "Pubis basıncı", "Boyun uzunluğu"], avoid: ["Hamilelikte ya da bel ağrısı artıyorsa bu duruştan kaçın.", "Belde sıkışma hissedersen yüksekliği azalt."],
    easier: "Dirsekleri öne al, göğsü daha az kaldır.", harder: "Avuçlarını yere bastırıp kollarını düzelterek tam Kobra'ya geç.", counter: ["cocuk"], styles: ["hatha", "vinyasa", "yin"],
  },
  {
    slug: "kolay-oturus", name: "Kolay Oturuş", english: "Easy Pose", sanskrit: "Sukhasana", category: "Oturarak", level: "Başlangıç", hold: "1–10 dakika",
    summary: "Meditasyon ve nefes çalışmaları için rahat, çapraz bacaklı oturuş.",
    intro: "Sukhasana, \"rahat, neşeli duruş\" demektir. Meditasyonun, nefes egzersizlerinin ve sessiz anların başlangıç noktasıdır. Kalçalar dizlerden biraz yüksekte olunca omurga kendiliğinden uzar.",
    benefits: ["Kalçayı ve kasıkları nazikçe açar", "Omurgayı dik tutmayı öğretir", "Zihni sakinleştirir, odaklanmayı kolaylaştırır", "Nefes ve meditasyon için sağlam bir taban verir"],
    steps: ["Yere ya da katlanmış bir battaniyenin üzerine otur.", "Bacaklarını çapraz yap; ayak bilekleri dizlerin altında kalsın.", "Kalçanı dizlerinden biraz yüksekte tut; gerekirse bir yastık kullan.", "Elleri dizlere koy, avuçlar yukarı ya da aşağı.", "Omurgayı uzat, omuzları gevşet, çeneni hafifçe içeri al.", "Gözlerini kapat ve nefesine odaklan."],
    breath: "Doğal ve yavaş; burundan alıp burundan ver.", focus: ["Oturma kemikleri", "Omurga uzunluğu", "Omuz gevşekliği"], avoid: ["Diz ağrısı varsa dizlerin altına destek koy ya da sandalyede otur."],
    easier: "Kalçanın altına kalın bir yastık koy.", harder: "Ayaklarını karşı uylukların üzerine taşıyarak Lotus'a ilerle (yalnızca esnekliğin elveriyorsa).", counter: ["kayik"], styles: ["hatha", "yin", "meditasyon"],
  },
  {
    slug: "savasana", name: "Savasana", english: "Corpse Pose", sanskrit: "Śavāsana", category: "Dinlenme", level: "Başlangıç", hold: "5–15 dakika",
    summary: "Seansın sonundaki derin dinlenme: bedeni bırak, pratiği içine yerleştir.",
    intro: "Savasana, yogadaki en önemli ve en zor duruş sayılır, çünkü hiçbir şey yapmamayı gerektirir. Beden ve zihin pratiğin etkilerini bu sessiz dinlenmede özümser.",
    benefits: ["Derin gevşeme sağlar, stresi azaltır", "Kalp atışını ve nefesi yavaşlatır", "Pratiğin faydalarını bedene yerleştirir", "Uyku kalitesini destekler"],
    steps: ["Sırt üstü uzan, bacakları rahatça iki yana aç.", "Kollarını gövdenden biraz uzak, avuçlar yukarı bırak.", "Omuzlarını ve çeneni gevşet, gözlerini kapat.", "Nefesini kontrol etmeyi bırak, doğal akışını izle.", "Bedeninin yere ağırlaştığını hisset.", "Çıkarken önce parmaklarını kıpırdat, sonra yana dönüp yavaşça doğrul."],
    breath: "Doğal; müdahale etme, yalnızca izle.", focus: ["Tüm beden", "Çene gevşekliği", "Nefesin akışı"], avoid: ["Belin rahatsızsa dizlerinin altına yastık koy.", "Hamilelikte ilerleyen dönemde sırt üstü yerine yan yat."],
    easier: "Dizlerinin altına yastık, başının altına ince bir battaniye koy.", harder: "Gözlerin kapalı, zihnini bir body-scan ile bedende gezdir.", counter: ["kolay-oturus"], styles: ["hatha", "yin", "restoratif", "meditasyon"],
  },
  {
    slug: "kopru", name: "Köprü", english: "Bridge Pose", sanskrit: "Setu Bandha Sarvangasana", category: "Geriye eğilme", level: "Başlangıç", hold: "5–8 nefes",
    summary: "Sırt üstü yatarken kalçayı kaldırarak sırtı ve bacak arkasını güçlendiren duruş.",
    intro: "Köprü, güçlenmek ve göğsü açmak için güvenli bir geriye esnemedir. Kalça ve bacak arkası çalışırken omurga yumuşakça kıvrılır; günün stresini atmak için de güzeldir.",
    benefits: ["Kalça, bacak arkası ve sırt kaslarını güçlendirir", "Göğüs ve kalça önünü açar", "Omurgayı destekler", "Hafif sakinleştirici etkisi vardır"],
    steps: ["Sırt üstü yat, dizlerini bük, ayaklar kalça genişliğinde ve kalçaya yakın.", "Kollarını yanlarında yere uzat, avuçlar aşağı.", "Nefes alırken ayakların üzerinden bastırıp kalçanı kaldır.", "Dizlerin ayak bileği üzerinde, birbirine paralel kalsın.", "Omuz kürek kemiklerini birbirine yaklaştır, göğsünü çene yönüne aç.", "Nefes verirken omurgayı yavaş yavaş yere bırak."],
    breath: "Kaldırırken nefes al, pozda derin ve düzenli; inerken ver.", focus: ["Kalça kasları", "Ayak basıncı", "Boyun rahatlığı"], avoid: ["Boyun sorununda başını çevirme, çeneni göğse yapıştırma.", "Bel ağrında kaldırma yüksekliğini azalt."],
    easier: "Kalçanın altına blok koy ve destekle kal.", harder: "Ellerini kalçanın altında kenetle ya da bir bacağı havaya al.", counter: ["savasana"], styles: ["hatha", "vinyasa", "restoratif"],
  },
  {
    slug: "malasana", name: "Çömelme", english: "Garland Pose", sanskrit: "Malasana", category: "Oturarak", level: "Orta", hold: "5–8 nefes",
    summary: "Derin çömelme: kalçayı, kasıkları ve ayak bileklerini açan doğal bir duruş.",
    intro: "Malasana, çocukların kendiliğinden yaptığı derin çömelmedir. Modern yaşamda oturmaktan kısalan kalça ve kasıkları geri kazandırır; sindirimi destekleyen bir duruş olarak da bilinir.",
    benefits: ["Kalça, kasık ve ayak bileği hareketliliğini artırır", "Alt sırtı uzatır", "Alt karın ve sindirim bölgesini uyarır", "Bacak ve karın kaslarını çalıştırır"],
    steps: ["Ayaklarını minderin genişliğinde aç, parmaklar hafifçe dışa baksın.", "Dizlerini bükerek kalçanı yere doğru indir.", "Dirseklerini dizlerin iç tarafına koy, avuçları göğüste birleştir.", "Göğsünü kaldır, omurgayı uzun tut.", "Topuklar yere basmıyorsa altlarına bir havlu koy.", "Birkaç nefes sonra ellerini yere koyup yavaşça doğrul."],
    breath: "Derin karın nefesi; her verişte kalça biraz daha yerleşsin.", focus: ["Kalça açıklığı", "Göğüs yüksekliği", "Ayak bileği"], avoid: ["Diz sorunlarında derinliği azalt.", "Hamileliğin sonunda doktoruna danış."],
    easier: "Topuklarının altına havlu ya da kalçanın altına blok koy.", harder: "Kollarını dizlerin önünden dolaştırıp sırtta kenetle.", counter: ["one-egilme"], styles: ["hatha", "yin"],
  },
  {
    slug: "kayik", name: "Tekne", english: "Boat Pose", sanskrit: "Navasana", category: "Ters ve güç", level: "Orta", hold: "3–5 nefes",
    summary: "Kalçalarda dengelenen V şekli: karın ve karın kaslarını ateşleyen güç duruşu.",
    intro: "Tekne duruşu karın ve kalça fleksörlerini hedefler. Dengede kalmak için sırt uzun, göğüs açık kalmalı; küçük sallanmalar güçlendikçe azalır.",
    benefits: ["Karın ve karın kaslarını güçlendirir", "Kalça fleksörlerini ve omurga kaslarını çalıştırır", "Dengeyi geliştirir", "Odak ve kararlılık gerektirir"],
    steps: ["Dizlerin bükük, ayaklar yerde otur; ellerini uyluk arkasına koy.", "Göğsünü kaldır, omurgayı uzat ve hafifçe geriye eğil.", "Ayaklarını yerden kaldır; kaval kemikleri yere paralel olsun.", "Dengeni bulunca kollarını öne, bacaklara paralel uzat.", "Mümkünse bacakları düzelt ve V şeklini oluştur.", "Birkaç nefes sonra bırak, dizleri kucakla."],
    breath: "Nefesi tutmadan düzenli devam et; göğsü açık tut.", focus: ["Karın kasları", "Omurga uzunluğu", "Göğüs açıklığı"], avoid: ["Bel ya da boyun ağrısında dizlerini bükük tut.", "Hamilelikte ve adet döneminde karın baskısından kaçın."],
    easier: "Dizleri bükük bırak, ellerini uyluk arkasında tut.", harder: "Bacakları düzleştir, kolları başının üzerine uzat.", counter: ["kolay-oturus", "one-egilme"], styles: ["vinyasa", "ashtanga"],
  },
  {
    slug: "deve", name: "Deve", english: "Camel Pose", sanskrit: "Ustrasana", category: "Geriye eğilme", level: "Orta", hold: "3–5 nefes",
    summary: "Diz üstünde göğsü tavana açan, kalbi ve kalçayı genişleten geriye esneme.",
    intro: "Deve, omurganın tamamını geriye doğru açan ve duygusal bir açılma hissi veren bir duruştur. Yavaş ilerle; kalçayı öne iterek bel yerine tüm sırtın eğilmesine izin ver.",
    benefits: ["Göğüs, karın ve kalça önünü açar", "Omurga hareketliliğini artırır", "Duruşu ve omuzları geliştirir", "Enerji verir"],
    steps: ["Dizlerinin üzerinde dik dur; dizler kalça genişliğinde, ayak üstleri yerde.", "Ellerini belinin arkasına koy, parmak uçları aşağıda.", "Kalçanı hafifçe öne it, göğsünü kaldır.", "Hazırsan ellerini birer birer topuklarına uzat.", "Boynu rahat bırak ya da çeneni göğse yaklaştır.", "Çıkarken önce göğsü, en son başı kaldır; Çocuk Pozu'yla dinlen."],
    breath: "Derin al, geriye açılırken göğüs dolsun; nefesi tutma.", focus: ["Kalça önü", "Göğüs yüksekliği", "Boyun yumuşaklığı"], avoid: ["Boyun, bel ya da tansiyon sorununda ellerin belinde kalsın.", "Baş dönmesinde çıkışı yavaş yap."],
    easier: "Ellerini belinin arkasında tut, ayak parmaklarını kıvırıp topukları yükselt.", harder: "Avuçlarını topuklara bastır ve başı geriye bırak.", counter: ["cocuk"], styles: ["hatha", "ashtanga"],
  },
]

export const POSE_BY_SLUG: Record<string, YogaPose> = Object.fromEntries(POSES.map((p) => [p.slug, p]))
export const poseImage = (slug: string) => `/poses/${slug}.webp`
