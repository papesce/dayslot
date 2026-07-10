export interface TimelineEvent {
  id: string
  title: string
  /** minutes from midnight, e.g. 8*60 = 480 for 8am */
  startMinute: number
  /** duration in minutes */
  durationMinutes: number
  color?: string
  category?: string
}

export interface DailyTimelineHandle {
  /** Scroll the timeline body so the current-time indicator is near the top */
  scrollToNow: () => void
  /** Scroll to a specific event by id */
  scrollToEvent: (eventId: string) => void
  /** Scroll to an arbitrary minute value */
  scrollToMinute: (minute: number) => void
}

export interface DailyTimelineProps {
  events: TimelineEvent[]
  /** first hour to show (default 7) */
  startHour?: number
  /** last hour to show (default 22) */
  endHour?: number
  /** pixel height per 60-minute slot (default 80) */
  hourHeight?: number
  /** snap interval in minutes for drag/resize (default 15) */
  snapMinutes?: number
  title?: string
  /** CSS height of the widget, e.g. '600px', '100%', '80vh' (default: auto) */
  height?: string
  className?: string
  onEventClick?: (event: TimelineEvent) => void
  onEventRemove?: (event: TimelineEvent) => void
  /** called after drag-move or resize completes with the updated event */
  onEventChange?: (event: TimelineEvent) => void
  /** called when an external item is dropped onto the timeline.
   *  Receives the dataTransfer text payload and the snapped startMinute. */
  onExternalDrop?: (data: string, startMinute: number) => void
  /** duration in minutes of the item currently being dragged from outside — used to size the drop preview */
  externalDragDuration?: number
  /** px offset from the top of the dragged card where the grab happened — used to align the drop preview */
  externalDragOffsetY?: number
  /** Imperative handle ref for programmatic scrolling */
  timelineRef?: React.Ref<DailyTimelineHandle>
  /** Auto-scroll target on mount: 'now', an event id, or a minute number (default 'now') */
  initialScrollTo?: 'now' | string | number
  /** Override the interior of an event card. Receives the event; return null to use default rendering. */
  renderEventContent?: (event: TimelineEvent) => React.ReactNode
  /** Render an action UI anchored to an hour slot (e.g. inline task-creation form).
   *  Receives the slot's startMinute and a close() callback. Return null to render nothing. */
  renderSlotAction?: (startMinute: number, close: () => void) => React.ReactNode
  /** Controls what triggers the slot action. 'both' (default): row click or + button.
   *  'button': only the + button. 'row': only row click (hides the + button). */
  slotActionTrigger?: 'row' | 'button' | 'both'
  /** Show the current-time indicator line (default true) */
  showCurrentTime?: boolean
  /** Minutes per slot row. Must divide 60 or be a multiple of 60. Default: 60. */
  slotIntervalMinutes?: number
}
