# SaaS de locação de brinquedos: arquivos iniciais

- `001_esquema_inicial.sql`: banco completo para o Supabase (isolamento por locadora, bloqueio de reserva dupla, link de reserva público). Cole no SQL Editor do Supabase.
- `testes_banco.sh` + `simulacao_supabase.sql`: 28 testes do banco num Postgres local (`sudo bash testes_banco.sh`).
- `locacao-brinquedos.html`: protótipo funcional (abre no navegador).

## Pedido inicial para o Claude Code

```
Quero construir um SaaS de gestão de locação de brinquedos para locadores.
Stack: Next.js (App Router) + Supabase, app instalável (PWA), mobile-first.

Arquivos nesta pasta:
- 001_esquema_inicial.sql: banco completo com RLS, já testado. Não altere
  as regras de acesso sem rodar testes_banco.sh de novo.
- locacao-brinquedos.html: protótipo funcional; reaproveite fluxos e textos
  (agenda, locações, contrato/termo com assinatura na tela, vistorias, caixa).

Fase 1 (fazer agora): login e cadastro da locadora (função criar_locadora,
com aceite dos termos), brinquedos, clientes, locações com checagem de
disponibilidade, agenda e caixa. Papéis: dono, operador, entregador.

Regras obrigatórias:
- A plataforma é só ferramenta de gestão: nunca recebe dinheiro de cliente
  final e nunca aparece como parte no contrato.
- Não incluir nenhuma oferta de assessoria jurídica no app.

Comece propondo a estrutura de pastas e o plano da Fase 1 antes de codar.
```
