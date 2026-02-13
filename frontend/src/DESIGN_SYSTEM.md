# Unified Design System — iOS Liquid Glass

Single source of truth for all UI: colors, borders, fonts. Changes in `styles.css` propagate to **all** tabs and pages automatically.

## Theme Provider

- **ThemeContext** (`contexts/ThemeContext.tsx`): Global dark/light state. Use `useTheme()` for `dark`, `setDark`, `toggleTheme`.
- Theme toggle in header syncs across App and Admin Hub via `theme-update` event.
- `document.documentElement.classList.toggle("dark", dark)` drives CSS variable switching.

## CSS Variables (styles.css)

### Light Mode (:root)
| Variable | Use |
|----------|-----|
| `--glass-bg` | Cards, inputs, panels (translucent #F0F2F5 80%) |
| `--glass-bg-strong` | Headers, dropdowns |
| `--glass-border` | Borders (subtle, premium feel) |
| `--glass-text` | Primary text |
| `--glass-text-muted` | Secondary labels |
| `--glass-text-subtle` | Tertiary / hints |
| `--accent-primary` | Purple #7C3AED |
| `--accent-secondary` | Green #00b074 |
| `--page-bg-animated` | Animated background gradient |

### Dark Mode (.dark)
Same variables; values switch to deep translucent + vibrant accents.

### Utilities
- **`.glass-card`** — Data cards, tables
- **`.glass-panel`** — Headers, prominent panels
- **`.glass-btn`** — Buttons, controls
- **`.glass-input`** — Input fields
- **`.page-card`** — Page content cards (unified light/dark)
- **`.filter-std`** / **`.filter-dropdown`** — Filter bar controls
- **`.signature-footer`** — "Directed by SAIF" footer

## Rules for New UI

1. **Use design tokens** — Never hardcode `#F8F9FA`, `text-slate-800`, etc. Use `[color:var(--glass-text)]` or `className="page-card"`.
2. **One change, all tabs** — Modify `styles.css` variables or add/update utility classes. All pages using them update automatically.
3. **backdrop-filter** — All cards use `backdrop-filter: blur(20px)` for liquid glass.
4. **Transitions** — Theme switch uses `transition: 0.3s–0.4s ease` for smooth mode changes.

## Brand & Data Logic (Unchanged)

- **Brand list**: All 6 brands (8OZ, TEA PLUS, SWEET BREAD, HEMI, CHART, BLANCA) always visible in filter.
- **Branch cleanup**: "Main" and "Branch" excluded globally.
- **Net Sales / صافي المبيعات**: Uses `system_total_sales`; logic unchanged.
