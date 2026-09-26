# Authentication and UI consistency verification

The focused update preserves existing database schema, RLS, access approvals,
attempt/scoring operations, and wallet ledger behavior.

- Login returns a confirmed portal destination after the existing Auth/profile
  checks. The client navigates only after success, avoiding redirect control flow
  entering its generic error handler. A synchronous submission guard prevents
  duplicate submissions while the button is disabled.
- Public navigation reads the authenticated profile on the server. Public and
  dashboard avatars link to `/account/settings`, which reads the guarded real
  profile and links back to the correct role portal.
- All form/filter selects use `components/ui/select.tsx`. Native select
  interaction is intentional for mobile touch pickers, keyboard navigation,
  country autocomplete, required-field validation, and accessible form labels.
  The shared styling removes the default control appearance and supplies the
  consistent chevron, focus, disabled, error, and theme behavior.
- Tables retain natural word boundaries, complete badges, and horizontal
  scrolling. Admin Users has a 1360px minimum table width and wider name/email
  columns. Mobile email cards truncate with the complete value in a title.
- Audited tables: Admin Users, bank questions, student activity by bank, wallet
  transactions, and manual wallet tickets.
- Dark hover/focus mappings use the existing slate and medical-blue palette.

`scripts/ui-consistency-test.mjs` exercises the existing QA accounts, all three
role session round trips, account profiles, responsive light/dark routes at
390, 430, 768, 1024, 1366, 1536, and 1920px, select styling, table wrapping and
scrolling, incorrect-password feedback, console errors, and HTTP 5xx responses.
These checks are Edge browser emulation rather than physical phone testing.

## Portfolio reset boundary

Read-only production inspection confirmed all four database default sections
pass the database validator and the authenticated role can execute both reset
wrappers. The reset function succeeded in a transaction that was rolled back;
no published content changed. The reported failure was not reproduced by this
database check. The editor now clears stale feedback and disables its confirm
button while restoring.

The full browser save/reset/persistence test is still unverified. Automatic
approval review rejected the proposed production reset-and-restore diagnostic
because a failed restoration could disrupt published content. A permitted test
environment or explicit approval for that exact production mutation is needed
to finish this case. Do not interpret the rolled-back database test as a full
CMS browser PASS.
