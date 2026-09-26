# LHCC release handoff preference

After pushing an LHCC release, include a clickable production link
(`https://lhcc-lb.com`) and the exact Vercel deployment link in the handoff.
When release verification is requested, check deployment status, the deployed
Git commit, domain routing, and relevant runtime checks. Report failures and
untested flows accurately. Use the existing Git auto-deployment integration;
do not manually deploy solely because a commit was pushed.
