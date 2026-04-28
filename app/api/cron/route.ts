import { NextResponse } from 'next/server';
import { getState, setState, pruneOldDays } from '@/lib/store';
import { broadcast, InlineKeyboard } from '@/lib/telegram';
import { nowInMadrid, Reminder, todayKey } from '@/lib/types';
import { formatReminderMessage } from '@/lib/messages';

/**
 * Endpoint que Vercel cron llama cada minuto.
 * - Comprueba si toca enviar algún recordatorio (hora actual en Europe/Madrid).
 * - Envía el mensaje con botón "✅ Marcar tomada" a todos los suscriptores.
 * - Guarda los message_id para poder editar el mensaje cuando alguien lo marque.
 * - Reset automático: al cambiar de día, los registros del día anterior se borran.
 */
export async function GET(req: Request) {
  // Vercel firma cron con CRON_SECRET (opcional)
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { hh, mm, date } = nowInMadrid();
  const currentHHMM = `${hh}:${mm}`;
  const today = todayKey();

  // Reset diario: si el día actual no está en dispatch, purgar días anteriores
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

  // Filtrar tomas que toca enviar AHORA y que no se hayan enviado ya hoy
  const dayDispatch = state.dispatch[today] ?? {};
  const due: Reminder[] = state.reminders.filter(
    (r) => r.enabled && r.time === currentHHMM && !dayDispatch[r.id]?.sent
  );

  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, time: currentHHMM });
  }

  // Enviar cada toma con su botón "Marcar como tomada"
  const newDispatch = { ...dayDispatch };
  for (const r of due) {
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
  }

  await setState({
    ...state,
    dispatch: { ...state.dispatch, [today]: newDispatch },
  });

  return NextResponse.json({
    ok: true,
    sent: due.length,
    time: currentHHMM,
    date,
  });
}
