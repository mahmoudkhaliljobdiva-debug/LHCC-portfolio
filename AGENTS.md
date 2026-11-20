# LHCC release handoff preference

After pushing an LHCC release, include a clickable production link
(`https://lhcc-lb.com`) and the exact Vercel deployment link in the handoff.
When release verification is requested, check deployment status, the deployed
Git commit, domain routing, and relevant runtime checks. Report failures and
untested flows accurately. Use the existing Git auto-deployment integration;
do not manually deploy solely because a commit was pushed.

# Source documents are an agent task, not a website feature

When the owner supplies a Drive link/PDF, read the accompanying classification
first (specialty, subject, chapter, exam or bank). Inspect the actual source and
reuse matching Supabase records; never infer classification from filenames alone.
Subjects contain questions directly. Create chapters/lessons only when genuinely
present and explicitly requested. Exam Tracks remain separate from Subjects.

Read the entire accessible source, preserve full wording/options/clinical context,
private answer keys and exact source/page/number references. Populate supported,
explicitly approved content directly through safe, repeatable database operations.
Check duplicates and preserve canonical IDs, attempts, students, payments, grants
and audit history. Never silently approve pending records or invent missing keys.
Query Supabase after writes and report added, existing and unresolved content.
If source/service access or approval is missing, report the exact blocker.

Do not add website PDF upload/parsing/OCR/extraction APIs, background processors,
import queues or multi-step import controls unless the owner explicitly requests
that product feature. Agent-only source tools may remain outside application code.
