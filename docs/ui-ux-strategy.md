# UI/UX: Imbabura en Vivo

## Operator priorities
- Keep clock and score controls prominent. Put statistics in a disclosure section.
- Distinguish prepared graphics from the OBS program output. Emitting a graphic is an explicit action.
- Preserve tournament selection, link management and logout on mobile through the More menu.
- Label token rotation as regeneration: it invalidates the previous link.
- Report connection failures and the timestamp of the received state without promising synchronization.

## Responsive layout
- Desktop: flexible control and preview columns, with a sticky preview.
- Tablet: a single column when the control area cannot fit comfortably.
- Mobile: bottom navigation, accessible More menu, readable labels and controls at least 44px high.
- Statistics use separate labels and two team columns on mobile.
- OBS retains its 1920 x 1080 canvas. Preview containers use ResizeObserver to scale the canvas to the available width.

## Verification
- Component tests cover menu access and connection failure feedback.
- Run the production frontend build after changes.
- Visual acceptance still requires desktop, tablet and phone checks: 1440, 1024, 768, 390 and 320px widths, long tournament/team names, expanded statistics, preview modal and keyboard navigation.
- Verify actual OBS rendering with a configured backend before broadcasting.
