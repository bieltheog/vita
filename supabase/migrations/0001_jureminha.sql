-- JUREMINHA 2.0 — schema de produção
-- Banco pessoal de clientes, empréstimos, parcelas e recebimentos.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cpf text,
  phone text,
  whatsapp text,
  email text,
  birth_date date,
  address text,
  city text,
  state text,
  zipcode text,
  profession text,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  loan_number bigint generated always as identity,
  loan_code text generated always as ('EMP-' || lpad(loan_number::text, 4, '0')) stored,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  principal_amount numeric(14,2) not null check (principal_amount > 0),
  return_percentage numeric(9,4),
  fixed_return_amount numeric(14,2),
  expected_profit numeric(14,2) not null check (expected_profit >= 0),
  total_receivable numeric(14,2) not null check (total_receivable >= principal_amount),
  payment_frequency text not null check (payment_frequency in ('UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','PERSONALIZADO')),
  installment_count integer not null check (installment_count > 0),
  start_date date not null,
  first_due_date date not null,
  status text not null default 'ATIVO' check (status in ('ATIVO','FINALIZADO','CANCELADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_code)
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  original_due_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  remaining_amount numeric(14,2) not null check (remaining_amount >= 0),
  stored_status text not null default 'PENDENTE'
    check (stored_status in ('PENDENTE','PAGO','ATRASADO','PARCIAL','REAGENDADO','CANCELADO')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, installment_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  loan_id uuid not null references public.loans(id) on delete restrict,
  installment_id uuid references public.installments(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  payment_time time,
  payment_method text not null check (payment_method in ('PIX','DINHEIRO','TRANSFERENCIA','OUTRO')),
  notes text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  system_name text not null default 'Jureminha 2.0',
  owner_name text,
  currency text not null default 'BRL',
  date_format text not null default 'dd/MM/yyyy',
  theme text not null default 'dark' check (theme in ('system','light','dark')),
  default_return_percentage numeric(9,4),
  default_payment_method text default 'PIX',
  monthly_goal numeric(14,2),
  reminder_days integer[] default '{0,1,3}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_user_name_idx on public.clients(user_id, name);
create index if not exists loans_user_client_idx on public.loans(user_id, client_id);
create index if not exists loans_user_status_idx on public.loans(user_id, status);
create index if not exists installments_user_due_idx on public.installments(user_id, due_date);
create index if not exists installments_loan_idx on public.installments(loan_id);
create index if not exists installments_client_idx on public.installments(client_id);
create index if not exists payments_user_date_idx on public.payments(user_id, payment_date);
create index if not exists payments_installment_idx on public.payments(installment_id);
create index if not exists logs_user_created_idx on public.activity_logs(user_id, created_at desc);

-- Cria automaticamente o perfil/configuração do primeiro usuário administrativo.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuário'), new.email)
  on conflict(id) do nothing;

  insert into public.settings(user_id)
  values(new.id)
  on conflict(user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Mantém parcela sincronizada a partir da única fonte real de recebimentos: payments.
create or replace function private.sync_installment_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  owner_id uuid;
  paid numeric(14,2);
  total numeric(14,2);
  due date;
  current_status text;
begin
  target_id := coalesce(new.installment_id, old.installment_id);
  if target_id is null then
    return coalesce(new, old);
  end if;

  select user_id, amount, due_date, stored_status
    into owner_id, total, due, current_status
  from public.installments
  where id = target_id;

  -- Trigger só pode recalcular uma parcela do mesmo usuário do pagamento.
  if coalesce(new.user_id, old.user_id) is distinct from owner_id then
    raise exception 'Usuário do pagamento não corresponde ao proprietário da parcela';
  end if;

  select coalesce(sum(amount), 0)
    into paid
  from public.payments
  where installment_id = target_id and voided_at is null;

  if paid > total then
    raise exception 'Pagamentos excedem o valor da parcela';
  end if;

  update public.installments
  set amount_paid = paid,
      remaining_amount = greatest(total - paid, 0),
      stored_status = case
        when current_status = 'CANCELADO' then 'CANCELADO'
        when paid >= total then 'PAGO'
        when paid > 0 then 'PARCIAL'
        when due < (now() at time zone 'America/Sao_Paulo')::date then 'ATRASADO'
        when current_status = 'REAGENDADO' then 'REAGENDADO'
        else 'PENDENTE'
      end,
      paid_at = case when paid >= total then now() else null end,
      updated_at = now()
  where id = target_id and user_id = owner_id;

  return coalesce(new, old);
end;
$$;
revoke all on function private.sync_installment_after_payment() from public, anon, authenticated;

drop trigger if exists payments_sync_installment on public.payments;
create trigger payments_sync_installment
  after insert or update or delete on public.payments
  for each row execute function private.sync_installment_after_payment();

-- RLS obrigatório em todas as tabelas do schema exposto.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.loans enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.client_notes enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

-- Políticas específicas por proprietário. UPDATE inclui USING + WITH CHECK.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Helper repetido explicitamente para manter as políticas legíveis e auditáveis.
drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_own on public.clients for delete to authenticated using ((select auth.uid()) = user_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loans','installments','payments','client_notes','attachments','notifications','activity_logs','settings']
  LOOP
    EXECUTE format('drop policy if exists %I_select_own on public.%I', t, t);
    EXECUTE format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    EXECUTE format('drop policy if exists %I_insert_own on public.%I', t, t);
    EXECUTE format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    EXECUTE format('drop policy if exists %I_update_own on public.%I', t, t);
    EXECUTE format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    EXECUTE format('drop policy if exists %I_delete_own on public.%I', t, t);
    EXECUTE format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  END LOOP;
END $$;

-- 2026: opt-in explícito para Data API, além do RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.loans to authenticated;
grant select, insert, update, delete on public.installments to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.client_notes to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.activity_logs to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Bucket privado para comprovantes/documentos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('private-documents', 'private-documents', false, 10485760)
on conflict (id) do update set public = false;

-- Storage por pasta raiz = auth.uid().
drop policy if exists storage_read_own on storage.objects;
create policy storage_read_own on storage.objects for select to authenticated
using (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists storage_insert_own on storage.objects;
create policy storage_insert_own on storage.objects for insert to authenticated
with check (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists storage_update_own on storage.objects;
create policy storage_update_own on storage.objects for update to authenticated
using (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists storage_delete_own on storage.objects;
create policy storage_delete_own on storage.objects for delete to authenticated
using (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
