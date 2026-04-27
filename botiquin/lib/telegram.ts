/**
 * Cliente para el Bot API de Telegram.
 * Soporta envío de mensajes con teclados inline, edición de mensajes
 * y respuesta a callback_query (botones).
 */

const TG_API = 'https://api.telegram.org/bot';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('Falta TELEGRAM_BOT_TOKEN en variables de entorno');
  return t;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineButton[][];

interface SendOptions {
  reply_markup?: { inline_keyboard: InlineKeyboard };
}

/** Envía un mensaje. Devuelve message_id si todo va bien. */
export async function sendMessage(
  chatId: number,
  text: string,
  options: SendOptions = {}
): Promise<number | null> {
  const res = await fetch(`${TG_API}${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    }),
  });
  if (!res.ok) {
    console.error('[telegram] sendMessage failed', await res.text());
    return null;
  }
  const data = await res.json();
  return data?.result?.message_id ?? null;
}

/** Envía el mismo mensaje con teclado a varios chats; devuelve [chatId, messageId] de cada envío. */
export async function broadcast(
  chatIds: number[],
  text: string,
  options: SendOptions = {}
): Promise<Array<{ chatId: number; messageId: number | null }>> {
  const results = await Promise.allSettled(
    chatIds.map(async (id) => ({
      chatId: id,
      messageId: await sendMessage(id, text, options),
    }))
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<{ chatId: number; messageId: number | null }> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value);
}

/** Edita el texto y/o el teclado de un mensaje ya enviado. */
export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  options: SendOptions = {}
): Promise<void> {
  const res = await fetch(`${TG_API}${token()}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (!err.includes('not modified')) {
      console.error('[telegram] editMessage failed', err);
    }
  }
}

/** Responde a un callback_query para que Telegram quite el spinner del botón. */
export async function answerCallbackQuery(
  callbackId: string,
  text?: string
): Promise<void> {
  await fetch(`${TG_API}${token()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text,
      show_alert: false,
    }),
  });
}

// ─────────────────────────────────────────────────────────────
// Tipos de updates de Telegram
// ─────────────────────────────────────────────────────────────
export interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name?: string; username?: string };
  chat: { id: number; type: string };
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number; first_name?: string; username?: string };
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}
