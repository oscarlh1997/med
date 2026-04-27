import { NextResponse } from 'next/server';
import { patchState, takenMapForToday } from '@/lib/store';
import { Reminder, sortByTime } from '@/lib/types';

interface Ctx { params: { id: string } }

export async function PUT(req: Request, { params }: Ctx) {
  const body = (await req.json()) as Partial<Reminder>;
  const next = await patchState((s) => {
    const reminders = s.reminders.map((r) =>
      r.id === params.id
        ? {
            ...r,
            ...body,
            meds: body.meds
              ? body.meds.map((m) => m.trim()).filter(Boolean)
              : r.meds,
          }
        : r
    );
    return { ...s, reminders: sortByTime(reminders) };
  });
  return NextResponse.json({
    reminders: next.reminders,
    taken: takenMapForToday(next),
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const next = await patchState((s) => ({
    ...s,
    reminders: s.reminders.filter((r) => r.id !== params.id),
  }));
  return NextResponse.json({
    reminders: next.reminders,
    taken: takenMapForToday(next),
  });
}
