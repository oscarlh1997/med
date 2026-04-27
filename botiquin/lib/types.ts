export interface Reminder {
  id: string;
  time: string; // "HH:MM"
  meds: string[];
  notes: string;
  enabled: boolean;
}

export const SEED: Reminder[] = [
  { id: 'r1', time: '06:00', meds: ['Omeprazol', '½ Dexametasona', 'Tramadol'], notes: 'Inyección · cada 6h', enabled: true },
  { id: 'r2', time: '07:00', meds: ['Gabapentina', '¼ Amitriptilina'], notes: '', enabled: true },
  { id: 'r3', time: '09:00', meds: ['½ Enalapril', '½ Hidroclorotiazida'], notes: '', enabled: true },
  { id: 'r4', time: '12:00', meds: ['¼ Atenolol', 'Tramadol'], notes: 'Inyección · cada 6h', enabled: true },
  { id: 'r5', time: '13:30', meds: ['Domperidona'], notes: '30 min antes de almorzar / comer', enabled: true },
  { id: 'r6', time: '15:00', meds: ['Gabapentina', '¼ Amitriptilina'], notes: '300 mg', enabled: true },
  { id: 'r7', time: '18:00', meds: ['Tramadol', '½ Dexametasona'], notes: '', enabled: true },
  { id: 'r8', time: '23:00', meds: ['Gabapentina', '½ Amitriptilina', '¾ Lonazep'], notes: '', enabled: true },
  { id: 'r9', time: '00:00', meds: ['Tramadol'], notes: 'Inyección · cada 6h', enabled: true },
];

export const minutesOf = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const sortByTime = (list: Reminder[]): Reminder[] =>
  [...list].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));

export const todayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Zona horaria de Madrid (la del usuario). Vercel cron corre en UTC.
export const TIMEZONE = 'Europe/Madrid';

// Convierte la hora actual (UTC) a HH:MM en Europe/Madrid
export const nowInMadrid = (): { hh: string; mm: string; date: string } => {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    hh: get('hour') === '24' ? '00' : get('hour'),
    mm: get('minute'),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
};
