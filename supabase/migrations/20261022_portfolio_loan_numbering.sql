-- Numeração visível separada por carteira, preservando o identity global como chave técnica.
-- Carteira 1 (legada): EMP-0001A, EMP-0002A, ...
-- Carteira 2 (nova):    EMP-0001,  EMP-0002,  ...

alter table public.loans
  add column if not exists portfolio_loan_number bigint;

with numbered as (
  select
    id,
    case
      when portfolio_id = 1 then loan_number
      else row_number() over (
        partition by user_id, portfolio_id
        order by created_at, loan_number, id
      )
    end::bigint as portfolio_number
  from public.loans
)
update public.loans l
set portfolio_loan_number = n.portfolio_number
from numbered n
where l.id = n.id
  and l.portfolio_loan_number is null;

alter table public.loans
  alter column portfolio_loan_number set not null;

alter table public.loans
  drop constraint if exists loans_portfolio_loan_number_check;

alter table public.loans
  add constraint loans_portfolio_loan_number_check
  check (portfolio_loan_number > 0);

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='loans'
      and a.attname='loan_code'
      and a.attgenerated='s'
  ) then
    execute 'alter table public.loans alter column loan_code drop expression';
  end if;
end;
$$;

alter table public.loans
  drop constraint if exists loans_loan_code_key;

update public.loans
set loan_code =
  'EMP-' || lpad(portfolio_loan_number::text, 4, '0') ||
  case when portfolio_id = 1 then 'A' else '' end;

alter table public.loans
  drop constraint if exists loans_user_loan_code_key;

alter table public.loans
  add constraint loans_user_loan_code_key
  unique (user_id, loan_code);

alter table public.loans
  drop constraint if exists loans_user_portfolio_number_key;

alter table public.loans
  add constraint loans_user_portfolio_number_key
  unique (user_id, portfolio_id, portfolio_loan_number);

create or replace function private.assign_portfolio_loan_number()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if new.portfolio_loan_number is null then
    perform pg_advisory_xact_lock(
      hashtextextended(new.user_id::text || ':' || new.portfolio_id::text, 0)
    );

    select coalesce(max(l.portfolio_loan_number), 0) + 1
      into new.portfolio_loan_number
    from public.loans l
    where l.user_id = new.user_id
      and l.portfolio_id = new.portfolio_id;
  end if;

  new.loan_code :=
    'EMP-' || lpad(new.portfolio_loan_number::text, 4, '0') ||
    case when new.portfolio_id = 1 then 'A' else '' end;

  return new;
end;
$$;

drop trigger if exists assign_portfolio_loan_number_trigger on public.loans;

create trigger assign_portfolio_loan_number_trigger
before insert on public.loans
for each row
execute function private.assign_portfolio_loan_number();

create or replace function private.lock_portfolio_loan_number()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.portfolio_loan_number is distinct from new.portfolio_loan_number
     or old.loan_code is distinct from new.loan_code then
    raise exception 'A numeração visível do empréstimo é imutável';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_portfolio_loan_number_trigger on public.loans;

create trigger lock_portfolio_loan_number_trigger
before update of portfolio_loan_number, loan_code on public.loans
for each row
execute function private.lock_portfolio_loan_number();
