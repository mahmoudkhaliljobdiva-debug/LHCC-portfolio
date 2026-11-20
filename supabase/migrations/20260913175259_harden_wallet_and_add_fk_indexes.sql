begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Wallet reads and writes are available only through admin-authorized RPCs.
-- This explicit deny policy documents that contract and keeps direct Data API
-- access closed even if a table grant is added accidentally in the future.
create policy no_direct_wallet_access
on public.wallet_transactions
for all
to authenticated
using (false)
with check (false);

create index portfolio_content_updated_by_idx
  on public.portfolio_content(updated_by)
  where updated_by is not null;
create index question_banks_created_by_idx
  on public.question_banks(created_by)
  where created_by is not null;
create index wallet_transactions_created_by_idx
  on public.wallet_transactions(created_by)
  where created_by is not null;

commit;
