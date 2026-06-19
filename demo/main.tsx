import { StrictMode, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DailyTimeline } from '../src/index'
import type { DailyTimelineHandle, TimelineEvent } from '../src/index'

const INITIAL_EVENTS: TimelineEvent[] = [
  { id: '1', title: 'Mirar los items de Heiko', startMinute: 13 * 60, durationMinutes: 120, color: '#ede9ff', category: 'Work' },
  { id: '2', title: 'limpiar la camioneta VW', startMinute: 15 * 60, durationMinutes: 45, color: '#ede9ff', category: 'Personal' },
  { id: '3', title: 'Team standup', startMinute: 9 * 60 + 30, durationMinutes: 30, color: '#d1fae5', category: 'Work' },
  { id: '4', title: 'Lunch', startMinute: 12 * 60, durationMinutes: 60, color: '#fef3c7', category: 'Personal' },
  { id: '5', title: 'Code review', startMinute: 13 * 60 + 30, durationMinutes: 60, color: '#dbeafe', category: 'Work' },
]

interface BacklogItem {
  id: string
  title: string
  durationMinutes: number
  color: string
  category: string
}

const INITIAL_BACKLOG: BacklogItem[] = [
  { id: 'b1', title: 'Write unit tests', durationMinutes: 60, color: '#dbeafe', category: 'Work' },
  { id: 'b2', title: 'Grocery run', durationMinutes: 30, color: '#fef3c7', category: 'Personal' },
  { id: 'b3', title: 'Read emails', durationMinutes: 15, color: '#d1fae5', category: 'Work' },
  { id: 'b4', title: 'Exercise', durationMinutes: 45, color: '#fce7f3', category: 'Health' },
]

interface LogEntry { id: number; type: 'click' | 'change' | 'drop' | 'remove'; message: string }

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

function BacklogCard({ item, onDragStart, onDragEnd }: { item: BacklogItem; onDragStart: (grabOffsetY: number) => void; onDragEnd: () => void }) {
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
        background: item.color,
        borderRadius: 10,
        padding: '8px 12px',
        cursor: 'grab',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.title}</span>
      <span style={{ fontSize: 11, color: '#666' }}>{item.category} · {formatDur(item.durationMinutes)}</span>
    </div>
  )
}

function scrollBtnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    borderRadius: 8,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#1a1a2e',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function App() {
  const [events, setEvents] = useState<TimelineEvent[]>(INITIAL_EVENTS)
  const [backlog, setBacklog] = useState<BacklogItem[]>(INITIAL_BACKLOG)
  const [log, setLog] = useState<LogEntry[]>([])
  const [startHour, setStartHour] = useState(7)
  const [endHour, setEndHour] = useState(20)
  const [draggingDuration, setDraggingDuration] = useState<number | undefined>()
  const [draggingOffsetY, setDraggingOffsetY] = useState(0)
  const tlRef = useRef<DailyTimelineHandle>(null)

  function addLog(type: LogEntry['type'], message: string) {
    setLog(prev => [{ id: logId++, type, message }, ...prev].slice(0, 20))
  }

  function handleChange(updated: TimelineEvent) {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
    addLog('change', `"${updated.title}" → ${formatMin(updated.startMinute)}, ${updated.durationMinutes}m`)
  }

  function handleClick(event: TimelineEvent) {
    addLog('click', `"${event.title}"`)
  }

  function handleRemove(event: TimelineEvent) {
    setEvents(prev => prev.filter(e => e.id !== event.id))
    addLog('remove', `"${event.title}" removed`)
  }

  function handleExternalDrop(data: string, startMinute: number) {
    const { id } = JSON.parse(data) as { id: string }
    const item = backlog.find(b => b.id === id)
    if (!item) return
    const newEvent: TimelineEvent = {
      id: String(nextId++),
      title: item.title,
      startMinute,
      durationMinutes: item.durationMinutes,
      color: item.color,
      category: item.category,
    }
    setEvents(prev => [...prev, newEvent])
    setBacklog(prev => prev.filter(b => b.id !== id))
    addLog('drop', `"${item.title}" dropped at ${formatMin(startMinute)}`)
  }

  const logColors: Record<LogEntry['type'], string> = {
    click: '#7c6fcd',
    change: '#34d399',
    drop: '#f59e0b',
    remove: '#f87171',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 16px', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Backlog */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{
          background: '#fff', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
            Backlog
          </div>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
            {backlog.length === 0
              ? <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>empty</div>
              : backlog.map(item => (
                  <BacklogCard
                    key={item.id}
                    item={item}
                    onDragStart={(offsetY) => { setDraggingDuration(item.durationMinutes); setDraggingOffsetY(offsetY) }}
                    onDragEnd={() => setDraggingDuration(undefined)}
                  />
                ))
            }
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 1.4 }}>
          drag a card onto<br />the timeline
        </div>
      </div>

      {/* Timeline + controls */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: '12px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <HourSelect label="Start hour" value={startHour} onChange={v => setStartHour(Math.min(v, endHour - 1))} />
          <HourSelect label="End hour" value={endHour} onChange={v => setEndHour(Math.max(v, startHour + 1))} />
        </div>

        {/* Scroll controls */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '10px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        }}>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Scroll to
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => tlRef.current?.scrollToNow()} style={scrollBtnStyle('#7c6fcd')}>
              ⏱ Now
            </button>
            {events.map(ev => (
              <button key={ev.id} onClick={() => tlRef.current?.scrollToEvent(ev.id)} style={scrollBtnStyle(ev.color ?? '#ede9ff')}>
                {ev.title.length > 16 ? ev.title.slice(0, 14) + '…' : ev.title}
              </button>
            ))}
          </div>
        </div>

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
          onEventRemove={handleRemove}
          onExternalDrop={handleExternalDrop}
          externalDragDuration={draggingDuration}
          externalDragOffsetY={draggingOffsetY}
          timelineRef={tlRef}
          initialScrollTo="now"
        />
      </div>

      {/* Event log */}
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
            <button onClick={() => setLog([])} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
              clear
            </button>
          )}
        </div>
        <div style={{ minHeight: 120, maxHeight: 480, overflowY: 'auto', padding: '8px 0' }}>
          {log.length === 0
            ? <div style={{ color: '#444', padding: '16px', textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>drag, drop or click…</div>
            : log.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', gap: 8, padding: '5px 16px',
                borderBottom: '1px solid #1a1a28', alignItems: 'baseline',
              }}>
                <span style={{
                  color: logColors[entry.type], minWidth: 44, fontSize: 10,
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

    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
