# @papesce/dayslot

A drag-and-drop daily timeline component for React. Drop it in, hand it events, and you get a fully interactive schedule — with overlap layout, live drag-to-move, resize, external drag-and-drop, edge-scroll, and a real-time "now" indicator. Zero runtime dependencies beyond React.

<img width="1142" height="983" alt="Screenshot 2026-06-20 at 9 48 47 AM" src="https://github.com/user-attachments/assets/60b9bcc3-d6c9-4772-908d-470a52033205" />


## Install

```bash
npm install @papesce/dayslot
```

```tsx
import { DailyTimeline } from '@papesce/dayslot'
import '@papesce/dayslot/style.css'
```

## Quick start

```tsx
import { useState } from 'react'
import { DailyTimeline } from '@papesce/dayslot'
import '@papesce/dayslot/style.css'

const EVENTS = [
  { id: '1', title: 'Team standup', startMinute: 9 * 60 + 30, durationMinutes: 30, color: '#d1fae5', category: 'Work' },
  { id: '2', title: 'Lunch',        startMinute: 12 * 60,     durationMinutes: 60, color: '#fef3c7', category: 'Personal' },
  { id: '3', title: 'Code review',  startMinute: 14 * 60,     durationMinutes: 60, color: '#dbeafe', category: 'Work' },
]

function App() {
  const [events, setEvents] = useState(EVENTS)
  return (
    <DailyTimeline
      events={events}
      height="80vh"
      onEventChange={updated =>
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
      }
    />
  )
}
```

## Features

| | |
|---|---|
| **Drag to move** | Grab any event and reposition it — snaps to a configurable grid |
| **Resize** | Pull the bottom handle to extend or shrink an event |
| **Overlap layout** | Concurrent events tile side-by-side automatically |
| **External drag-and-drop** | Drop items from a sidebar / backlog onto the timeline |
| **Drop preview** | Ghost block shows exactly where an external item will land |
| **Edge-scroll** | Dragging near the top or bottom auto-scrolls the timeline |
| **Now indicator** | Red line tracks the current time, updates every minute |
| **Scroll to now / event** | Imperative handle to programmatically jump to any point |
| **Remove events** | Optional trash button on hover |
| **Custom card content** | `renderEventContent` injects your own UI into every event card |
| **Inline slot creation** | `renderSlotAction` renders a form when a slot row is clicked |

## API

### `<DailyTimeline>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `events` | `TimelineEvent[]` | — | Array of events to render |
| `startHour` | `number` | `7` | First hour displayed |
| `endHour` | `number` | `22` | Last hour displayed |
| `hourHeight` | `number` | `80` | Pixel height of each 60-minute row |
| `snapMinutes` | `number` | `15` | Drag/resize snap interval |
| `title` | `string` | `'Daily Timeline'` | Header label |
| `height` | `string` | auto | CSS height, e.g. `'600px'` or `'80vh'` |
| `className` | `string` | `''` | Extra class on the root element |
| `onEventClick` | `(event) => void` | — | Fired on click (not after a drag) |
| `onEventChange` | `(event) => void` | — | Fired after drag-move or resize |
| `onEventRemove` | `(event) => void` | — | Enables the trash button; called on remove |
| `onExternalDrop` | `(data, startMinute) => void` | — | Fired when an external item is dropped |
| `externalDragDuration` | `number` | `30` | Duration (min) of the item being dragged in — sizes the drop preview |
| `externalDragOffsetY` | `number` | `0` | Grab-point offset within the dragged card — aligns the drop preview |
| `timelineRef` | `Ref<DailyTimelineHandle>` | — | Imperative handle ref |
| `initialScrollTo` | `'now' \| string \| number` | `'now'` | Where to scroll on mount — `'now'`, an event id, or a minute value |
| `renderEventContent` | `(event) => ReactNode` | — | Override the interior of every event card |
| `renderSlotAction` | `(startMinute, close) => ReactNode` | — | Render an action UI anchored to a slot row when clicked |
| `slotActionTrigger` | `'row' \| 'button' \| 'both'` | `'both'` | What triggers the slot action — row click, + button, or both |
| `showCurrentTime` | `boolean` | `true` | Show or hide the current-time indicator line |
| `slotMinutes` | `number` | `60` | Primary time division — grid rows, hour labels, and border lines. Use `15`, `30`, `60`, or `120` (must divide 60 or be a multiple of 60). |
| `showMarkers` | `'none' \| 'hover' \| 'always'` | auto | Show divider lines at subdivision boundaries (where `slotMinutes / snapMinutes > 1`). Defaults to `'always'` when subdivisions > 1, `'none'` otherwise. |
| `showLabels` | `boolean` | `false` | Show time labels on subdivision divider lines. |
| `onScroll` | `(scrollTop: number) => void` | — | Called when the timeline body scrolls. Useful for dismissing overlay UI (menus, pickers). |

