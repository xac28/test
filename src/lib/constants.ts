export type YogaStyle = 'hatha' | 'vinyasa' | 'yin' | 'meditation' | 'ashtanga' | 'restorative';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type ExperienceBucket = 'lt2' | '2to5' | '5to10' | '10plus';

export const YOGA_STYLES: { id: YogaStyle; en: string; tr: string }[] = [
  { id: 'hatha', en: 'Hatha', tr: 'Hatha' },
  { id: 'vinyasa', en: 'Vinyasa', tr: 'Vinyasa' },
  { id: 'yin', en: 'Yin', tr: 'Yin' },
  { id: 'meditation', en: 'Meditation', tr: 'Meditasyon' },
  { id: 'ashtanga', en: 'Ashtanga', tr: 'Ashtanga' },
  { id: 'restorative', en: 'Restorative', tr: 'Onarıcı' },
];

export function styleLabel(id: YogaStyle, locale: 'en' | 'tr'): string {
  return YOGA_STYLES.find((s) => s.id === id)?.[locale] ?? id;
}

export function experienceBucket(years: number): ExperienceBucket {
  if (years < 2) return 'lt2';
  if (years < 5) return '2to5';
  if (years < 10) return '5to10';
  return '10plus';
}
