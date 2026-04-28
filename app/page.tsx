'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Pill,
  Clock,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { Reminder, minutesOf, sortByTime } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtClock = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const untilLabel = (m: number) => {
  if (m < 1) return 'ahora';
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `en ${h} h` : `en ${h} h ${mm} min`;
};

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export default function Home() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Reminder | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // ── Carga + polling cada 15 s para reflejar lo que se marca desde Telegram
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/reminders', { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        setReminders(sortByTime(data.reminders ?? []));
        setTaken(data.taken ?? {});
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoaded(true);
      }
    };

    fetchData();
    const t = setInterval(fetchData, 15_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  // ── Reloj
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Próxima toma
  const sortedEnabled = useMemo(
    () => sortByTime(reminders.filter((r) => r.enabled)),
    [reminders]
  );
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next =
    sortedEnabled.find((r) => minutesOf(r.time) > nowMin) ?? sortedEnabled[0];
  const minsUntil = next
    ? minutesOf(next.time) - nowMin + (minutesOf(next.time) <= nowMin ? 24 * 60 : 0)
    : 0;

  // ── Acciones
  const toggleTaken = async (id: string) => {
    const newVal = !taken[id];
    setTaken({ ...taken, [id]: newVal }); // optimista
    try {
      const res = await fetch('/api/taken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: id, taken: newVal }),
      });
      const data = await res.json();
      if (data.taken) setTaken(data.taken);
    } catch (e) {
      console.error(e);
    }
  };

  const togglePause = async (r: Reminder) => {
    const updated = { ...r, enabled: !r.enabled };
    setReminders(reminders.map((x) => (x.id === r.id ? updated : x)));
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: updated.enabled }),
    });
  };

  const saveReminder = async (data: Reminder) => {
    let json;
    if (data.id === 'new') {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time: data.time,
          meds: data.meds,
          notes: data.notes,
          enabled: true,
        }),
      });
      json = await res.json();
    } else {
      const res = await fetch(`/api/reminders/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      json = await res.json();
    }
    setReminders(sortByTime(json.reminders ?? []));
    if (json.taken) setTaken(json.taken);
    setEditing(null);
  };

  const deleteReminder = async (id: string) => {
    const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setReminders(sortByTime(json.reminders ?? []));
    if (json.taken) setTaken(json.taken);
    setConfirmDelete(null);
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted text-xs tracking-widest uppercase">cargando…</div>
      </div>
    );
  }

  return (
    <div className="relative max-w-md mx-auto px-5 pt-8 pb-32 z-10">
      {/* Header */}
      <header className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ok pulse-dot" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
              {fmtClock(now)} · hoy
            </span>
          </div>
          <h1 className="font-display text-3xl font-medium leading-tight mt-1">
            Mi <em className="italic font-normal text-sage">botiquín</em>
          </h1>
        </div>

        <button
          onClick={() => setShowHelp(true)}
          className="p-3 rounded-full border border-border bg-card hover:border-muted transition"
          aria-label="Configurar avisos por Telegram"
        >
          <MessageCircle size={18} className="text-muted" />
        </button>
      </header>

      {/* Banner Telegram */}
      <button
        onClick={() => setShowHelp(true)}
        className="w-full mb-7 px-4 py-3.5 rounded-2xl bg-card border border-border text-left flex items-center gap-3 hover:border-muted transition group"
      >
        <div className="w-9 h-9 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
          <MessageCircle size={16} className="text-sage" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">Avisos por Telegram</div>
          <div className="text-xs text-muted mt-0.5">
            Configura el bot para recibir cada toma en tu chat.
          </div>
        </div>
        <ChevronRight size={16} className="text-muted group-hover:text-ink transition" />
      </button>

      {/* Próxima toma */}
      {next && (
        <section className="mb-8 slide-up">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2">
            Próxima toma
          </div>
          <div className="rounded-3xl bg-sageDeep text-cream p-6 shadow-[0_20px_50px_-25px_rgba(20,40,30,0.5)] relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-sage/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-baseline gap-3 mb-3">
                <div className="font-display text-5xl font-medium tracking-tight">
                  {next.time}
                </div>
                <div className="text-sageSoft text-sm">{untilLabel(minsUntil)}</div>
              </div>
              <ul className="space-y-1.5">
                {next.meds.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 text-cream/90">
                    <Pill size={14} className="text-sageSoft/80" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
              {next.notes && (
                <div className="mt-3 pt-3 border-t border-white/10 text-sm text-sageSoft italic font-display">
                  {next.notes}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Lista */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Calendario del día
          </div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-muted">
            {Object.values(taken).filter(Boolean).length} / {sortedEnabled.length} tomadas
          </div>
        </div>

        <div className="space-y-3">
          {sortByTime(reminders).map((r) => {
            const isPast = minutesOf(r.time) < nowMin;
            const isTaken = !!taken[r.id];
            return (
              <article
                key={r.id}
                className={`rounded-2xl border bg-card transition ${
                  !r.enabled
                    ? 'opacity-50 border-border'
                    : isTaken
                    ? 'border-ok/30 bg-ok/[0.04]'
                    : isPast
                    ? 'border-amber/30'
                    : 'border-border'
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="shrink-0 min-w-[64px]">
                    <div
                      className={`font-display text-2xl font-medium leading-none ${
                        isTaken ? 'text-ok' : 'text-ink'
                      }`}
                    >
                      {r.time}
                    </div>
                    {!r.enabled && (
                      <div className="text-[10px] uppercase tracking-wider text-muted mt-1">
                        pausada
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <ul className="space-y-0.5">
                      {r.meds.map((m, i) => (
                        <li
                          key={i}
                          className={`text-sm ${
                            isTaken ? 'line-through text-muted' : 'text-ink'
                          }`}
                        >
                          {m}
                        </li>
                      ))}
                    </ul>
                    {r.notes && (
                      <div className="mt-1.5 text-xs text-muted italic font-display">
                        {r.notes}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleTaken(r.id)}
                    className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition ${
                      isTaken
                        ? 'bg-ok border-ok'
                        : 'border-border hover:border-ok'
                    }`}
                    aria-label={isTaken ? 'Desmarcar' : 'Marcar como tomada'}
                  >
                    <Check size={16} className={isTaken ? 'text-cream' : 'text-border'} />
                  </button>
                </div>

                <div className="px-4 pb-3 flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setEditing(r)}
                    className="px-2.5 py-1 rounded-full hover:bg-border/40 text-muted flex items-center gap-1.5 transition"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => togglePause(r)}
                    className="px-2.5 py-1 rounded-full hover:bg-border/40 text-muted flex items-center gap-1.5 transition"
                  >
                    {r.enabled ? (
                      <>
                        <BellOff size={12} /> Pausar
                      </>
                    ) : (
                      <>
                        <Bell size={12} /> Reanudar
                      </>
                    )}
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setConfirmDelete(r)}
                    className="px-2.5 py-1 rounded-full hover:bg-danger/10 text-danger/70 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] text-muted text-center mt-10 leading-relaxed">
        Los avisos se envían por Telegram desde un servidor en la nube.
        <br />
        Esta app no sustituye el criterio médico.
      </p>

      {/* FAB */}
      <button
        onClick={() =>
          setEditing({
            id: 'new',
            time: '08:00',
            meds: [''],
            notes: '',
            enabled: true,
          })
        }
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-sageDeep text-cream shadow-[0_10px_30px_-10px_rgba(20,40,30,0.7)] hover:scale-105 active:scale-95 transition flex items-center justify-center z-20"
      >
        <Plus size={24} />
      </button>

      {editing && (
        <EditModal
          reminder={editing}
          onSave={saveReminder}
          onCancel={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar esta toma?"
          message={`Se eliminará la toma de las ${confirmDelete.time}.`}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => deleteReminder(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal genérico
// ─────────────────────────────────────────────────────────────
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal editar/crear
// ─────────────────────────────────────────────────────────────
function EditModal({
  reminder,
  onSave,
  onCancel,
}: {
  reminder: Reminder;
  onSave: (r: Reminder) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(reminder.time);
  const [meds, setMeds] = useState<string[]>(
    reminder.meds.length ? reminder.meds : ['']
  );
  const [notes, setNotes] = useState(reminder.notes ?? '');

  const updateMed = (i: number, v: string) =>
    setMeds(meds.map((m, idx) => (idx === i ? v : m)));
  const addMed = () => setMeds([...meds, '']);
  const removeMed = (i: number) =>
    meds.length > 1 ? setMeds(meds.filter((_, idx) => idx !== i)) : null;

  const submit = () => {
    const cleanMeds = meds.map((m) => m.trim()).filter(Boolean);
    if (!cleanMeds.length) {
      alert('Añade al menos una medicación.');
      return;
    }
    onSave({ ...reminder, time, meds: cleanMeds, notes: notes.trim() });
  };

  return (
    <Sheet onClose={onCancel}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-2xl">
          {reminder.id === 'new' ? 'Nueva toma' : 'Editar toma'}
        </h3>
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-border/40">
          <X size={18} className="text-muted" />
        </button>
      </div>

      <label className="block mb-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2 flex items-center gap-2">
          <Clock size={12} /> HORA
        </div>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white border border-border text-2xl font-display focus:outline-none focus:border-sage transition"
        />
      </label>

      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2 flex items-center gap-2">
          <Pill size={12} /> MEDICACIONES
        </div>
        <div className="space-y-2">
          {meds.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={m}
                onChange={(e) => updateMed(i, e.target.value)}
                placeholder="Ej. ½ Dexametasona"
                className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-border text-sm focus:outline-none focus:border-sage transition"
              />
              <button
                onClick={() => removeMed(i)}
                disabled={meds.length === 1}
                className="px-3 rounded-xl text-muted hover:text-danger disabled:opacity-30 transition"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addMed}
          className="mt-2 text-sm text-sage hover:opacity-70 flex items-center gap-1.5 transition"
        >
          <Plus size={14} /> Añadir otra medicación
        </button>
      </div>

      <label className="block mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-2">
          NOTAS (opcional)
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Inyección · cada 6h"
          className="w-full px-4 py-3 rounded-xl bg-white border border-border text-sm focus:outline-none focus:border-sage transition"
        />
      </label>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-full text-muted hover:bg-border/30 transition"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          className="px-5 py-2.5 rounded-full bg-sageDeep text-cream hover:bg-sage transition flex items-center gap-2"
        >
          <Check size={16} /> Guardar
        </button>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal confirmar
// ─────────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet onClose={onCancel}>
      <h3 className="font-display text-2xl mb-2">{title}</h3>
      <p className="text-sm text-muted mb-5">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-full text-muted hover:bg-border/30 transition"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-full text-cream transition ${
            danger ? 'bg-danger hover:opacity-90' : 'bg-sageDeep hover:bg-sage'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de ayuda Telegram
// ─────────────────────────────────────────────────────────────
function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-2xl">Avisos por Telegram</h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-border/40">
          <X size={18} className="text-muted" />
        </button>
      </div>

      <p className="text-sm text-ink leading-relaxed mb-5">
        Los recordatorios llegan a tu chat de Telegram a la hora exacta de cada toma.
        Es la forma más fiable: funciona en cualquier móvil, sin instalar nada y aunque
        el dispositivo esté bloqueado.
      </p>

      <div className="space-y-4 mb-5">
        <Step n={1} title="Abre Telegram en tu móvil">
          Si no lo tienes, descárgalo gratis desde la tienda de apps.
        </Step>
        <Step n={2} title="Busca el bot">
          En la barra de búsqueda, escribe el usuario del bot (te lo facilita quien
          configuró la app).
        </Step>
        <Step n={3} title="Pulsa Iniciar / envía /start">
          A partir de ese momento recibirás los avisos automáticamente. Cualquier
          persona que haga lo mismo también los recibirá.
        </Step>
      </div>

      <div className="text-xs text-muted bg-amberSoft border border-amber/20 rounded-xl p-3">
        <strong className="text-amber">Comandos útiles:</strong>
        <br />
        <code>/hoy</code> — ver el calendario del día
        <br />
        <code>/stop</code> — dejar de recibir avisos
      </div>

      <button
        onClick={onClose}
        className="w-full mt-5 px-5 py-3 rounded-full bg-sageDeep text-cream hover:bg-sage transition"
      >
        Entendido
      </button>
    </Sheet>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-sage/10 text-sage flex items-center justify-center font-display font-medium text-sm">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs text-muted mt-0.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
