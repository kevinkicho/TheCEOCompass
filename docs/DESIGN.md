# Design System

## Color Palette

### Primary Scale (`primary-*`)
Sky blue gradient — used for CTAs, active states, highlights, links.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#f0f9ff` | Definition blocks, selected quiz answers, section backgrounds |
| `primary-100` | `#e0f2fe` | Category badges, concept tags, filter pill dots |
| `primary-400` | `#38bdf8` | Left border accent on definition blocks |
| `primary-500` | `#0ea5e9` | Progress bars, pulse dots, active step indicators |
| `primary-600` | `#0284c7` | Primary buttons, active filter pills, brand accent |
| `primary-700` | `#0369a1` | Badge text, secondary button text |

### Dark Scale (`dark-*`)
Neutral slate — used for text, borders, backgrounds. Numbers increase = darker.

| Token | Hex | Light Mode Usage | Dark Mode Usage |
|-------|-----|-----------------|-----------------|
| `dark-50` | `#f8fafc` | Section bg, disabled concept cards | — |
| `dark-100` | `#f1f5f9` | Filter chips, step numbers, progress track | — |
| `dark-200` | `#e2e8f0` | Card borders, table dividers | — |
| `dark-300` | `#cbd5e1` | Hover borders, text • `text-dark-300` | — |
| `dark-400` | `#94a3b8` | Muted text • `text-dark-400` | — |
| `dark-500` | `#64748b` | Body text • `text-dark-500` | Muted text |
| `dark-600` | `#475569` | Secondary text • `text-dark-600` | — |
| `dark-700` | `#334155` | Strong text • `text-dark-700` | Borders, hover states |
| `dark-800` | `#1e293b` | Code blocks, formula display | Filter chip bg, hover states |
| `dark-900` | `#0f172a` | Headings • `text-dark-900` | Card bg, section bg |
| `dark-950` | `#020617` | — | Body bg |
| `dark-100` | — | — | Headings, primary text |

## Dark Mode

### Architecture
- **Strategy**: Tailwind `darkMode: "class"` — `dark` class is toggled on `<html>` element
- **Persistence**: `localStorage` key `"theme"`, falls back to `prefers-color-scheme`
- **Hydration**: `<html suppressHydrationWarning>` prevents flash of wrong theme
- **Component**: `ThemeProvider.tsx` (client component, wraps entire app)
- **Toggle**: Sun/moon icon button in Navbar

### Color Mapping Rules
When adding `dark:` variants to an existing class:

| Original | Dark Variant | Rationale |
|----------|-------------|-----------|
| `bg-white` | `dark:bg-dark-900` | Invert: white → near-black |
| `bg-dark-50` | `dark:bg-dark-900` | Very light → very dark |
| `bg-dark-100` | `dark:bg-dark-800` | Light gray → dark gray |
| `bg-dark-200` | `dark:bg-dark-700` | Light border → dark border |
| `bg-primary-50` | `dark:bg-primary-900/20` | Light blue → dark blue tint |
| `bg-primary-100` | `dark:bg-primary-900/30` | Light blue → dark blue tint |
| `text-dark-900` | `dark:text-dark-100` | Darkest text → lightest text |
| `text-dark-600` | `dark:text-dark-300` | Medium text → light text |
| `text-dark-500` | `dark:text-dark-300` | Body text → light text |
| `text-dark-400` | `dark:text-dark-300` | Muted text → light text |
| `text-primary-700` | `dark:text-primary-300` | Dark blue → light blue |
| `border-dark-200` | `dark:border-dark-700` | Light border → dark border |
| `hover:bg-dark-50` | `dark:hover:bg-dark-800` | Light hover → dark hover |

### Template Literal Gotcha
Conditional classes inside `${...}` template expressions are **not processed** by the Tailwind JIT scanner for the outer class string. Each string literal inside `${...}` must contain its own `dark:` variants.

```tsx
// CORRECT — dark variants inside the template string
className={`... ${active ? "bg-primary-600 text-white" : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-300"}`}

// WRONG — dark variants only at outer level (won't apply to conditional bg/text)
className={`... ${active ? "bg-primary-600" : "bg-dark-100 text-dark-600"} dark:bg-dark-800 dark:text-dark-300`}
```

### Form Inputs
`.dark input`, `.dark select`, `.dark textarea` get explicit CSS overrides in `globals.css`:
- `background-color: rgb(15 23 42)` (`dark-900`)
- `color: rgb(248 250 252)` (`dark-50`)
- `::placeholder` color: `rgb(100 116 139)` (`dark-500`)

## Typography

- **Font**: Inter (variable), system-ui fallback
- **Mono**: JetBrains Mono (for formulas/code)
- **Scale**: `text-3xl sm:text-4xl` for page titles, `text-5xl sm:text-7xl` for hero

## Component Patterns

### Navigation (Navbar.tsx)
- **Desktop**: `hidden md:flex` horizontal link row with hover effects
- **Mobile**: `md:hidden` hamburger → slide-down drawer with `animate-slide-up`
- **Theme toggle**: Always visible, 40×40px tap target

### Cards
- Rounded corners (`rounded-xl`)
- 1px border (`border-dark-200 dark:border-dark-700`)
- Hover: subtle border color shift + shadow
- Padding: `p-6` (24px)

### Modals
- Full-screen overlay: `fixed inset-0 bg-black/60` (darkens background)
- White card: `bg-white dark:bg-dark-900` with `rounded-xl shadow-2xl`
- Max height: `max-h-[85vh] overflow-y-auto`
- Close: X button in top-right corner

### Chips/Pills
- Filter chips: `rounded-full px-4 py-1.5 text-xs`
- Active: `bg-primary-600 text-white`
- Inactive: `bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-300`

### Concept Cards (Framework detail)
- Grid: `grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3`
- Clickable cards with modal: definition, formula, 3 numbered examples, tags
- Disabled state: `opacity-60 cursor-default` for concepts without definitions

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| `sm` | 640px | Two-column grid, smaller headings |
| `md` | 768px | Two-column grid on framework cards, show desktop nav |
| `lg` | 1024px | Three-column grid on concept cards, wider content areas |

- **Page titles**: `text-3xl sm:text-4xl`
- **Hero heading**: `text-3xl sm:text-5xl`
- **Journal form**: `grid-cols-1 sm:grid-cols-2`
- **Framework grid**: `md:grid-cols-2 lg:grid-cols-3`
- **Concept grid**: `sm:grid-cols-2 lg:grid-cols-3`

## Animation

Two keyframe animations defined in `globals.css`:
- `animate-fade-in`: opacity 0→1, 300ms ease-out
- `animate-slide-up`: opacity 0→1 + translateY -10px→0, 300ms ease-out

Used for modals, feedback panels, and mobile nav drawer.
