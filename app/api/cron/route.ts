import { NextResponse } from 'next/server';
import { getState, setState, pruneOldDays } from '@/lib/store';
import { broadcast, InlineKeyboard } from '@/lib/telegram';
import { nowInMadrid, Reminder, todayKey } from '@/lib/types';
import { formatReminderMessage } from '@/lib/messages';

/**
 * Endpoint que cron-job.org llama cada minuto.
 * Envía dos tipos de avisos:
 * - 15 minutos antes: recordatorio anticipado
 * - A la hora exacta: notificación con botón "Marcar tomada"
 */
export async function GET(req: Request) {
  // Verificar CRON_SECRET
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { hh, mm, date } = nowInMadrid();
  const today = todayKey();

  // Reset diario
  let state = await getState();
  if (!state.dispatch[today] && Object.keys(state.dispatch).length > 0) {
    state = pruneOldDays(state);
    await setState(state);
  }

  const subs = state.subscribers ?? [];
  if (subs.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      hint: 'No hay suscriptores. Manda /start al bot.',
    });
  }

  const currentHHMM = `${hh}:${mm}`;
  
  // Calcular hora 15 min adelante
  const now = new Date();
  now.setHours(parseInt(hh), parseInt(mm));
  const future = new Date(now.getTime() + 15 * 60 * 1000);
  const futureHHMM = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;

  const dayDispatch = state.dispatch[today] ?? {};
  let sentCount = 0;

  // ──────────────────────────────────────────────────────────
  // Avisos A LA HORA EXACTA (con botón)
  // ──────────────────────────────────────────────────────────
  const dueNow: Reminder[] = state.reminders.filter(
    (r) => r.enabled && r.time === currentHHMM && !dayDispatch[r.id]?.sent
  );

  const newDispatch = { ...dayDispatch };

  for (const r of dueNow) {
    const text = formatReminderMessage(r, false);
    const keyboard: InlineKeyboard = [
      [{ text: '✅ Marcar tomada', callback_data: `taken:${r.id}` }],
    ];
    const sent = await broadcast(subs, text, {
      reply_markup: { inline_keyboard: keyboard },
    });

    newDispatch[r.id] = {
      sent: true,
      taken: false,
      messages: sent
        .filter((s) => s.messageId != null)
        .map((s) => ({ chatId: s.chatId, messageId: s.messageId as number })),
    };
    sentCount++;
  }

  if (Object.keys(newDispatch).length !== Object.keys(dayDispatch).length) {
    await setState({
      ...state,
      dispatch: { ...state.dispatch, [today]: newDispatch },
    });
  }

  // ──────────────────────────────────────────────────────────
  // Avisos 15 MINUTOS ANTES (sin botón, solo recordatorio)
  // ──────────────────────────────────────────────────────────
  const dueIn15: Reminder[] = state.reminders.filter(
    (r) => r.enabled && r.time === futureHHMM && !dayDispatch[r.id]?.reminded15
  );

  for (const r of dueIn15) {
    const text =
      `⏰ <b>En 15 minutos — ${r.time}</b>\n\n` +
      r.meds.map((m) => `• ${m}`).join('\n') +
      (r.notes ? `\n\n<i>${r.notes}</i>` : '');

    await broadcast(subs, text);

    // Marcar que ya se envió el recordatorio de 15 min
    newDispatch[r.id] = {
      ...(newDispatch[r.id] ?? { sent: false, taken: false, messages: [] }),
      reminded15: true,
    };
    sentCount++;
  }

  if (dueIn15.length > 0) {
    await setState({
      ...state,
      dispatch: { ...state.dispatch, [today]: newDispatch },
    });
  }

  return NextResponse.json({
    ok: true,
    sent: sentCount,
    time: currentHHMM,
    date,
  });
}
