import { StrictMode, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DailyTimeline } from '../src/index'
import type { DailyTimelineHandle, TimelineEvent } from '../src/index'

// ─── shared data ────────────────────────────────────────────────────────────

const INITIAL_EVENTS: TimelineEvent[] = [
  { id: '1', title: 'Project planning', startMinute: 13 * 60, durationMinutes: 120, color: '#ede9ff', category: 'work' },
  { id: '2', title: 'Car wash', startMinute: 15 * 60, durationMinutes: 45, color: '#fce7f3', category: 'life' },
  { id: '3', title: 'Team standup', startMinute: 9 * 60 + 30, durationMinutes: 30, color: '#d1fae5', category: 'work' },
  { id: '4', title: 'Lunch', startMinute: 12 * 60, durationMinutes: 60, color: '#fef3c7', category: 'health' },
  { id: '5', title: 'Code review', startMinute: 13 * 60 + 30, durationMinutes: 60, color: '#dbeafe', category: 'work' },
]

interface BacklogItem {
  id: string
  title: string
  durationMinutes: number
  color: string
  category: string
  status?: 'pending' | 'completed' | 'cancelled'
}

const INITIAL_BACKLOG: BacklogItem[] = [
  { id: 'b1', title: 'Write unit tests', durationMinutes: 60, color: '#dbeafe', category: 'work' },
  { id: 'b2', title: 'Grocery run', durationMinutes: 30, color: '#fef3c7', category: 'life' },
  { id: 'b3', title: 'Read emails', durationMinutes: 15, color: '#d1fae5', category: 'work' },
  { id: 'b4', title: 'Exercise', durationMinutes: 45, color: '#fce7f3', category: 'health' },
]

// ─── area colours (mirrors balanced-work-life tokens) ───────────────────────

const AREA_COLORS: Record<string, { bg: string; dot: string }> = {
  work:          { bg: '#ede9ff', dot: '#7c6fcd' },
  health:        { bg: '#d1fae5', dot: '#10b981' },
  relationships: { bg: '#fce7f3', dot: '#ec4899' },
  growth:        { bg: '#dbeafe', dot: '#3b82f6' },
  finances:      { bg: '#fef3c7', dot: '#f59e0b' },
  life:          { bg: '#f0fdf4', dot: '#22c55e' },
}

