import { StrictMode, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DailyTimeline } from '../src/index'
import type { DailyTimelineHandle, TimelineEvent } from '../src/index'

// ─── types ────────────────────────────────────────────────────────────────────

interface ExtendedEvent extends TimelineEvent {
  status?: 'pending' | 'completed' | 'cancelled'
}

interface BacklogItem {
  id: string
  title: string
  durationMinutes: number
  color: string
  category: string
}

// ─── data ─────────────────────────────────────────────────────────────────────

const INITIAL_EVENTS: ExtendedEvent[] = [
  { id: '1', title: 'Sprint planning', startMinute: 9*60, durationMinutes: 60, color: '#ede9ff', category: 'work' },
  { id: '2', title: 'Standup', startMinute: 9*60+30, durationMinutes: 30, color: '#ede9ff', category: 'work' },
  { id: '3', title: 'Code review', startMinute: 10*60, durationMinutes: 90, color: '#dbeafe', category: 'growth' },
  { id: '4', title: 'Pair programming', startMinute: 10*60, durationMinutes: 60, color: '#ede9ff', category: 'work' },
  { id: '5', title: 'Lunch', startMinute: 12*60, durationMinutes: 60, color: '#fef3c7', category: 'life' },
  { id: '6', title: 'Deep work', startMinute: 13*60, durationMinutes: 120, color: '#ede9ff', category: 'work' },
  { id: '7', title: '1:1 with manager', startMinute: 15*60, durationMinutes: 30, color: '#fce7f3', category: 'relationships' },
  { id: '8', title: 'Gym', startMinute: 17*60, durationMinutes: 60, color: '#d1fae5', category: 'health' },
]

const INITIAL_BACKLOG: BacklogItem[] = [
  { id: 'b1', title: 'Write unit tests', durationMinutes: 45, color: '#dbeafe', category: 'growth' },
  { id: 'b2', title: 'Grocery run', durationMinutes: 30, color: '#fef3c7', category: 'life' },
  { id: 'b3', title: 'Exercise', durationMinutes: 45, color: '#d1fae5', category: 'health' },
]

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
  pending: '#7c6fcd', completed: '#10b981', cancelled: '#9ca3af',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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
let nextId = 100
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ─── small components ─────────────────────────────────────────────────────────

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))} style={{
      border: '1px solid #e0e0f0', borderRadius: 8, padding: '4px 8px',
      fontSize: 12, background: '#fff', cursor: 'pointer', color: '#333',
    }}>
      {HOURS.map(h => (
        <option key={h} value={h}>
          {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
        </option>
      ))}
    </select>
  )
}

function BacklogCard({ item, onDragStart, onDragEnd }: {
  item: BacklogItem
  onDragStart: (offsetY: number) => void
  onDragEnd: () => void
}) {
  const dot = AREA_COLORS[item.category]?.dot ?? '#7c6fcd'
  const bg = AREA_COLORS[item.category]?.bg ?? '#ede9ff'
  return (
    <div
      draggable
      onDragStart={e => {
        const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, offsetY }))
        onDragStart(offsetY)
      }}
      onDragEnd={onDragEnd}
      style={{
        background: bg, borderRadius: 8, padding: '7px 10px',
        cursor: 'grab', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{formatDur(item.durationMinutes)}</div>
      </div>
      <span style={{ fontSize: 14, color: '#bbb', lineHeight: 1 }}>⠿</span>
    </div>
  )
}

// ─── event log ────────────────────────────────────────────────────────────────

interface LogEntry { id: number; type: 'click' | 'change' | 'drop' | 'remove' | 'create'; message: string }

const LOG_COLORS: Record<LogEntry['type'], string> = {
  click: '#7c6fcd', change: '#34d399', drop: '#f59e0b', remove: '#f87171', create: '#38bdf8',
}

