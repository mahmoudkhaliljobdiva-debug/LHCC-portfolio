// Shared local browser evidence for the dialogs changed by the full-project audit.
import { pause } from './qa-browser.mjs';

export async function captureDialogEvidence(page, name) {
  for (const dark of [false, true]) for (const width of [320, 768, 1366, 1920]) {
    await page.resize(width);
    await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
    await pause(100);
    await page.healthy(name + ' ' + width + ' ' + (dark ? 'dark' : 'light'));
    await page.screenshot('audit-dialog-' + name + '-' + width + '-' + (dark ? 'dark' : 'light'));
  }
}
