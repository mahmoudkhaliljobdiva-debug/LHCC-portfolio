# UI and responsive review

Reviewed September 13, 2026. This cleanup changes presentation only. Authentication,
Supabase access, course approval, wallet calculations, roles, and question behavior
remain unchanged.

## Audit scope

All TSX and CSS files under `src/app`, `src/components`, `src/features`, and
`src/layouts` were inventoried and checked for typography, controls, touch targets,
fixed dimensions, overflow, cards, tables, dialogs, navigation, charts, empty/error
states, and dark-mode contrast. Inter remains the single approved font family.

The principal findings were:

- The signup country select escaped its grid column at tablet width and overlapped
  the phone input.
- Public desktop navigation activated too early at 768px for its full link set.
- Form controls mixed 40px, 44px, and 48px heights and mobile text could fall below
  Safari's zoom-safe size.
- Several icon-only actions had interactive areas below 44px.
- Dialogs did not share a viewport-height/scroll rule and some action rows could
  crowd a 320px screen.
- Selects and semantic alert colors were incomplete in dark mode.
- Long content did not have one consistent emergency wrapping rule.

## Implemented cleanup

- Standard controls now use a 48px height, consistent radius and focus treatment;
  mobile inputs, selects, and textareas render at 16px.
- Invalid, disabled, reduced-motion, dark-select, semantic alert, long-text, and
  scroll-region behavior is defined centrally in `globals.css`.
- Buttons have a minimum 44 by 44px interaction area.
- Dialogs are constrained to the dynamic viewport and scroll internally. Important
  action rows stack on narrow screens.
- Signup grid children use `min-width: 0` and full-width controls.
- Public navigation stays in its mobile form through tablet widths; the mobile menu
  now includes the same Explore demo action as desktop.
- Dashboard navigation is viewport-bounded, scrollable, and its compact header hides
  nonessential identity decoration at the narrowest widths.
- Public hero/page headings, spacing, decorative panels, and portfolio layouts scale
  down calmly at phone widths.
- Existing mobile user cards remain the strategy for the wide Users table. Other
  data-heavy tables retain deliberate horizontal scrolling rather than compressing
  columns into unreadable layouts. The question table is a named keyboard-focusable
  scroll region.
- Recharts already use `ResponsiveContainer`; their parent grids and cards were
  verified not to overflow.

## Responsive verification

An isolated headless Edge session loaded the public pages, authentication pages, and
temporary local-only Student, Teacher, and Admin dashboard fixtures. The fixture was
removed immediately after testing. The test asserts rendered content, absence of the
Next.js error overlay, no document-level horizontal overflow, minimum button target
height, and 16px mobile form text.

- 320px: PASS
- 375px: PASS
- 390px: PASS
- 430px: PASS
- 768px: PASS
- 1024px: PASS
- 1366px: PASS
- 1536px: PASS
- 1920px: PASS

Native select option menus can differ slightly by operating system/browser; their
closed controls, sizing, contrast, labels, and keyboard focus are standardized.
