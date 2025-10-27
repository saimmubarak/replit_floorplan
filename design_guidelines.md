# Floorplan Wizard Design Guidelines

## Design Approach

**Selected Approach:** Design System - Fluent Design + Apple HIG Hybrid

**Justification:** This is a precision CAD tool requiring maximum efficiency, clarity, and usability. The design will prioritize function over form, with clean interfaces that don't distract from the technical work.

**Core Principles:**
1. Clarity and precision in all UI elements
2. Efficiency-first interactions with minimal chrome
3. Professional technical aesthetic appropriate for architectural work
4. Consistent, learnable interface patterns

---

## Typography System

**Font Stack:**
- Primary: Inter (Google Fonts) - excellent for UI, highly legible at small sizes
- Monospace: JetBrains Mono (Google Fonts) - for numerical inputs and measurements

**Type Scale:**
- Canvas measurements: text-xs (12px) - Monospace, Medium
- Tool labels: text-sm (14px) - Regular
- Input fields: text-sm (14px) - Medium
- Section headers: text-base (16px) - Semibold
- Step titles: text-lg (18px) - Semibold
- Wizard step numbers: text-2xl (24px) - Bold

**Hierarchy Rules:**
- All measurements and coordinates use monospace for scanning precision
- Tool names and UI labels use Inter Regular
- Active states and selected items use Semibold weight
- Headers use consistent size progression (never skip sizes)

---

## Layout System

**Spacing Primitives:** Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Tight spacing: p-1, gap-2 (within tool groups, measurement labels)
- Standard spacing: p-4, gap-4 (panel padding, form fields)
- Section spacing: p-6, py-8 (panel headers, wizard steps)
- Large spacing: p-12, py-16 (only for modal dialogs)