function EventLog({ log, onClear, collapsed, onToggle }: {
  log: LogEntry[]; onClear: () => void; collapsed: boolean; onToggle: () => void
}) {
  return (
    <div style={{ background: '#1e1e2e', borderRadius: 10, overflow: 'hidden', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: collapsed ? 'none' : '1px solid #2e2e42',
        cursor: 'pointer',
      }} onClick={onToggle}>
        <span style={{ color: '#aaa', fontWeight: 600, fontSize: 12, fontFamily: '-apple-system, sans-serif' }}>
          Event Log {log.length > 0 && <span style={{ color: '#555' }}>({log.length})</span>}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {log.length > 0 && !collapsed && (
            <button onClick={e => { e.stopPropagation(); onClear() }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, fontFamily: '-apple-system, sans-serif' }}>clear</button>
          )}
          <span style={{ color: '#555', fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
          {log.length === 0
            ? <div style={{ color: '#444', padding: '12px 14px', fontFamily: '-apple-system, sans-serif', fontSize: 11 }}>interact with the timeline…</div>
            : log.map(entry => (
              <div key={entry.id} style={{ display: 'flex', gap: 8, padding: '4px 14px', alignItems: 'baseline' }}>
                <span style={{ color: LOG_COLORS[entry.type], minWidth: 42, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{entry.type}</span>
                <span style={{ color: '#c9d1d9', lineHeight: 1.4, fontSize: 11 }}>{entry.message}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── prop row ─────────────────────────────────────────────────────────────────

function PropRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>
      <div style={{ minWidth: 0, flexShrink: 1 }}>
        <span style={{ fontSize: 12, color: '#444', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>{hint}</span>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#bbb', marginTop: 4, marginBottom: 2 }}>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: value ? '#7c6fcd' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 18 : 3, width: 14, height: 14,
        borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function RadioGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2, background: '#f3f3f8', borderRadius: 8, padding: 2 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 8px', fontSize: 11, fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer',
            background: value === opt.value ? '#fff' : 'transparent',
            color: value === opt.value ? '#7c6fcd' : '#888',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function MiniSelect({ value, options, onChange }: {
  value: number; options: number[]; onChange: (v: number) => void
}) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))} style={{
      border: '1px solid #e0e0f0', borderRadius: 7, padding: '3px 7px',
      fontSize: 12, background: '#fff', cursor: 'pointer', color: '#333',
    }}>
      {options.map(v => <option key={v} value={v}>{v}m</option>)}
    </select>
  )
}

// ─── custom renderEventContent ────────────────────────────────────────────────

function makeEventContent(onUnschedule: (id: string) => void, onToggleStatus: (id: string) => void) {
  return (event: TimelineEvent) => {
    const ev = event as ExtendedEvent
    const status = ev.status ?? 'pending'
    const dotColor = AREA_COLORS[ev.category ?? 'life']?.dot ?? '#7c6fcd'
    const isLong = ev.durationMinutes >= 60

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 3 }} />
          <span style={{
            flex: 1, fontWeight: 600, fontSize: 13, lineHeight: 1.3,
            color: status === 'cancelled' ? '#bbb' : '#1a1a2e',
            textDecoration: status === 'completed' ? 'line-through' : 'none',
            wordBreak: 'break-word',
          }}>{ev.title}</span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onUnschedule(ev.id) }}
            title="Unschedule"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 15, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
          >×</button>
        </div>
        {isLong && (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
              {AREA_LABELS[ev.category ?? 'life'] ?? ev.category}
            </span>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onToggleStatus(ev.id) }}
              style={{
                fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 6,
                padding: '2px 7px', cursor: 'pointer',
                background: status === 'completed' ? '#d1fae5' : status === 'cancelled' ? '#f3f4f6' : '#ede9ff',
                color: STATUS_COLORS[status],
              }}
            >
              {status === 'completed' ? '✓ done' : status === 'cancelled' ? '— skip' : '○ pending'}
            </button>
          </div>
        )}
      </div>
    )
  }
}

// ─── slot action form ─────────────────────────────────────────────────────────

