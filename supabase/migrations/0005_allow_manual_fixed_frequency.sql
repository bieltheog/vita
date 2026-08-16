alter table public.loans
  drop constraint if exists loans_payment_frequency_check;

alter table public.loans
  add constraint loans_payment_frequency_check
  check (
    payment_frequency = any (
      array[
        'UNICO'::text,
        'DIARIO'::text,
        'SEMANAL'::text,
        'QUINZENAL'::text,
        'MENSAL'::text,
        'PERSONALIZADO'::text,
        'DATAS_FIXAS'::text
      ]
    )
  );
