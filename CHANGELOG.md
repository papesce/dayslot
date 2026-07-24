# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-07-23

### Added
- `showMarkers` prop — control subdivision gridline visibility (`'none'` | `'hover'` | `'always'`).
- `showLabels` prop — show time labels on subdivision gridlines.
- `scrollElement` on `DailyTimelineHandle` — exposes the scroll container for attaching listeners or calculating scroll-aware portal positions.
- `onScroll` callback prop — notified when the timeline body scrolls; useful for dismissing overlay UI.

### Changed
- Time-axis gutter redesigned following Apple HIG: hour labels are bold/dark, subdivision labels are muted, gridlines start after the gutter via `::after` pseudo-element so lines never cross label text.
- Prop `slotIntervalMinutes` renamed to `slotMinutes`.

### Fixed
- Active slot action (dialog opened via + button) now positions precisely at the clicked subdivision line instead of defaulting to the row top.

## [0.4.1] - 2026-07-15

### Fixed
- Add `user-select: none` to timeline root to prevent drag conflicts.

## [0.4.0] - 2026-07-10

### Added
- `slotIntervalMinutes` prop — configurable slot row granularity (15, 30, 60, or 120 minutes per row). Defaults to `60` for backward-compatible behavior. Off-hour slot labels render as `"8:30"`, `"8:15"`, etc.

## [0.3.3] - 2026-06-22

### Added
- `slotActionTrigger` prop — controls what activates the slot action: `'row'` (row click only), `'button'` (+ button only), or `'both'` (default).

## [0.3.1] - 2026-06-21

### Added
- `showCurrentTime` prop — show or hide the current-time indicator line (default `true`).

## [0.2.0] - 2026-06-20

### Added
- `renderEventContent` prop — override the interior of every event card with custom UI.
- `renderSlotAction` prop — render an inline action form when a slot row is clicked.

### Changed
- Demo updated with a second tab showcasing `renderEventContent` and `renderSlotAction` with area dots, status badges, and an inline task-creation form.

## [0.1.0] - 2026-06-19

### Added
- Initial release — `DailyTimeline` component with drag-to-move, resize, overlap layout, external drag-and-drop, drop preview ghost, edge-scroll, now indicator, imperative scroll handle (`scrollToNow`, `scrollToEvent`, `scrollToMinute`), and event removal.
