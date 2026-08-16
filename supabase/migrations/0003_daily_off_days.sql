alter table public.loans
  add column if not exists daily_off_days smallint[] not null default '{}'::smallint[];

comment on column public.loans.daily_off_days is
  'Dias da semana sem cobrança para empréstimos DIARIO. 0=domingo ... 6=sábado.';