const AREA_LABELS: Record<string, string> = {
  work: 'Work', health: 'Health', relationships: 'Relationships',
  growth: 'Growth', finances: 'Finances', life: 'Life',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#7c6fcd',
  completed: '#10b981',
  cancelled: '#9ca3af',
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatMin(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  const period = h < 12 ? 'am' : 'pm'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${String(min).padStart(2, '0')}${period}`
}

function formatDur(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

let logId = 0
let nextId = 10

const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ─── small shared components ─────────────────────────────────────────────────

function HourSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444' }}>
      <span style={{ minWidth: 70 }}>{label}</span>
      <select value={value} onChange={e => onChange(Number(e.target.value))} style={{
        border: '1px solid #ddd', borderRadius: 8, padding: '4px 8px', fontSize: 13, background: '#fff', cursor: 'pointer',
      }}>
        {HOURS.map(h => (
          <option key={h} value={h}>
            {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
          </option>
        ))}
      </select>
    </label>
  )
}

function BacklogCard({
  item, onDragStart, onDragEnd,
}: { item: BacklogItem; onDragStart: (grabOffsetY: number) => void; onDragEnd: () => void }) {
  return (
    <div
      draggable
      onDragStart={e => {
        const offsetY = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, offsetY }))
        onDragStart(offsetY)
      }}
      onDragEnd={onDragEnd}
      style={{
        background: AREA_COLORS[item.category]?.bg ?? '#ede9ff',
        borderRadius: 10, padding: '8px 12px', cursor: 'grab',
        userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.title}</span>
      <span style={{ fontSize: 11, color: '#666' }}>{AREA_LABELS[item.category] ?? item.category} · {formatDur(item.durationMinutes)}</span>
    </div>
  )
}

function scrollBtnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, border: 'none', borderRadius: 8, padding: '4px 10px',
    fontSize: 12, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer', whiteSpace: 'nowrap',
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#999', marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

// ─── event log ───────────────────────────────────────────────────────────────

interface LogEntry { id: number; type: 'click' | 'change' | 'drop' | 'remove' | 'create'; message: string }

const LOG_COLORS: Record<LogEntry['type'], string> = {
  click: '#7c6fcd', change: '#34d399', drop: '#f59e0b', remove: '#f87171', create: '#38bdf8',
}

function EventLog({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
  return (
    <div style={{
      width: '100%', maxWidth: 280, background: '#1e1e2e', borderRadius: 12,
      overflow: 'hidden', fontFamily: 'ui-monospace, monospace', fontSize: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #2e2e42',
        fontFamily: '-apple-system, sans-serif',
      }}>
        <span style={{ color: '#ccc', fontWeight: 600, fontSize: 13 }}>Event Log</span>
        {log.length > 0 && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
            clear
          </button>
        )}
      </div>
      <div style={{ minHeight: 120, maxHeight: 480, overflowY: 'auto', padding: '8px 0' }}>
        {log.length === 0
          ? <div style={{ color: '#444', padding: '16px', textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>
              drag, drop or click…
            </div>
          : log.map(entry => (
            <div key={entry.id} style={{
              display: 'flex', gap: 8, padding: '5px 16px',
              borderBottom: '1px solid #1a1a28', alignItems: 'baseline',
            }}>
              <span style={{
                color: LOG_COLORS[entry.type], minWidth: 44, fontSize: 10,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {entry.type}
              </span>
              <span style={{ color: '#c9d1d9', lineHeight: 1.4 }}>{entry.message}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── custom renderEventContent ────────────────────────────────────────────────
// Mirrors what balanced-work-life ScheduleGrid does: area dot, status badge, unschedule btn

interface ExtendedEvent extends TimelineEvent {
  status?: 'pending' | 'completed' | 'cancelled'
}

function makeEventContent(
  onUnschedule: (id: string) => void,
  onToggleStatus: (id: string) => void,
  selectedId: string | null,
) {
  return (event: TimelineEvent) => {
    const ev = event as ExtendedEvent
    const status = ev.status ?? 'pending'
    const dotColor = AREA_COLORS[ev.category ?? 'life']?.dot ?? '#7c6fcd'
    const isLong = ev.durationMinutes >= 60

    const isSelected = ev.id === selectedId

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%', gap: 4, fontSize: 12,
        borderRadius: 8,
        padding: isSelected ? '4px 6px' : undefined,
        boxShadow: isSelected ? 'inset 0 0 0 2px #7c6fcd, 0 0 0 3px rgba(124,111,205,0.18)' : undefined,
        transition: 'padding 0.1s, box-shadow 0.1s',
      }}>
        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%', background: dotColor,
              flexShrink: 0, marginTop: 3,
            }}
          />
          <span style={{
            flex: 1, fontWeight: 600, fontSize: 13, lineHeight: 1.3,
            color: status === 'pending' ? '#1a1a2e' : '#999',
            textDecoration: status === 'completed' ? 'line-through' : 'none',
            wordBreak: 'break-word',
          }}>
            {ev.title}
          </span>
          {/* unschedule button */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onUnschedule(ev.id) }}
            title="Unschedule"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#aaa', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* bottom row — only on tall cards */}
        {isLong && (
          <div style={{
            marginTop: 'auto', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 6,
            paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
              {AREA_LABELS[ev.category ?? 'life'] ?? ev.category}
            </span>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onToggleStatus(ev.id)
              }}
              style={{
                fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6,
                padding: '2px 7px', cursor: 'pointer',
                background: status === 'completed' ? '#d1fae5' : status === 'cancelled' ? '#f3f4f6' : '#ede9ff',
                color: STATUS_COLORS[status],
              }}
            >
              {status === 'completed' ? '✓ done' : status === 'cancelled' ? '— cancelled' : '○ pending'}
            </button>
          </div>
        )}
      </div>
    )
  }
}

// ─── custom renderSlotAction ──────────────────────────────────────────────────
// Inline task-creation form — mirrors balanced-work-life ScheduleGrid

function SlotForm({
  startMinute,
  close,
  onAdd,
}: {
  startMinute: number
  close: () => void
  onAdd: (title: string, category: string, startMinute: number) => void
}) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState('work')

  function submit() {
    if (!text.trim()) return
    onAdd(text.trim(), cat, startMinute)
    close()
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        background: 'rgba(0,0,0,0.03)', borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.06)', padding: 8, width: '100%',
      }}
      onClick={e => e.stopPropagation()}
    >
      <input
        autoFocus
        placeholder={`Add task at ${formatMin(startMinute)}…`}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') close()
        }}
        style={{
          border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
          padding: '4px 8px', fontSize: 12, outline: 'none', background: '#fff',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <select
          value={cat}
          onChange={e => setCat(e.target.value)}
          style={{
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8,
            padding: '3px 6px', fontSize: 11, background: '#fff', cursor: 'pointer',
          }}
        >
          {Object.entries(AREA_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={close}
            style={{ fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            style={{
              fontSize: 11, fontWeight: 700, background: '#7c6fcd', color: '#fff',
              border: 'none', borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── edit panel (custom tab) ─────────────────────────────────────────────────

function EditPanel({
  event,
  onSave,
  onClose,
}: {
  event: ExtendedEvent
  onSave: (updated: ExtendedEvent) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(event.title)
  const [category, setCategory] = useState(event.category ?? 'work')
  const [duration, setDuration] = useState(event.durationMinutes)

  function save() {
    onSave({
      ...event,
      title: title.trim() || event.title,
      category,
      durationMinutes: duration,
      color: AREA_COLORS[category]?.bg ?? '#ede9ff',
    })
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #e0e0ee', borderRadius: 8, padding: '6px 10px',
    fontSize: 13, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)', fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>Edit event</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {Object.entries(AREA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
            Duration — {formatDur(duration)}
          </label>
          <input
            type="range" min={15} max={240} step={15} value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#7c6fcd' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb', marginTop: 2 }}>
            <span>15m</span><span>4h</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #e0e0ee',
            background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 2, padding: '7px 0', borderRadius: 8, border: 'none',
            background: '#7c6fcd', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700,
          }}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ─── Demo tabs ────────────────────────────────────────────────────────────────

type Tab = 'default' | 'custom'

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [tab, setTab] = useState<Tab>('default')

  // shared state for both demos
  const [events, setEvents] = useState<ExtendedEvent[]>(INITIAL_EVENTS)
  const [backlog, setBacklog] = useState<BacklogItem[]>(INITIAL_BACKLOG)
  const [log, setLog] = useState<LogEntry[]>([])
  const [startHour, setStartHour] = useState(7)
  const [endHour, setEndHour] = useState(20)
  const [draggingDuration, setDraggingDuration] = useState<number | undefined>()
  const [draggingOffsetY, setDraggingOffsetY] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const tlRef = useRef<DailyTimelineHandle>(null)

  function addLog(type: LogEntry['type'], message: string) {
    setLog(prev => [{ id: logId++, type, message }, ...prev].slice(0, 30))
  }

  function handleChange(updated: TimelineEvent) {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
    addLog('change', `"${updated.title}" → ${formatMin(updated.startMinute)}, ${updated.durationMinutes}m`)
  }

  function handleClick(event: TimelineEvent) {
    addLog('click', `"${event.title}"`)
    if (isCustom) setSelectedEventId(prev => prev === event.id ? null : event.id)
  }

  function handleRemove(event: TimelineEvent) {
    setEvents(prev => prev.filter(e => e.id !== event.id))
    addLog('remove', `"${event.title}" removed`)
  }

  function handleExternalDrop(data: string, startMinute: number) {
    const { id } = JSON.parse(data) as { id: string }
    const item = backlog.find(b => b.id === id)
    if (!item) return
    const newEvent: ExtendedEvent = {
      id: String(nextId++),
      title: item.title,
      startMinute,
      durationMinutes: item.durationMinutes,
      color: AREA_COLORS[item.category]?.bg ?? '#ede9ff',
      category: item.category,
      status: 'pending',
    }
    setEvents(prev => [...prev, newEvent])
    setBacklog(prev => prev.filter(b => b.id !== id))
    addLog('drop', `"${item.title}" dropped at ${formatMin(startMinute)}`)
  }

  function handleUnschedule(id: string) {
    const ev = events.find(e => e.id === id)
    setEvents(prev => prev.filter(e => e.id !== id))
    addLog('remove', `"${ev?.title}" unscheduled`)
  }

  function handleToggleStatus(id: string) {
    setEvents(prev => prev.map(e => {
      if (e.id !== id) return e
      const next = e.status === 'pending' ? 'completed' : e.status === 'completed' ? 'cancelled' : 'pending'
      addLog('change', `"${e.title}" → ${next}`)
      return { ...e, status: next }
    }))
  }

  function handleSlotAdd(title: string, category: string, startMinute: number) {
    const newEvent: ExtendedEvent = {
      id: String(nextId++),
      title,
      startMinute,
      durationMinutes: 30,
      color: AREA_COLORS[category]?.bg ?? '#ede9ff',
      category,
      status: 'pending',
    }
    setEvents(prev => [...prev, newEvent])
    addLog('create', `"${title}" created at ${formatMin(startMinute)}`)
  }

  const isCustom = tab === 'custom'

  // clear selection when switching tabs
  function handleTabChange(t: Tab) {
    setTab(t)
    setSelectedEventId(null)
  }

  function handleEditSave(updated: ExtendedEvent) {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
    addLog('change', `"${updated.title}" edited`)
  }

  const selectedEvent = isCustom ? events.find(e => e.id === selectedEventId) ?? null : null

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? '#7c6fcd' : '#f0f0f5',
    color: active ? '#fff' : '#666',
    transition: 'background 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#eeeef5', paddingBottom: 48 }}>

      {/* header */}
      <div style={{ padding: '28px 24px 0', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e', fontFamily: '-apple-system, sans-serif' }}>
          @papesce/dayslot demo
        </h1>
        <p style={{ margin: '6px 0 20px', fontSize: 14, color: '#777', fontFamily: '-apple-system, sans-serif' }}>
          Embeddable drag-and-drop daily timeline component
        </p>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabBtnStyle(!isCustom)} onClick={() => handleTabChange('default')}>
            Default rendering
          </button>
          <button style={tabBtnStyle(isCustom)} onClick={() => handleTabChange('custom')}>
            renderEventContent + renderSlotAction
          </button>
        </div>

        {isCustom && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10,
            padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#92400e',
            fontFamily: '-apple-system, sans-serif', lineHeight: 1.5,
          }}>
            <strong>New in v0.2:</strong> Pass <code>renderEventContent</code> to inject custom card UI (area dot, status badge,
            unschedule button). Pass <code>renderSlotAction</code> to render an inline creation form when a slot is clicked.
            Both are optional — omit either to keep the built-in default.
          </div>
        )}
      </div>

      {/* main layout */}
      <div style={{
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', maxWidth: 1100, margin: '0 auto',
      }}>

        {/* left: backlog + controls */}
        <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* backlog */}
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 700, fontSize: 14, color: '#1a1a2e', fontFamily: '-apple-system, sans-serif' }}>
              Backlog
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
              {backlog.length === 0
                ? <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: '12px 0', fontFamily: '-apple-system, sans-serif' }}>empty</div>
                : backlog.map(item => (
                    <BacklogCard
                      key={item.id}
                      item={item}
                      onDragStart={offsetY => { setDraggingDuration(item.durationMinutes); setDraggingOffsetY(offsetY) }}
                      onDragEnd={() => setDraggingDuration(undefined)}
                    />
                  ))
              }
            </div>
            <div style={{ padding: '0 10px 10px', fontSize: 11, color: '#bbb', textAlign: 'center', lineHeight: 1.4, fontFamily: '-apple-system, sans-serif' }}>
              drag a card onto the timeline
            </div>
          </div>

          {/* hour range */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <HourSelect label="Start" value={startHour} onChange={v => setStartHour(Math.min(v, endHour - 1))} />
            <HourSelect label="End" value={endHour} onChange={v => setEndHour(Math.max(v, startHour + 1))} />
          </div>

          {/* scroll controls */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: '10px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)', fontFamily: '-apple-system, sans-serif',
          }}>
            <SectionLabel>Scroll to</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <button onClick={() => tlRef.current?.scrollToNow()} style={{ ...scrollBtnStyle('#7c6fcd20'), textAlign: 'left' }}>
                ⏱ Now
              </button>
              {events.map(ev => (
                <button key={ev.id} onClick={() => tlRef.current?.scrollToEvent(ev.id)} style={{ ...scrollBtnStyle(ev.color ?? '#ede9ff'), textAlign: 'left' }}>
                  {ev.title.length > 18 ? ev.title.slice(0, 16) + '…' : ev.title}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* center: timeline only */}
        <div style={{ flex: 1, minWidth: 320, maxWidth: 480 }}>
          <DailyTimeline
            events={events}
            startHour={startHour}
            endHour={endHour}
            hourHeight={80}
            snapMinutes={15}
            height="80vh"
            title="Daily Timeline"
            onEventChange={handleChange}
            onEventClick={handleClick}
            onEventRemove={isCustom ? undefined : handleRemove}
            onExternalDrop={handleExternalDrop}
            externalDragDuration={draggingDuration}
            externalDragOffsetY={draggingOffsetY}
            timelineRef={tlRef}
            initialScrollTo="now"
            // ── new props (only active in "custom" tab) ──────────────────────
            renderEventContent={isCustom
              ? makeEventContent(handleUnschedule, handleToggleStatus, selectedEventId)
              : undefined
            }
            renderSlotAction={isCustom
              ? (startMinute, close) => (
                  <SlotForm startMinute={startMinute} close={close} onAdd={handleSlotAdd} />
                )
              : undefined
            }
          />
        </div>

        {/* right: edit panel (custom tab, event selected) or event log */}
        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isCustom && selectedEvent && (
            <EditPanel
              event={selectedEvent}
              onSave={handleEditSave}
              onClose={() => setSelectedEventId(null)}
            />
          )}
          {isCustom && !selectedEvent && (
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)', fontSize: 13, color: '#bbb',
              fontFamily: '-apple-system, sans-serif', textAlign: 'center',
            }}>
              Click an event to edit it
            </div>
          )}
          <EventLog log={log} onClear={() => setLog([])} />
        </div>

      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