### `TimelineEvent`

```ts
interface TimelineEvent {
  id: string
  title: string
  startMinute: number      // minutes from midnight, e.g. 8*60 = 480 for 8am
  durationMinutes: number
  color?: string           // hex background color
  category?: string        // label shown in the event footer
}
```

### `DailyTimelineHandle` (imperative scroll)

```tsx
const ref = useRef<DailyTimelineHandle>(null)

// scroll so the current time is near the top
ref.current?.scrollToNow()

// scroll to a specific event
ref.current?.scrollToEvent('event-id')

// scroll to an arbitrary minute value
ref.current?.scrollToMinute(14 * 60) // 2pm

// access the scroll container (e.g. to attach a scroll listener)
ref.current?.scrollElement?.addEventListener('scroll', handler)

<DailyTimeline ... timelineRef={ref} />
```

### External drag-and-drop

Any element with `draggable` can drop onto the timeline. Pass the payload via `dataTransfer` and handle it in `onExternalDrop`:

```tsx
// draggable source
<div
  draggable
  onDragStart={e => {
    const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, offsetY }))
    setDragOffsetY(offsetY)
    setDragDuration(item.durationMinutes)
  }}
>
  {item.title}
</div>

// timeline
<DailyTimeline
  onExternalDrop={(data, startMinute) => {
    const { id } = JSON.parse(data)
    // add event at startMinute
  }}
  externalDragDuration={dragDuration}
  externalDragOffsetY={dragOffsetY}
/>
```

### Custom event cards (`renderEventContent`)

Replace the built-in card interior with your own UI. The component still handles drag, resize, and positioning — you own only the visual content:

```tsx
<DailyTimeline
  events={events}
  renderEventContent={event => (
    <div>
      <span style={{ fontWeight: 600 }}>{event.title}</span>
      <span style={{ fontSize: 11, color: '#888' }}>{event.category}</span>
    </div>
  )}
/>
```

Return `null` to fall back to the default rendering for a specific event.

### Inline slot creation (`renderSlotAction`)

Receive a `startMinute` and a `close()` callback when the user clicks a slot row:

```tsx
<DailyTimeline
  events={events}
  renderSlotAction={(startMinute, close) => (
    <form onSubmit={e => { e.preventDefault(); addEvent(startMinute); close() }}>
      <input autoFocus placeholder="New task…" />
      <button type="submit">Add</button>
      <button type="button" onClick={close}>Cancel</button>
    </form>
  )}
/>
```

## Styling

Import `@papesce/dayslot/style.css` for the default theme. All classes use the `ds-timeline` prefix — override any in your own stylesheet.

### CSS custom properties

| Variable | Default | Description |
|---|---|---|
| `--ds-hour-col` | `52px` | Width of the time-axis gutter (hour labels) |
| `--ds-event-padding` | `6px 10px` | Padding inside each event card |
| `--ds-event-gap` | `2px` | Gap between event cards |
| `--ds-line-color` | `rgba(0,0,0,0.15)` | Color of hour gridlines |
| `--ds-line-width` | `1px` | Width of hour gridlines |
| `--ds-marker-color` | `rgba(0,0,0,0.08)` | Color of subdivision markers |
| `--ds-marker-width` | `0.5px` | Width of subdivision markers |
| `--ds-slot-action-z-index` | `10` | Z-index of the slot action overlay |
| `--ds-slot-action-bg` | `#fff` | Background of the slot action overlay |

Override in your own stylesheet:

```css
.ds-timeline {
  --ds-event-gap: 0;
  --ds-line-color: rgba(0,0,0,0.03);
}
```

## License

MIT
