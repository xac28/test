import { YogaStyle, Level } from './constants';

export type Teacher = {
  id: string;
  slug: string;
  name: string;
  country: string;
  countryFlag: string;
  avatar: string;
  bio: { en: string; tr: string };
  longBio: { en: string; tr: string };
  styles: YogaStyle[];
  levels: Level[];
  yearsExperience: number;
  languages: string[];
  certifications: string[];
  rating: number;
  reviewCount: number;
  studentsCount: number;
  pricePerClassUSD: number;
  trialPriceUSD: number;
  videoIntroUrl: string;
  // Mock available time slots (UTC ISO strings, next 14 days, 2-3 per day)
  availability: string[];
};

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

function makeAvailability(daysAhead: number, hours: number[]): string[] {
  const slots: string[] = [];
  for (let d = 1; d <= daysAhead; d++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + d);
    for (const h of hours) {
      const slot = new Date(day);
      slot.setUTCHours(h, 0, 0, 0);
      slots.push(slot.toISOString());
    }
  }
  return slots;
}

export const TEACHERS: Teacher[] = [
  {
    id: 't1',
    slug: 'aylin-demir',
    name: 'Aylin Demir',
    country: 'Türkiye',
    countryFlag: '🇹🇷',
    avatar: 'https://i.pravatar.cc/400?img=47',
    bio: {
      en: 'Hatha & Yin yoga teacher with 8 years of experience. Gentle, mindful practice for all levels.',
      tr: '8 yıllık deneyimli Hatha & Yin yoga öğretmeni. Her seviyeye uygun yumuşak ve farkındalıklı pratik.',
    },
    longBio: {
      en: 'I discovered yoga 12 years ago after a long search for balance. Today, I share what I learned from teachers in Rishikesh and Bali. My classes focus on breath, alignment, and presence — leaving the mat with more space than you arrived with.',
      tr: 'Yogayı 12 yıl önce uzun bir denge arayışının ardından keşfettim. Bugün Rishikesh ve Bali\'deki hocalarımdan öğrendiklerimi paylaşıyorum. Derslerimde nefes, hizalama ve şu ana odaklanırız — minderden geldiğinizden daha fazla alanla ayrılırsınız.',
    },
    styles: ['hatha', 'yin', 'meditation'],
    levels: ['beginner', 'intermediate'],
    yearsExperience: 8,
    languages: ['Türkçe', 'English'],
    certifications: ['RYT-500', 'Yin Yoga 50hr'],
    rating: 4.9,
    reviewCount: 142,
    studentsCount: 380,
    pricePerClassUSD: 25,
    trialPriceUSD: 12,
    videoIntroUrl: '',
    availability: makeAvailability(14, [7, 13, 17]),
  },
  {
    id: 't2',
    slug: 'marcus-rivera',
    name: 'Marcus Rivera',
    country: 'USA',
    countryFlag: '🇺🇸',
    avatar: 'https://i.pravatar.cc/400?img=12',
    bio: {
      en: 'Vinyasa & Ashtanga specialist. Strong, dynamic flows that build heat and clarity.',
      tr: 'Vinyasa & Ashtanga uzmanı. Isı ve berraklık üreten güçlü, dinamik akışlar.',
    },
    longBio: {
      en: 'Former dancer turned yoga teacher, I bring 15 years of body-awareness work to the mat. Expect strong, sweat-inducing flows that meet you exactly where you are. Power yoga foundation, but always with care.',
      tr: 'Eski bir dansçıyım, sonra yoga öğretmeni oldum. 15 yıllık vücut farkındalığı çalışmamı mindere taşıyorum. Sizi olduğunuz yerden alıp götüren güçlü, terletici akışlar. Power yoga temelli ama her zaman özenli.',
    },
    styles: ['vinyasa', 'ashtanga'],
    levels: ['intermediate', 'advanced'],
    yearsExperience: 15,
    languages: ['English', 'Español'],
    certifications: ['E-RYT 500', 'Ashtanga Authorized Level 1'],
    rating: 4.8,
    reviewCount: 287,
    studentsCount: 612,
    pricePerClassUSD: 45,
    trialPriceUSD: 22,
    videoIntroUrl: '',
    availability: makeAvailability(14, [14, 18, 22]),
  },
  {
    id: 't3',
    slug: 'priya-sharma',
    name: 'Priya Sharma',
    country: 'India',
    countryFlag: '🇮🇳',
    avatar: 'https://i.pravatar.cc/400?img=44',
    bio: {
      en: 'Traditional Hatha & meditation rooted in 12 years of practice in Rishikesh.',
      tr: 'Rishikesh\'te 12 yıllık pratikten doğan geleneksel Hatha & meditasyon.',
    },
    longBio: {
      en: 'Born and raised at the foothills of the Himalayas, yoga has always been part of my life. I teach the slow, traditional Hatha that I learned from my teachers, with deep emphasis on pranayama (breathwork) and meditation. Sessions feel like a quiet conversation.',
      tr: 'Himalayalar\'ın eteklerinde doğup büyüdüm, yoga hayatımın hep bir parçası oldu. Hocalarımdan öğrendiğim yavaş, geleneksel Hatha\'yı öğretiyorum; pranayama (nefes çalışması) ve meditasyona derin önem veririm. Dersler sessiz bir sohbet gibi geçer.',
    },
    styles: ['hatha', 'meditation'],
    levels: ['beginner', 'intermediate', 'advanced'],
    yearsExperience: 12,
    languages: ['English', 'हिन्दी'],
    certifications: ['RYT-500', 'Pranayama 100hr', 'Meditation Teacher'],
    rating: 5.0,
    reviewCount: 198,
    studentsCount: 425,
    pricePerClassUSD: 30,
    trialPriceUSD: 15,
    videoIntroUrl: '',
    availability: makeAvailability(14, [4, 9, 14]),
  },
  {
    id: 't4',
    slug: 'lena-fischer',
    name: 'Lena Fischer',
    country: 'Germany',
    countryFlag: '🇩🇪',
    avatar: 'https://i.pravatar.cc/400?img=5',
    bio: {
      en: 'Restorative & Yin teacher. Slow, deep, nervous-system-calming practice.',
      tr: 'Onarıcı & Yin öğretmeni. Yavaş, derin, sinir sistemini yatıştıran pratik.',
    },
    longBio: {
      en: 'I came to yoga through burnout. After years in tech, restorative yoga taught me how to actually rest. My classes are slow, propped, and quiet — perfect after long days, during stressful seasons, or whenever your body asks for less effort and more care.',
      tr: 'Yogaya tükenmişlik yoluyla geldim. Teknoloji sektöründe yıllar geçirdikten sonra, onarıcı yoga bana gerçekten nasıl dinleneceğimi öğretti. Derslerim yavaş, destekli ve sessiz — uzun günlerin ardından, stresli dönemlerde ya da bedeniniz daha az çaba, daha çok özen istediği her an için ideal.',
    },
    styles: ['restorative', 'yin', 'meditation'],
    levels: ['beginner', 'intermediate'],
    yearsExperience: 4,
    languages: ['English', 'Deutsch'],
    certifications: ['RYT-200', 'Restorative 50hr'],
    rating: 4.9,
    reviewCount: 76,
    studentsCount: 145,
    pricePerClassUSD: 28,
    trialPriceUSD: 14,
    videoIntroUrl: '',
    availability: makeAvailability(14, [8, 12, 16]),
  },
  {
    id: 't5',
    slug: 'kenji-tanaka',
    name: 'Kenji Tanaka',
    country: 'Japan',
    countryFlag: '🇯🇵',
    avatar: 'https://i.pravatar.cc/400?img=33',
    bio: {
      en: 'Mindfulness meditation teacher. Zen-rooted practice for clarity and calm.',
      tr: 'Bilinçli farkındalık meditasyonu öğretmeni. Zen kökenli, berraklık ve sükunet için pratik.',
    },
    longBio: {
      en: 'I trained for 6 years in a Zen temple in Kyoto before moving back into modern life. My teaching bridges both worlds: ancient practice, modern minds. Sessions include guided meditation, breath, and gentle reflection. No yoga mat needed — just a quiet corner.',
      tr: 'Modern hayata dönmeden önce Kyoto\'daki bir Zen tapınağında 6 yıl eğitim aldım. Öğretim tarzım iki dünyayı birleştirir: eski pratik, modern zihinler. Dersler rehberli meditasyon, nefes ve nazik bir tefekkür içerir. Yoga matine gerek yok — sadece sessiz bir köşe.',
    },
    styles: ['meditation'],
    levels: ['beginner', 'intermediate', 'advanced'],
    yearsExperience: 9,
    languages: ['English', '日本語'],
    certifications: ['Zen Teacher Certification', 'MBSR Certified'],
    rating: 4.9,
    reviewCount: 214,
    studentsCount: 503,
    pricePerClassUSD: 35,
    trialPriceUSD: 17,
    videoIntroUrl: '',
    availability: makeAvailability(14, [0, 11, 13]),
  },
  {
    id: 't6',
    slug: 'sofia-oliveira',
    name: 'Sofia Oliveira',
    country: 'Brazil',
    countryFlag: '🇧🇷',
    avatar: 'https://i.pravatar.cc/400?img=23',
    bio: {
      en: 'Vinyasa Flow with creative sequencing and music. Beginner-friendly energy.',
      tr: 'Yaratıcı akış ve müzikle Vinyasa Flow. Yeni başlayanlara uygun enerji.',
    },
    longBio: {
      en: 'I teach Vinyasa as a moving meditation, often with carefully chosen music. New to yoga? You\'re especially welcome — my goal is to make you feel capable, not confused. Every session ends with savasana that you actually want to stay in.',
      tr: 'Vinyasa\'yı hareket halinde bir meditasyon olarak öğretirim, çoğu zaman özenle seçilmiş müzikle. Yogaya yeni misiniz? Özellikle hoş geldiniz — amacım sizi kafanız karışmış değil, yetenekli hissettirmek. Her ders, içinde kalmak isteyeceğiniz bir savasana ile biter.',
    },
    styles: ['vinyasa', 'hatha'],
    levels: ['beginner', 'intermediate'],
    yearsExperience: 3,
    languages: ['English', 'Português'],
    certifications: ['RYT-200', 'Vinyasa 100hr'],
    rating: 4.7,
    reviewCount: 54,
    studentsCount: 120,
    pricePerClassUSD: 22,
    trialPriceUSD: 11,
    videoIntroUrl: '',
    availability: makeAvailability(14, [12, 19, 23]),
  },
];

export function getTeacher(slug: string): Teacher | undefined {
  return TEACHERS.find((t) => t.slug === slug);
}
