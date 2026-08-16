# Jureminha 2.0

SaaS pessoal de gestão de clientes, empréstimos, parcelas, pagamentos e recebimentos, construído em Next.js + TypeScript + Supabase.

## O que já está implementado

- Login com Supabase Auth e proteção de rotas via `proxy.ts`.
- Dashboard responsivo com cards clicáveis, gráficos, próximos recebimentos e atrasados.
- Clientes + perfil financeiro/extrato.
- Empréstimos com retorno percentual ou fixo, parcelamento e geração automática de vencimentos.
- Pagamentos integrais e parciais, ligados a cliente/empréstimo/parcela.
- Calendário mensal no desktop e lista/agenda no mobile.
- Fluxo de caixa, relatórios, ranking, simulador e notificações.
- Tema dark premium, sidebar desktop e bottom navigation mobile.
- Banco PostgreSQL com RLS, índices, logs, anexos, configurações e trigger de sincronização de pagamentos.
- Modo demonstração isolado: exibe dados fictícios apenas quando as variáveis do Supabase não estão configuradas.

## 1. Instalar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## 2. Configurar Supabase

1. Crie um projeto no Supabase.
2. Aplique as migrations de `supabase/migrations/` **na ordem** (`0001`, depois `0002`).
3. A migration cria o bucket privado `private-documents` e as políticas RLS necessárias.
4. Em Authentication, crie o usuário que terá acesso ao sistema (o app não mostra cadastro público).
5. Copie URL e chave pública/publishable para `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no navegador ou em variável `NEXT_PUBLIC_*`.

## 3. GitHub

```bash
git init
git add .
git commit -m "feat: Jureminha 2.0 initial release"
git branch -M main
git remote add origin SEU_REPOSITORIO
git push -u origin main
```

`.env` e `.env.local` estão ignorados pelo Git.

## 4. Vercel

1. Importe o repositório GitHub na Vercel.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_APP_URL`.
3. Aplique essas três variáveis aos ambientes **Production** e **Preview**.
4. Faça Deploy.
5. No Supabase Auth, configure o domínio final da Vercel nas URLs permitidas para recuperação de senha.

Cada push na branch conectada pode gerar um novo deploy automaticamente.

## Regras financeiras importantes

- O registro real de dinheiro recebido fica em `payments`.
- `installments.amount_paid` e `remaining_amount` são sincronizados pelo trigger do banco.
- Uma parcela com saldo restante e vencimento anterior à data atual é considerada atrasada.
- O fuso usado para a regra automática no banco é `America/Sao_Paulo`.
- Não apague pagamentos para corrigir histórico em produção; prefira implementar estorno usando `voided_at`/`void_reason`.

## Estrutura

- `app/` — rotas e server actions.
- `components/` — UI, dashboard, calendário e formulários.
- `lib/` — regras financeiras, dados e clientes Supabase.
- `supabase/migrations/` — schema PostgreSQL + RLS.
- `docs/original-specs/` — especificações originais fornecidas para o projeto.

## Antes de produção

Rode:

```bash
npm run typecheck
npm run lint
npm run build
```

Recomenda-se também adicionar testes automatizados para cálculos, pagamentos parciais, estornos e regras de vencimento antes de usar com dados financeiros reais.
