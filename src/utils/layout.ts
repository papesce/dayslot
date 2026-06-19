import type { TimelineEvent } from '../types'

export interface LayoutEvent extends TimelineEvent {
  column: number
  totalColumns: number
}

/** Assigns column indices to overlapping events so they render side-by-side. */
export function computeLayout(events: TimelineEvent[]): LayoutEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinute - b.startMinute)
  const result: LayoutEvent[] = []
  // Groups of overlapping events
  let groupEnd = -1
  let groupColumns: LayoutEvent[][] = []

  const flushGroup = () => {
    const total = groupColumns.length
    for (const col of groupColumns) {
      for (const e of col) {
        const idx = result.findIndex(r => r.id === e.id)
        result[idx] = { ...result[idx], totalColumns: total }
      }
    }
  }

  for (const event of sorted) {
    const end = event.startMinute + event.durationMinutes

    if (event.startMinute >= groupEnd) {
      // No overlap with current group — flush and start fresh
      if (groupColumns.length > 0) flushGroup()
      groupEnd = end
      groupColumns = [[{ ...event, column: 0, totalColumns: 1 }]]
      result.push({ ...event, column: 0, totalColumns: 1 })
    } else {
      // Overlaps — find the first column where it fits
      groupEnd = Math.max(groupEnd, end)
      let placed = false
      for (let c = 0; c < groupColumns.length; c++) {
        const colLast = groupColumns[c][groupColumns[c].length - 1]
        if (event.startMinute >= colLast.startMinute + colLast.durationMinutes) {
          const entry: LayoutEvent = { ...event, column: c, totalColumns: 1 }
          groupColumns[c].push(entry)
          result.push(entry)
          placed = true
          break
        }
      }
      if (!placed) {
        const c = groupColumns.length
        const entry: LayoutEvent = { ...event, column: c, totalColumns: 1 }
        groupColumns.push([entry])
        result.push(entry)
      }
    }
  }
  if (groupColumns.length > 0) flushGroup()

  return result
}
