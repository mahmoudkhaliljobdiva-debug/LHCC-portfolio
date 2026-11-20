// Backward-compatible entry point for the current single-question exam interface.
// Uses isolated LOCAL fixtures only; legacy production-fixture deletion is no longer needed.
// Run archive-qa-fixtures.mjs setup --fresh and start the local QA server first.
await import('./archive-browser-test.mjs');
