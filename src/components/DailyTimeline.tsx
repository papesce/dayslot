import { useMemo, useRef, useState, useCallback, useEffect, useImperativeHandle } from 'react'
import type { DailyTimelineHandle, DailyTimelineProps, TimelineEvent } from '../types'
import { computeLayout } from '../utils/layout'
import './DailyTimeline.css'

const DEFAULT_COLOR = '#ede9ff'
const SNAP = 15 // default snap minutes

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function formatSlotLabel(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return formatHour(h)
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${String(m).padStart(2, '0')}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function snap(value: number, interval: number) {
  return Math.round(value / interval) * interval
}

function darken(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return '#7c6fcd'
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 60)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 60)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 60)
  return `rgb(${r},${g},${b})`
}

type DragState =
  | { type: 'move'; eventId: string; startY: number; origScrollTop: number; origStart: number }
  | { type: 'resize'; eventId: string; startY: number; origScrollTop: number; origDuration: number }

function DailyTimelineInner({
  events,
  startHour = 7,
  endHour = 22,
  hourHeight = 80,
  snapMinutes = SNAP,
  title = 'Daily Timeline',
  height,
  className = '',
  onEventClick,
  onEventChange,
  onEventRemove,
  onExternalDrop,
  externalDragDuration = 30,
  externalDragOffsetY = 0,
  timelineRef,
  initialScrollTo = 'now',
  renderEventContent,
  renderSlotAction,
  slotActionTrigger = 'both',
  showCurrentTime = true,
  slotIntervalMinutes = 60,
}: DailyTimelineProps) {
  const interval = slotIntervalMinutes > 0 ? slotIntervalMinutes : 60
  if (60 % interval !== 0 && interval % 60 !== 0) {
    console.warn(`slotIntervalMinutes=${interval} should divide 60 or be a multiple of 60.`)
  }
  const slotCount = Math.round(((endHour - startHour) * 60) / interval)
  const slots = Array.from({ length: slotCount }, (_, i) => startHour * 60 + i * interval)
  const slotHeight = hourHeight * (interval / 60)
  const timelineStartMinute = startHour * 60
  const timelineEndMinute = endHour * 60
  const totalHeight = slotCount * slotHeight

  // Live override while dragging — applied on top of `events` prop
  const [liveOverride, setLiveOverride] = useState<Partial<TimelineEvent> & { id: string } | null>(null)

  const drag = useRef<DragState | null>(null)
  const didDrag = useRef(false)
  const liveOverrideRef = useRef<Partial<TimelineEvent> & { id: string } | null>(null)
  const onEventChangeRef = useRef(onEventChange)
  onEventChangeRef.current = onEventChange
  const onExternalDropRef = useRef(onExternalDrop)
  onExternalDropRef.current = onExternalDrop
  const [nowMinute, setNowMinute] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNowMinute(d.getHours() * 60 + d.getMinutes())
    }
    const ms = (60 - new Date().getSeconds()) * 1000
    const t = setTimeout(() => { tick(); }, ms)
    return () => clearTimeout(t)
  }, [nowMinute])

  const gridRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollRafRef = useRef<number | null>(null)
  const dragClientYRef = useRef<number>(0)
  const [dropTarget, setDropTarget] = useState(false)
  const [dropMinute, setDropMinute] = useState<number | null>(null)
  const [activeSlotMinute, setActiveSlotMinute] = useState<number | null>(null)

  const minuteToScrollTop = useCallback((minute: number) => {
    const clampedMinute = Math.max(startHour * 60, Math.min(endHour * 60, minute))
    const top = ((clampedMinute - startHour * 60) / 60) * hourHeight
    // keep target ~20% from top of visible area
    const offset = (bodyRef.current?.clientHeight ?? 0) * 0.2
    return Math.max(0, top - offset)
  }, [startHour, endHour, hourHeight])

  const scrollToMinute = useCallback((minute: number) => {
    bodyRef.current?.scrollTo({ top: minuteToScrollTop(minute), behavior: 'smooth' })
  }, [minuteToScrollTop])

  const scrollToNow = useCallback(() => {
    const d = new Date()
    scrollToMinute(d.getHours() * 60 + d.getMinutes())
  }, [scrollToMinute])

  const scrollToEvent = useCallback((eventId: string) => {
    const ev = events.find(e => e.id === eventId)
    if (ev) scrollToMinute(ev.startMinute)
  }, [events, scrollToMinute])

  useImperativeHandle(timelineRef, () => ({ scrollToNow, scrollToEvent, scrollToMinute }), [scrollToNow, scrollToEvent, scrollToMinute])

  // scroll on mount
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    let target: number
    if (initialScrollTo === 'now') {
      const d = new Date()
      target = d.getHours() * 60 + d.getMinutes()
    } else if (typeof initialScrollTo === 'number') {
      target = initialScrollTo
    } else {
      const ev = events.find(e => e.id === initialScrollTo)
      target = ev ? ev.startMinute : startHour * 60
    }
    body.scrollTop = minuteToScrollTop(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEdgeScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    const ZONE = 80
    const MAX_SPEED = 14

    function tick() {
      const body = bodyRef.current
      if (!body) return
      const rect = body.getBoundingClientRect()
      const rel = dragClientYRef.current - rect.top
      const h = rect.height
      let speed = 0
      if (rel < ZONE) speed = -MAX_SPEED * (1 - Math.max(rel, 0) / ZONE)
      else if (rel > h - ZONE) speed = MAX_SPEED * (1 - (h - Math.min(rel, h)) / ZONE)
      if (speed !== 0) body.scrollTop += speed
      scrollRafRef.current = requestAnimationFrame(tick)
    }
    scrollRafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopEdgeScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = null
    }
  }, [])

  const minutesPerPx = 60 / hourHeight

  const displayEvents = useMemo(() => {
    if (!liveOverride) return events
    return events.map(e => (e.id === liveOverride.id ? { ...e, ...liveOverride } : e))
  }, [events, liveOverride])

  const layoutEvents = useMemo(() => computeLayout(displayEvents), [displayEvents])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    e.preventDefault()
    didDrag.current = true
    dragClientYRef.current = e.clientY
    startEdgeScroll()
    const scrollDelta = (bodyRef.current?.scrollTop ?? 0) - d.origScrollTop
    const dy = e.clientY - d.startY + scrollDelta
    const deltaMins = snap(dy * minutesPerPx, snapMinutes)

    if (d.type === 'move') {
      const orig = events.find(ev => ev.id === d.eventId)
      if (!orig) return
      const newStart = Math.max(
        timelineStartMinute,
        Math.min(timelineEndMinute - orig.durationMinutes, d.origStart + deltaMins)
      )
      const override = { id: d.eventId, startMinute: newStart }
      liveOverrideRef.current = override
      setLiveOverride(override)
    } else {
      const orig = events.find(ev => ev.id === d.eventId)
      if (!orig) return
      const newDuration = Math.max(snapMinutes, d.origDuration + deltaMins)
      const capped = Math.min(newDuration, timelineEndMinute - orig.startMinute)
      const override = { id: d.eventId, durationMinutes: capped }
      liveOverrideRef.current = override
      setLiveOverride(override)
    }
  }, [events, minutesPerPx, snapMinutes, timelineStartMinute, timelineEndMinute, startEdgeScroll])

  const onPointerUp = useCallback(() => {
    const d = drag.current
    if (!d) return
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    const override = liveOverrideRef.current
    if (override && onEventChangeRef.current) {
      const orig = events.find(ev => ev.id === d.eventId)
      if (orig) onEventChangeRef.current({ ...orig, ...override })
    }
    liveOverrideRef.current = null
    setLiveOverride(null)
    stopEdgeScroll()
  }, [events, onPointerMove, stopEdgeScroll])

  const startDrag = useCallback((
    e: React.PointerEvent,
    type: 'move' | 'resize',
    event: TimelineEvent
  ) => {
    e.stopPropagation()
    didDrag.current = false
    const origScrollTop = bodyRef.current?.scrollTop ?? 0
    drag.current = type === 'move'
      ? { type: 'move', eventId: event.id, startY: e.clientY, origScrollTop, origStart: event.startMinute }
      : { type: 'resize', eventId: event.id, startY: e.clientY, origScrollTop, origDuration: event.durationMinutes }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [onPointerMove, onPointerUp])

  function yToMinute(clientY: number, grabOffsetY = 0) {
    const rect = gridRef.current!.getBoundingClientRect()
    // rect.top already reflects scroll — no need to add scrollTop
    const relY = clientY - rect.top - grabOffsetY
    const rawMinute = (relY / hourHeight) * 60 + timelineStartMinute
    return Math.max(timelineStartMinute, Math.min(timelineEndMinute - snapMinutes,
      Math.round(rawMinute / snapMinutes) * snapMinutes))
  }

  function handleDragOver(e: React.DragEvent) {
    if (!onExternalDropRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    dragClientYRef.current = e.clientY
    setDropTarget(true)
    setDropMinute(yToMinute(e.clientY, externalDragOffsetY))
    startEdgeScroll()
  }

  function handleDragLeave() {
    setDropTarget(false)
    setDropMinute(null)
    stopEdgeScroll()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropTarget(false)
    setDropMinute(null)
    stopEdgeScroll()
    if (!onExternalDropRef.current) return
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return
    onExternalDropRef.current(data, yToMinute(e.clientY, externalDragOffsetY))
  }

  return (
    <div className={`ds-timeline ${className}`} style={height ? { height } : undefined}>
      <div className="ds-timeline__header">
        <span className="ds-timeline__header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        {title}
      </div>

      <div className="ds-timeline__body" ref={bodyRef}>
        <div
          ref={gridRef}
          className={`ds-timeline__grid${dropTarget ? ' ds-timeline__grid--drop-target' : ''}`}
          style={{ height: totalHeight }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {slots.map(slotMinute => {
            const isActiveSlot = activeSlotMinute === slotMinute
            return (
              <div
                key={slotMinute}
                className="ds-timeline__row"
                style={{ height: slotHeight, position: 'absolute', top: (slotMinute - startHour * 60) / 60 * hourHeight, left: 0, right: 0 }}
                onClick={() => {
                  if (renderSlotAction && slotActionTrigger !== 'button') {
                    setActiveSlotMinute(isActiveSlot ? null : slotMinute)
                  }
                }}
              >
                <span className="ds-timeline__hour-label">{formatSlotLabel(slotMinute)}</span>
                {renderSlotAction && (
                  <>
                    {isActiveSlot && (
                      <div className="ds-timeline__slot-action" onClick={e => e.stopPropagation()}>
                        {renderSlotAction(slotMinute, () => setActiveSlotMinute(null))}
                      </div>
                    )}
                    {!isActiveSlot && slotActionTrigger !== 'row' && (
                      <div className="ds-timeline__slot-action" onClick={e => e.stopPropagation()}>
                        <button
                          className="ds-timeline__slot-add"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setActiveSlotMinute(slotMinute) }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {showCurrentTime && nowMinute >= timelineStartMinute && nowMinute <= timelineEndMinute && (
            <div
              className="ds-timeline__now"
              style={{ top: ((nowMinute - timelineStartMinute) / 60) * hourHeight }}
            >
              <div className="ds-timeline__now-dot" />
              <div className="ds-timeline__now-line" />
            </div>
          )}

          <div className="ds-timeline__events">
            {dropMinute !== null && (
              <div
                className="ds-timeline__drop-ghost"
                style={{
                  top: ((dropMinute - timelineStartMinute) / 60) * hourHeight,
                  height: Math.max((externalDragDuration / 60) * hourHeight, 32),
                  left: 0,
                  right: 8,
                }}
              />
            )}
            {layoutEvents.map(event => {
              const top = ((event.startMinute - timelineStartMinute) / 60) * hourHeight
              const height = Math.max((event.durationMinutes / 60) * hourHeight, 32)
              const colWidth = 100 / event.totalColumns
              const left = `${event.column * colWidth}%`
              const width = `calc(${colWidth}% - ${event.totalColumns > 1 ? 4 : 8}px)`
              const bg = event.color ?? DEFAULT_COLOR
              const isDragging = liveOverride?.id === event.id

              return (
                <div
                  key={event.id}
                  className={`ds-timeline__event${isDragging ? ' ds-timeline__event--dragging' : ''}`}
                  style={{ top, height, left, width, background: bg }}
                  onPointerDown={e => startDrag(e, 'move', event)}
                  onClick={() => { if (!didDrag.current) onEventClick?.(event) }}
                >
                  {renderEventContent
                    ? renderEventContent(event)
                    : (
                      <>
                        {onEventRemove && (
                          <button
                            className="ds-timeline__event-remove"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onEventRemove(event) }}
                            aria-label="Remove event"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                        <div className="ds-timeline__event-title">{event.title}</div>
                        {(event.category || event.durationMinutes) && (
                          <div className="ds-timeline__event-meta">
                            {event.category && (
                              <span className="ds-timeline__event-category">
                                <span
                                  className="ds-timeline__event-dot"
                                  style={{ background: event.color ? darken(event.color) : '#7c6fcd' }}
                                />
                                {event.category}
                              </span>
                            )}
                            <span className="ds-timeline__event-duration">
                              {formatDuration(event.durationMinutes)}
                            </span>
                          </div>
                        )}
                      </>
                    )
                  }
                  {/* Resize handle */}
                  <div
                    className="ds-timeline__resize-handle"
                    onPointerDown={e => startDrag(e, 'resize', event)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DailyTimeline(props: DailyTimelineProps) {
  return <DailyTimelineInner {...props} />
}