**Application Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step Indicator Bar (h-16, px-6)                            │
├──────┬──────────────────────────────────────────┬───────────┤
│ Left │          Canvas Area                     │   Right   │
│ Side │     (flex-1, centered A2 sheet)          │   Panel   │
│ Panel│                                          │  (w-80)   │
│(w-64)│                                          │           │
│      │                                          │           │
│      │                                          │           │
│      │    Toolbar (fixed bottom, h-14)          │           │
└──────┴──────────────────────────────────────────┴───────────┘
```

**Panel Structure:**
- Left Sidebar: w-64, border-r, divide-y for sections
- Right Properties: w-80, border-l, overflow-y-auto
- Canvas: flex-1 with centered content (A2 sheet)
- Top Steps Bar: h-16, border-b, flex justify-between
- Bottom Toolbar: h-14, border-t, flex gap-1

**Grid System for Panels:**
- Form rows: grid grid-cols-2 gap-4 (label + input pairs)
- Tool groups: grid grid-cols-4 gap-2 (4 tools per row)
- Properties: flex flex-col gap-6 (vertical stacking)

---

## Component Library

### Navigation & Steps

**Step Indicator:**
- Horizontal flex layout with 4 steps
- Each step: Circle (w-10 h-10) + Label below
- Active step: Ring decoration, Semibold text
- Completed: Checkmark icon inside circle
- Inactive: Reduced opacity (opacity-40)
- Connector lines between circles (h-0.5, flex-1)

**Wizard Navigation:**
- Previous/Next buttons: Fixed at top-right of step bar
- Primary button (Next): px-6 py-2, rounded-md
- Secondary (Previous): px-6 py-2, rounded-md, outlined
- Gap between buttons: gap-3

### Forms & Inputs

**Text Inputs (Dimensions):**
- Height: h-10
- Padding: px-3
- Border: border rounded-md
- Focus: ring-2 ring-offset-1
- Suffix labels (ft): Absolute positioned inside input, right-2
- Width inputs always paired with height in 2-column grid

**Button Styles:**
- Primary action: px-4 py-2, rounded-md, font-medium
- Secondary: px-4 py-2, rounded-md, border, font-medium
- Icon buttons (tools): w-10 h-10, rounded-md, flex items-center justify-center
- Active tool: ring-2 decoration

**Toggle Switches:**
- Switch container: w-11 h-6, rounded-full
- Switch thumb: w-5 h-5, rounded-full, transition-transform
- Label: text-sm, ml-3

### Canvas & Toolbar

**Toolbar Layout:**
- Fixed bottom bar: h-14, px-4
- Tool groups separated by vertical dividers (h-8, w-px)
- Group 1: Drawing tools (6 buttons)
- Group 2: View controls (Pan, Zoom +/-, Grid, Snap)
- Group 3: History (Undo, Redo)
- Group 4: Actions (Export, Save)

**Tool Buttons:**
- Size: w-10 h-10
- Icon size: 20px (w-5 h-5)
- Active state: ring-2 inset
- Tooltip on hover: Absolute positioned, -top-10

**Canvas Controls:**
- Zoom display: Fixed top-right of canvas, px-3 py-1, rounded-md, text-sm monospace
- Grid overlay: SVG pattern with 1ft spacing at current zoom
- Snap indicator: Small circle (w-3 h-3) at snap point, pulsing animation

### Measurement Labels

**On-Canvas Labels:**
- Font: text-xs monospace
- Background: px-2 py-0.5, rounded-sm, backdrop-blur-sm
- Position: Centered on edge, slightly offset (4px perpendicular)
- Rotation: Aligned with edge angle
- Arrow indicators: Small SVG arrows at label ends

**Format:**
- Display: "50.0 ft" or "25.5 ft" (always 1 decimal)
- Min width to prevent jitter: min-w-[4rem]

### Properties Panel

**Section Structure:**
- Section header: text-base semibold, mb-4
- Field rows: mb-4 spacing between
- Label above input pattern: mb-1.5 spacing
- Divider between sections: border-t, my-6

**Property Groups:**
1. **Object Info:** Name, Type (read-only fields)
2. **Dimensions:** Width, Height with lock icon between
3. **Appearance:** Stroke weight, Stroke color picker
4. **Behavior:** Layer dropdown, Label visibility toggle

**Field Layouts:**
- Dimension pairs: grid grid-cols-[1fr_auto_1fr] gap-2
- Lock icon in middle column: w-6, clickable
- Single fields: Full width
- Color picker: h-10, rounded-md, border, cursor-pointer

### Transform Handles

**Handle Visuals:**
- Corner handles: w-3 h-3, rounded-sm, border-2
- Midpoint handles: w-3 h-3, rounded-full, border-2
- Center handle: w-4 h-4, rounded-full, border-2
- Rotation handle: w-3 h-3, rounded-sm, with rotation icon

**Hover States:**
- Scale: transform scale-125
- Cursor changes: resize cursors per direction
- Transition: transition-transform duration-100

**During Transform:**
- Ghost shape: stroke-dasharray, opacity-50
- Active handle: scale-150
- Guide lines: stroke-width-1, stroke-dasharray-2

### Modal Dialogs

**Export Dialog:**
- Max width: max-w-md
- Padding: p-6
- Header: text-lg semibold, mb-6
- Form fields: space-y-4
- Footer buttons: flex justify-end gap-3, mt-8
- DPI options: Radio group, grid grid-cols-2 gap-3

**Preset Selection:**
- Card grid: grid grid-cols-2 gap-4
- Card: p-4, rounded-lg, border-2, cursor-pointer, hover:border-current
- Card content: Icon top, Text below, Dimensions in monospace

---

## Animations

**Micro-interactions Only:**
- Tool selection: transition-all duration-100
- Handle hover: transition-transform duration-100
- Panel expand/collapse: transition-all duration-200
- Snap indicator pulse: animate-pulse (built-in)

**No Animations:**
- Page transitions
- Canvas operations (instant feedback critical)
- Measurement updates
- Property changes

---

## Accessibility

**Keyboard Navigation:**
- All tools: Number keys 1-8 for tool selection
- Arrow keys: Nudge selected shape 0.1ft (Shift for 1ft)
- Space: Toggle pan mode
- Ctrl/Cmd + Z/Y: Undo/Redo
- Delete: Remove selected shape
- Tab: Navigate form fields in logical order

**Screen Reader Support:**
- All icon buttons: aria-label with tool name
- Current tool: aria-current="true"
- Canvas: aria-label describing current step
- Measurements: aria-live regions for value changes
- Step indicator: role="progressbar"

**Visual Indicators:**
- Focus rings: ring-2 ring-offset-2 on all interactive elements
- Active state always distinct from inactive
- Sufficient contrast for all text (minimum WCAG AA)
- Tool state communicated through both icon and ring

---

## Responsive Strategy

**Desktop-First (this is a desktop tool):**
- Minimum viewport: 1280px wide
- Optimal: 1440px+ wide
- Panels fixed width, canvas scales
- No mobile layout (show message: "Desktop browser required")

**Tablet (1024px):**
- Collapse right panel to overlay when not in use
- Reduce left panel to w-56
- Maintain all functionality