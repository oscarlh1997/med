import { Reminder } from './types';

/** Formatea el mensaje de una toma con o sin marca de "tomada". */
export function formatReminderMessage(
  r: Reminder,
  taken: boolean,
  takenBy?: string
): string {
  const header = taken
    ? `✅ <b>Tomada — ${r.time}</b>`
    : `💊 <b>Hora de las ${r.time}</b>`;

  const meds = r.meds.map((m) => `• ${m}`).join('\n');
  const notes = r.notes ? `\n\n<i>${r.notes}</i>` : '';
  const footer = taken && takenBy ? `\n\n<i>Marcada por ${takenBy}</i>` : '';

  return `${header}\n\n${meds}${notes}${footer}`;
}
