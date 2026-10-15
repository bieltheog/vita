-- Caixa por carteira: migração aditiva, sem alteração ou exclusão de lançamentos históricos.
create table if not exists public.portfolio_cash_baselines (
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id smallint not null check (portfolio_id in (1,2)),
  start_date date not null,
  opening_balance numeric(14,2) not null check (opening_balance>=0),
  notes text,
  created_at timestamptz not null default now(),
  primary key(user_id,portfolio_id)
);
alter table public.portfolio_cash_baselines enable row level security;
create policy portfolio_cash_baselines_read on public.portfolio_cash_baselines
  for select to authenticated using (user_id=(select auth.uid()));
create policy portfolio_cash_baselines_insert on public.portfolio_cash_baselines
  for insert to authenticated with check (user_id=(select auth.uid()));
grant select,insert on public.portfolio_cash_baselines to authenticated;
-- Sem UPDATE/DELETE: corrigir eventuais diferenças por lançamento rastreável, nunca apagar marco inicial.

alter table public.portfolio_entries
  drop constraint if exists portfolio_entries_kind_check;
alter table public.portfolio_entries
  add constraint portfolio_entries_kind_check
  check(kind in ('APORTE','CREDITO','AMORTIZACAO_DIVIDA','JUROS_FINANCIAMENTO',
    'RETIRADA','DESPESA','PERDA','RECUPERACAO','OUTRA_ENTRADA','OUTRA_SAIDA'));
