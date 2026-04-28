/**
 * Wrapper sobre Vercel KV.
 * Si las variables KV no existen, usa un Map en memoria (útil en local).
 */
import { Reminder, SEED, todayKey } from './types';

/**
 * Para cada (día, reminderId) guardamos:
 * - sent: si ya se envió la notificación
 * - taken: si está marcada como tomada
 * - messages: lista de mensajes Telegram enviados, para poder editarlos
 *   cuando alguien marque la toma
 */
export interface DispatchRecord {
  sent: boolean;
  taken: boolean;
  takenBy?: string;       // nombre de quien la marcó (en Telegram)
  messages: Array<{ chatId: number; messageId: number }>;
}

export type DispatchByReminder = Record<string, DispatchRecord>; // reminderId → record
export type DispatchByDay = Record<string, DispatchByReminder>;  // "YYYY-MM-DD" → ...

export interface Store {
  reminders: Reminder[];
  dispatch: DispatchByDay;
  subscribers: number[]; // chat_ids
}

const KEY = 'botiquin:state';

let memCache: Store | null = null;
const hasKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

async function readKV(): Promise<Store | null> {
  if (!hasKV) return null;
  const { kv } = await import('@vercel/kv');
  return (await kv.get<Store>(KEY)) ?? null;
}

async function writeKV(state: Store): Promise<void> {
  if (!hasKV) return;
  const { kv } = await import('@vercel/kv');
  await kv.set(KEY, state);
}

const initialState = (): Store => ({
  reminders: SEED,
  dispatch: {},
  subscribers: [],
});

export async function getState(): Promise<Store> {
  if (hasKV) {
    const state = await readKV();
    if (state) {
      // Garantía de campos por compatibilidad
      return {
        reminders: state.reminders ?? SEED,
        dispatch: state.dispatch ?? {},
        subscribers: state.subscribers ?? [],
      };
    }
    const fresh = initialState();
    await writeKV(fresh);
    return fresh;
  }
  if (!memCache) memCache = initialState();
  return memCache;
}

export async function setState(state: Store): Promise<void> {
  if (hasKV) {
    await writeKV(state);
  } else {
    memCache = state;
  }
}

export async function patchState(fn: (s: Store) => Store): Promise<Store> {
  const current = await getState();
  const next = fn(current);
  await setState(next);
  return next;
}

// ─────────────────────────────────────────────────────────────
// Helpers de dispatch
// ─────────────────────────────────────────────────────────────

/** Devuelve el dispatch del día de hoy para un reminder, creándolo vacío si no existe. */
export function getTodayRecord(state: Store, reminderId: string): DispatchRecord {
  const day = todayKey();
  return (
    state.dispatch[day]?.[reminderId] ?? {
      sent: false,
      taken: false,
      messages: [],
    }
  );
}

/** Devuelve el mapa "tomadas hoy" en el formato {reminderId: true} (compatibilidad UI). */
export function takenMapForToday(state: Store): Record<string, boolean> {
  const today = state.dispatch[todayKey()] ?? {};
  const out: Record<string, boolean> = {};
  for (const [id, rec] of Object.entries(today)) {
    if (rec.taken) out[id] = true;
  }
  return out;
}

/** Limpia los registros de días anteriores (mantiene solo el día actual). */
export function pruneOldDays(state: Store): Store {
  const today = todayKey();
  return {
    ...state,
    dispatch: state.dispatch[today]
      ? { [today]: state.dispatch[today] }
      : {},
  };
}
