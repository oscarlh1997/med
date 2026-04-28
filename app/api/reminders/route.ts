import { NextResponse } from 'next/server';
import { getState, patchState, takenMapForToday } from '@/lib/store';
import { Reminder, sortByTime } from '@/lib/types';

export async function GET() {
  const state = await getState();
  return NextResponse.json({
    reminders: sortByTime(state.reminders),
    taken: takenMapForToday(state),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Omit<Reminder, 'id'>;
  if (!body.time || !Array.isArray(body.meds) || body.meds.length === 0) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const reminder: Reminder = {
    id: 'r' + Date.now(),
    time: body.time,
    meds: body.meds.map((m) => m.trim()).filter(Boolean),
    notes: body.notes ?? '',
    enabled: body.enabled ?? true,
  };
  const next = await patchState((s) => ({
    ...s,
    reminders: sortByTime([...s.reminders, reminder]),
  }));
  return NextResponse.json({
    reminder,
    reminders: next.reminders,
    taken: takenMapForToday(next),
  });
}
