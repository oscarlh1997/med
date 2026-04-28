import { NextResponse } from 'next/server';
import { getState, patchState, setState } from '@/lib/store';
import {
  sendMessage,
  editMessage,
  answerCallbackQuery,
  TelegramUpdate,
} from '@/lib/telegram';
import { todayKey } from '@/lib/types';
import { formatReminderMessage } from '@/lib/messages';

/**
 * Webhook llamado por Telegram cuando llega cualquier interacción al bot:
 *   - Mensajes (/start, /stop, /hoy, etc.)
 *   - Callbacks de botones inline (taken:r1, etc.)
 *
 * Para configurar el webhook (una sola vez):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/telegram"
 */
export async function POST(req: Request) {
  const body = (await req.json()) as TelegramUpdate;

  // ── Caso A: el usuario pulsó un botón inline (callback_query)
  if (body.callback_query) {
    return handleCallback(body.callback_query);
  }

  // ── Caso B: mensaje normal
  if (body.message) {
    return handleMessage(body.message);
  }

  return NextResponse.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────
// Mensajes
// ─────────────────────────────────────────────────────────────
async function handleMessage(msg: NonNullable<TelegramUpdate['message']>) {
  if (!msg.text) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();
  const name = msg.from.first_name ?? 'amigo';

  if (text === '/start') {
    await patchState((s) => ({
      ...s,
      subscribers: s.subscribers.includes(chatId)
        ? s.subscribers
        : [...s.subscribers, chatId],
    }));
    await sendMessage(
      chatId,
      `¡Hola, ${name}! 👋\n\n` +
        `A partir de ahora recibirás aquí los recordatorios de medicación a la hora exacta de cada toma.\n\n` +
        `Cuando llegue un aviso, pulsa <b>✅ Marcar tomada</b> y se actualizará en la web.\n\n` +
        `Comandos:\n` +
        `/hoy — ver el calendario del día y marcar tomas\n` +
        `/stop — dejar de recibir avisos`
    );
  } else if (text === '/stop') {
    await patchState((s) => ({
      ...s,
      subscribers: s.subscribers.filter((id) => id !== chatId),
    }));
    await sendMessage(chatId, 'Has dejado de recibir avisos. Manda /start cuando quieras volver.');
  } else if (text === '/hoy' || text === '/calendario') {
    await sendTodayList(chatId);
  } else {
    await sendMessage(chatId, 'No entendí ese mensaje. Prueba /start, /hoy o /stop.');
  }

  return NextResponse.json({ ok: true });
}

/** Envía un listado completo del día con un botón por cada toma pendiente. */
async function sendTodayList(chatId: number) {
  const state = await getState();
  const today = state.dispatch[todayKey()] ?? {};
  const enabled = state.reminders
    .filter((r) => r.enabled)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (enabled.length === 0) {
    await sendMessage(chatId, 'No hay tomas configuradas para hoy.');
    return;
  }

  const taken = enabled.filter((r) => today[r.id]?.taken).length;
  const lines = enabled.map((r) => {
    const isTaken = today[r.id]?.taken;
    const mark = isTaken ? '✅' : '○';
    return `${mark} <b>${r.time}</b>  ${r.meds.join(' · ')}`;
  });

  // Botones para las pendientes (max 8 para no saturar)
  const pending = enabled.filter((r) => !today[r.id]?.taken).slice(0, 8);
  const keyboard = pending.map((r) => [
    { text: `✅ Marcar ${r.time}`, callback_data: `taken:${r.id}` },
  ]);

  await sendMessage(
    chatId,
    `📅 <b>Calendario del día</b>  <i>(${taken}/${enabled.length} tomadas)</i>\n\n${lines.join('\n')}`,
    keyboard.length > 0 ? { reply_markup: { inline_keyboard: keyboard } } : {}
  );
}

// ─────────────────────────────────────────────────────────────
// Callbacks (botones inline)
// ─────────────────────────────────────────────────────────────
async function handleCallback(cb: NonNullable<TelegramUpdate['callback_query']>) {
  const data = cb.data ?? '';
  const userName = cb.from.first_name ?? 'alguien';

  if (data.startsWith('taken:')) {
    const reminderId = data.slice('taken:'.length);
    await markReminderAsTaken(reminderId, userName);
    await answerCallbackQuery(cb.id, '✅ Marcada como tomada');
  } else {
    await answerCallbackQuery(cb.id);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Marca un reminder como tomado y propaga la actualización:
 * - Edita TODOS los mensajes que enviamos hoy a TODOS los chats para ese reminder,
 *   quitando el botón y mostrando "Tomada por X".
 * - El estado queda en KV → la web también lo refleja al refrescar.
 */
async function markReminderAsTaken(reminderId: string, takenBy: string) {
  const today = todayKey();
  const state = await getState();
  const reminder = state.reminders.find((r) => r.id === reminderId);
  if (!reminder) return;

  const dayDispatch = state.dispatch[today] ?? {};
  const record = dayDispatch[reminderId];
  if (!record || record.taken) return; // ya estaba marcada

  const updated = { ...record, taken: true, takenBy };

  // Actualizar el state primero
  await setState({
    ...state,
    dispatch: {
      ...state.dispatch,
      [today]: { ...dayDispatch, [reminderId]: updated },
    },
  });

  // Editar todos los mensajes asociados (sin botón, marca verde)
  const newText = formatReminderMessage(reminder, true, takenBy);
  await Promise.allSettled(
    record.messages.map((m) =>
      editMessage(m.chatId, m.messageId, newText, { reply_markup: { inline_keyboard: [] } })
    )
  );
}
