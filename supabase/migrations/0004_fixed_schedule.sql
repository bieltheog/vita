alter table public.loans
  add column if not exists fixed_schedule jsonb not null default '{}'::jsonb;

comment on column public.loans.fixed_schedule is
  'Regras recorrentes de datas fixas. Ex.: {"rules":[{"type":"DAY_OF_MONTH","value":15},{"type":"BUSINESS_DAY","value":5}]}';
