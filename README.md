# Gestão de Locação de Brinquedos

SaaS de gestão para locadoras de brinquedos (infláveis, camas elásticas, piscinas de bolinhas…).
Next.js (App Router) + Supabase, instalável como app (PWA), pensado primeiro para o celular.

**Regras do produto**

- A plataforma é só uma ferramenta de gestão. Ela nunca recebe dinheiro do cliente final e nunca aparece como parte no contrato: o caixa só registra o que a locadora recebeu diretamente, e o Pix exibido é o da própria locadora.
- O app não traz nenhuma oferta de assessoria jurídica.

## Fase 1 (este código)

| Área | O que faz |
| --- | --- |
| Login e cadastro | Conta por e-mail e senha. Na primeira entrada, cadastra a locadora com `criar_locadora` (locadora + usuário dono + plano de teste + aceite dos Termos com versão e IP). |
| Termos | `/termos` lê `conteudo/termos-v<versão>.md`. Quem ainda não aceitou a versão atual (`TERMOS_VERSAO`) passa por `/aceite`, inclusive membros convidados. |
| Papéis | **Dono**: tudo, mais dados da locadora e equipe. **Operador**: locações, agenda, clientes, brinquedos e caixa. **Entregador**: agenda e locações sem valores; registra entrega e retirada; não vê clientes nem caixa. |
| Brinquedos | Cadastro com quantidade, diária, dimensões, faixa etária, energia e regras. Brinquedo com histórico é desativado em vez de apagado. Respeita o limite do plano Essencial (15). |
| Clientes | CPF validado (único por locadora), máscaras, endereço e contagem de locações. |
| Locações | Formulário do protótipo, com unidades livres no período calculadas ao vivo. A gravação é atômica (`salvar_locacao`) e o banco barra reserva dupla, inclusive com dois aparelhos ao mesmo tempo. Fluxo orçamento → confirmada → montada no local → concluída; resumo por WhatsApp. |
| Agenda | Calendário do mês, locações do dia e disponibilidade de cada brinquedo. |
| Caixa | Entradas e saídas por mês, "Para onde foi o dinheiro", pagamentos ligados à locação (saldo a receber) e exportação CSV. |
| Ajustes | Dados da locadora e condições padrão (já no banco, para o contrato da Fase 2), plano atual e equipe (convites por e-mail). |
| Somente leitura | Com a assinatura atrasada há mais de 7 dias, o banco bloqueia gravações e o app mostra um aviso. |

A Fase 2 fica para depois: contrato e termo com assinatura na tela, vistorias com fotos, link público de reserva e cobrança do plano. O banco já tem as tabelas e funções.

## Estrutura

```
supabase/
  migrations/001_esquema_inicial.sql   esquema com RLS (não alterar regras sem rodar os testes)
  migrations/002_salvar_locacao.sql    grava locação + itens numa transação (security invoker)
  testes/testes_banco.sh               36 testes do banco (28 originais + 8 da 002)
prototipo/                             protótipo HTML de referência
conteudo/termos-v1.0.md                texto dos Termos de Uso (PENDENTE: substituir)
src/
  proxy.ts                             renova a sessão e manda para /entrar quem não logou
  app/(publico)/                       entrar, cadastro, aceite, termos, definir-senha
  app/(app)/                           inicio, agenda, locacoes, cadastros, caixa, ajustes
  app/auth/                            confirmar (links de e-mail), concluir, sair
  components/                          UI (folha, campos com máscara, toast), cartões, formulários
  lib/acoes/                           Server Actions (toda gravação passa por aqui)
  lib/dados.ts                         consultas (sempre com a sessão do usuário → RLS)
  lib/dominio/                         formatação, validações, regras de locação e disponibilidade
  lib/permissoes.ts                    o que cada papel vê (a regra real está na RLS)
  lib/supabase/                        clientes do navegador, do servidor e admin (só convites)
tests/dominio.test.ts                  testes unitários (Vitest)
tests/e2e/                             Supabase local mínimo + roteiro Playwright (34 checagens)
```

## Como rodar

### 1. Supabase

1. Crie o projeto e rode, em ordem, `supabase/migrations/001_esquema_inicial.sql` e `002_salvar_locacao.sql` (SQL Editor ou `supabase db push`).
2. Em **Authentication → URL Configuration**, defina a Site URL (ex.: `https://app.seudominio.com.br`) e adicione `https://app.seudominio.com.br/auth/**` às Redirect URLs.
3. (Recomendado) Em **Authentication → Email Templates**, use links com `token_hash`, que funcionam mesmo se o e-mail for aberto em outro aparelho:
   - Confirm signup: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email&next=/cadastro`
   - Invite user: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite`
   - Reset password: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery`

   Os modelos padrão também funcionam: `/auth/confirmar` aceita `?code=` e repassa a `/auth/concluir` a sessão que vier no `#fragmento`.

### 2. App

```bash
cp .env.example .env.local   # preencha URL, anon key, service role key e SITE_URL
npm install
npm run dev
```

`SUPABASE_SERVICE_ROLE_KEY` fica só no servidor e é usada só para enviar convites de equipe. O vínculo do convidado com a locadora é gravado com a sessão do dono, sob a RLS.

### 3. Testes

```bash
npm run typecheck && npm test          # tipos + unitários
sudo bash supabase/testes/testes_banco.sh   # banco (Postgres local): 36 testes
sudo bash tests/e2e/subir.sh           # Postgres + GoTrue (Docker) + PostgREST + app em :3000
npm run test:e2e                       # roteiro no navegador (defina CHROMIUM=/caminho/do/chrome se preciso)
```

## Decisões da Fase 1

- **Migração 002 (`salvar_locacao`)**: o supabase-js faz uma transação por requisição. Sem a 002, editar os itens de uma locação confirmada podia deixá-la sem itens se a checagem de disponibilidade barrasse a inserção. A função não muda nenhuma regra de acesso; os testes do banco cobrem o caso.
- **Entregador e contato no local**: pela RLS, o entregador não lê `clientes`. Quando o próprio cliente é o responsável, a locação guarda nome e telefone dele em `resp_nome`/`resp_telefone`, e é isso que o entregador vê.
- **Vistoria mínima**: checklist de entrega e retirada via `registrar_vistoria`, sem fotos nem assinatura (Fase 2).
- **Offline**: o service worker guarda só a casca do app e uma página de aviso. Dados de clientes não ficam em cache no aparelho.

## Pendências antes de publicar

- Substituir `conteudo/termos-v1.0.md` pelo texto definitivo dos Termos de Uso.
- Configurar o SMTP do Supabase (confirmação de cadastro, convites e troca de senha).