function SlotForm({ startMinute, close, onAdd }: {
  startMinute: number; close: () => void; onAdd: (title: string, category: string, startMinute: number) => void
}) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState('work')

  function submit() {
    if (!text.trim()) return
    onAdd(text.trim(), cat, startMinute)
    close()
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      background: 'rgba(0,0,0,0.03)', borderRadius: 10,
      border: '1px solid rgba(0,0,0,0.06)', padding: 8, width: '100%',
    }} onClick={e => e.stopPropagation()}>
      <input
        autoFocus placeholder={`Add at ${formatMin(startMinute)}…`}
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close() }}
        style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '4px 8px', fontSize: 12, outline: 'none', background: '#fff' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{
          border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '3px 6px', fontSize: 11, background: '#fff', cursor: 'pointer',
        }}>
          {Object.entries(AREA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={close} style={{ fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Cancel</button>
          <button onClick={submit} style={{ fontSize: 11, fontWeight: 700, background: '#7c6fcd', color: '#fff', border: 'none', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [events, setEvents] = useState<ExtendedEvent[]>(INITIAL_EVENTS)
  const [backlog, setBacklog] = useState<BacklogItem[]>(INITIAL_BACKLOG)
  const [log, setLog] = useState<LogEntry[]>([])
  const [logCollapsed, setLogCollapsed] = useState(false)

  // props
  const [title, setTitle] = useState('Daily Timeline')
  const [startHour, setStartHour] = useState(7)
  const [endHour, setEndHour] = useState(20)
  const [hourHeight, setHourHeight] = useState(80)
  const [snapMinutes, setSnapMinutes] = useState(15)
  const [slotMinutes, setSlotMinutes] = useState(60)
  const slotActionInterval = snapMinutes
  const [slotActionTrigger, setSlotActionTrigger] = useState<'row' | 'button' | 'both'>('both')
  const [showMarkers, setShowMarkers] = useState<'always' | 'hover' | 'none'>('always')
  const [showLabels, setShowLabels] = useState(true)
  const [showCurrentTime, setShowCurrentTime] = useState(true)
  const [customRender, setCustomRender] = useState(true)

  const [draggingDuration, setDraggingDuration] = useState<number | undefined>()
  const [draggingOffsetY, setDraggingOffsetY] = useState(0)
  const tlRef = useRef<DailyTimelineHandle>(null)

  function addLog(type: LogEntry['type'], message: string) {
    setLog(prev => [{ id: logId++, type, message }, ...prev].slice(0, 40))
  }

  function handleChange(updated: TimelineEvent) {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e))
    addLog('change', `"${updated.title}" → ${formatMin(updated.startMinute)}, ${updated.durationMinutes}m`)
  }

  function handleClick(event: TimelineEvent) {
    addLog('click', `"${event.title}"`)
  }

  function handleExternalDrop(data: string, startMinute: number) {
    const { id } = JSON.parse(data) as { id: string }
    const item = backlog.find(b => b.id === id)
    if (!item) return
    const newEvent: ExtendedEvent = {
      id: String(nextId++), title: item.title, startMinute,
      durationMinutes: item.durationMinutes, color: AREA_COLORS[item.category]?.bg ?? '#ede9ff',
      category: item.category, status: 'pending',
    }
    setEvents(prev => [...prev, newEvent])
    setBacklog(prev => prev.filter(b => b.id !== id))
    addLog('drop', `"${item.title}" → ${formatMin(startMinute)}`)
  }

  function handleUnschedule(id: string) {
    const ev = events.find(e => e.id === id)
    if (!ev) return
    setEvents(prev => prev.filter(e => e.id !== id))
    const cat = ev.category ?? 'work'
    setBacklog(prev => [...prev, { id: `b${nextId++}`, title: ev.title, durationMinutes: ev.durationMinutes, color: AREA_COLORS[cat]?.bg ?? '#ede9ff', category: cat }])
    addLog('remove', `"${ev.title}" → backlog`)
  }

  function handleToggleStatus(id: string) {
    setEvents(prev => prev.map(e => {
      if (e.id !== id) return e
      const next = e.status === 'pending' ? 'completed' : e.status === 'completed' ? 'cancelled' : 'pending'
      addLog('change', `"${e.title}" status → ${next}`)
      return { ...e, status: next }
    }))
  }

  function handleSlotAdd(title: string, category: string, startMinute: number) {
    const newEvent: ExtendedEvent = {
      id: String(nextId++), title, startMinute, durationMinutes: slotActionInterval,
      color: AREA_COLORS[category]?.bg ?? '#ede9ff', category, status: 'pending',
    }
    setEvents(prev => [...prev, newEvent])
    addLog('create', `"${title}" at ${formatMin(startMinute)}`)
  }

  const renderContent = customRender ? makeEventContent(handleUnschedule, handleToggleStatus) : undefined

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* header */}
      <div style={{ borderBottom: '1px solid #e4e4f0', background: '#fff', padding: '14px 28px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
          @papesce/dayslot
        </h1>
        <span style={{ fontSize: 13, color: '#999' }}>interactive component playground</span>
      </div>

      {/* two-column layout */}
      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 53px)' }}>

        {/* left: timeline (dominant) */}
        <div style={{ flex: '1 1 0', minWidth: 0, padding: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* backlog strip */}
          {backlog.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
                Backlog — drag onto the timeline
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {backlog.map(item => (
                  <div key={item.id} style={{ width: 160 }}>
                    <BacklogCard
                      item={item}
                      onDragStart={offsetY => { setDraggingDuration(item.durationMinutes); setDraggingOffsetY(offsetY) }}
                      onDragEnd={() => setDraggingDuration(undefined)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* timeline */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <DailyTimeline
              events={events}
              startHour={startHour}
              endHour={endHour}
              hourHeight={hourHeight}
              snapMinutes={snapMinutes}
              slotMinutes={slotMinutes}
              slotActionTrigger={slotActionTrigger}
              showMarkers={showMarkers}
              showLabels={showLabels}
              showCurrentTime={showCurrentTime}
              height="100%"
              title={title}
              onEventChange={handleChange}
              onEventClick={handleClick}
              onExternalDrop={handleExternalDrop}
              externalDragDuration={draggingDuration}
              externalDragOffsetY={draggingOffsetY}
              timelineRef={tlRef}
              initialScrollTo="now"
              renderEventContent={renderContent}
              renderSlotAction={(startMinute, close) => <SlotForm startMinute={startMinute} close={close} onAdd={handleSlotAdd} />}
            />
          </div>
        </div>

        {/* right: props explorer + log */}
        <div style={{
          width: 320, flexShrink: 0, borderLeft: '1px solid #e4e4f0', background: '#fff',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          {/* props panel */}
          <div style={{ padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>Props Explorer</div>

            <SectionLabel>General</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <PropRow label="title">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{
                    border: '1px solid #e0e0f0', borderRadius: 8, padding: '4px 8px',
                    fontSize: 12, background: '#fff', color: '#333', width: 110,
                  }}
                />
              </PropRow>
            </div>

            <SectionLabel>Timing</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <PropRow label="startHour">
                <HourSelect value={startHour} onChange={v => setStartHour(Math.min(v, endHour - 1))} />
              </PropRow>
              <PropRow label="endHour">
                <HourSelect value={endHour} onChange={v => setEndHour(Math.max(v, startHour + 1))} />
              </PropRow>
              <PropRow label="snapMinutes">
                <MiniSelect value={snapMinutes} options={[5, 10, 15, 30, 60]} onChange={setSnapMinutes} />
              </PropRow>
            </div>

            <SectionLabel>Display</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <PropRow label="hourHeight" hint={`${hourHeight}px`}>
                <input type="range" min={40} max={200} step={10} value={hourHeight}
                  onChange={e => setHourHeight(Number(e.target.value))}
                  style={{ width: 90, accentColor: '#7c6fcd' }} />
              </PropRow>
              <PropRow label="showCurrentTime">
                <Toggle value={showCurrentTime} onChange={setShowCurrentTime} />
              </PropRow>
              <PropRow label="renderEventContent" hint="custom">
                <Toggle value={customRender} onChange={setCustomRender} />
              </PropRow>
            </div>

            <SectionLabel>Slots</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <PropRow label="slotMinutes">
                <MiniSelect value={slotMinutes} options={[15, 30, 60, 120]}
                  onChange={setSlotMinutes} />
              </PropRow>
              <PropRow label="slotActionTrigger">
                <RadioGroup
                  value={slotActionTrigger}
                  onChange={setSlotActionTrigger}
                  options={[
                    { value: 'row', label: 'row' },
                    { value: 'button', label: '+btn' },
                    { value: 'both', label: 'both' },
                  ]}
                />
              </PropRow>
            </div>

            <SectionLabel>Markers</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <PropRow label="showMarkers">
                <RadioGroup
                  value={showMarkers}
                  onChange={setShowMarkers}
                  options={[
                    { value: 'always', label: 'always' },
                    { value: 'hover', label: 'hover' },
                    { value: 'none', label: 'none' },
                  ]}
                />
              </PropRow>
              <PropRow label="showLabels">
                <Toggle value={showLabels} onChange={setShowLabels} />
              </PropRow>
            </div>

            <SectionLabel>Scroll to (ref API)</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => tlRef.current?.scrollToNow()}
                  style={{ fontSize: 11, background: '#f3f0ff', color: '#7c6fcd', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>
                  scrollToNow()
                </button>
                <button onClick={() => tlRef.current?.scrollToMinute(0)}
                  style={{ fontSize: 11, background: '#f3f0ff', color: '#7c6fcd', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>
                  scrollToMinute(0)
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
                {events.map(ev => (
                  <button key={ev.id} onClick={() => tlRef.current?.scrollToEvent(ev.id)}
                    style={{
                      background: ev.color ?? '#ede9ff', border: 'none', borderRadius: 6, padding: '4px 8px',
                      fontSize: 11, fontWeight: 500, color: '#1a1a2e', cursor: 'pointer', textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                    scrollToEvent("{ev.title.length > 14 ? ev.title.slice(0, 12) + '…' : ev.title}")
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* event log pinned to bottom */}
          <div style={{ padding: '0 0 0 0', borderTop: '1px solid #e4e4f0' }}>
            <EventLog log={log} onClear={() => setLog([])} collapsed={logCollapsed} onToggle={() => setLogCollapsed(v => !v)} />
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
