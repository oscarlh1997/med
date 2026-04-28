import { NextResponse } from 'next/server';
import { getState, patchState, takenMapForToday } from '@/lib/store';
import { todayKey } from '@/lib/types';
import { editMessage } from '@/lib/telegram';
import { formatReminderMessage } from '@/lib/messages';

/**
 * Marca/desmarca una toma desde la web.
 * Si la toma ya tenía mensajes enviados a Telegram, los edita para reflejar
 * el cambio (con o sin botón).
 */
export async function POST(req: Request) {
  const { reminderId, taken } = (await req.json()) as {
    reminderId: string;
    taken: boolean;
  };
  if (!reminderId) {
    return NextResponse.json({ error: 'reminderId requerido' }, { status: 400 });
  }

  const day = todayKey();
  const state = await getState();
  const reminder = state.reminders.find((r) => r.id === reminderId);
  if (!reminder) {
    return NextResponse.json({ error: 'Reminder no encontrado' }, { status: 404 });
  }

  const dayDispatch = state.dispatch[day] ?? {};
  const existing = dayDispatch[reminderId] ?? {
    sent: false,
    taken: false,
    messages: [],
  };

  const updated = {
    ...existing,
    taken,
    takenBy: taken ? 'la web' : undefined,
  };

  const next = await patchState((s) => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      [day]: { ...(s.dispatch[day] ?? {}), [reminderId]: updated },
    },
  }));

  // Actualizar mensajes ya enviados a Telegram (si los hay)
  if (existing.messages.length > 0) {
    const newText = formatReminderMessage(reminder, taken, taken ? 'la web' : undefined);
    const keyboard = taken
      ? { inline_keyboard: [] }
      : { inline_keyboard: [[{ text: '✅ Marcar tomada', callback_data: `taken:${reminderId}` }]] };

    await Promise.allSettled(
      existing.messages.map((m) =>
        editMessage(m.chatId, m.messageId, newText, { reply_markup: keyboard })
      )
    );
  }

  return NextResponse.json({ taken: takenMapForToday(next) });
}
