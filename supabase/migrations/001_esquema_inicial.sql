-- =====================================================================
-- SaaS de locação de brinquedos — migração 001: esquema inicial
-- Alvo: Supabase (Postgres 15+). Rodar no SQL Editor ou via supabase db push.
--
-- O que este arquivo garante:
--   1. Cada locadora só enxerga os próprios dados (Row Level Security).
--   2. Entregador vê só locações e vistorias; não vê clientes nem caixa.
--   3. Nenhum brinquedo é reservado além da quantidade, mesmo com dois
--      aparelhos salvando ao mesmo tempo (checagem no banco, com trava).
--   4. Conta inadimplente há mais de 7 dias fica somente leitura.
--   5. Documento assinado não pode mais ser alterado; registros de
--      assinatura e de acesso são somente inclusão.
--   6. O link de reserva público só acessa o banco por funções
--      controladas; nunca lê tabelas diretamente.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type papel_usuario   as enum ('dono', 'operador', 'entregador');
create type plano_tipo      as enum ('essencial', 'profissional', 'equipe');
create type plano_status    as enum ('teste', 'ativa', 'atrasada', 'cancelada');
create type locacao_status  as enum ('orcamento', 'confirmada', 'entregue', 'concluida', 'cancelada');
create type locacao_origem  as enum ('app', 'link');
create type caixa_tipo      as enum ('entrada', 'saida');
create type vistoria_fase   as enum ('entrega', 'retirada');
create type assinante_papel as enum ('locatario', 'responsavel', 'locador');

-- ---------------------------------------------------------------------
-- Locadoras (assinantes) e usuários
-- ---------------------------------------------------------------------
create table locadoras (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) > 0),
  cpf_cnpj         text not null,
  telefone         text,
  endereco         text,
  cidade           text,
  comarca_foro     text,
  chave_pix        text,
  canc_dias        int  not null default 7  check (canc_dias >= 0),
  canc_pct         int  not null default 30 check (canc_pct between 0 and 100),
  taxa_visita      numeric(12,2) not null default 0 check (taxa_visita >= 0),
  clausulas_extras text,
  slug             text unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  proximo_numero   int  not null default 1,
  criado_em        timestamptz not null default now()
);

create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  locadora_id uuid not null references locadoras(id) on delete cascade,
  nome        text not null,
  papel       papel_usuario not null default 'operador',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index on usuarios (locadora_id);

create table assinaturas_plano (
  locadora_id  uuid primary key references locadoras(id) on delete cascade,
  plano        plano_tipo not null default 'essencial',
  status       plano_status not null default 'teste',
  vencimento   date not null default (current_date + 14),
  gateway_id   text,
  atualizado_em timestamptz not null default now()
);

create table aceites_termos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  versao      text not null,
  ip          inet,
  aceito_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções de contexto (quem está logado)
-- security definer: leem usuarios sem passar pela RLS, evitando recursão
-- ---------------------------------------------------------------------
create or replace function minha_locadora() returns uuid
language sql stable security definer set search_path = public as $$
  select locadora_id from usuarios where id = auth.uid() and ativo
$$;

create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from usuarios where id = auth.uid() and ativo
$$;

-- Pode gravar? Em teste/ativa sim; atrasada só até 7 dias após o vencimento.
create or replace function locadora_pode_gravar(p_locadora uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assinaturas_plano a
    where a.locadora_id = p_locadora
      and (a.status in ('teste','ativa')
           or (a.status = 'atrasada' and current_date <= a.vencimento + 7))
      and not (a.status = 'teste' and current_date > a.vencimento)
  )
$$;

create or replace function pode_gravar() returns boolean
language sql stable security definer set search_path = public as $$ select locadora_pode_gravar(minha_locadora()) $$;

-- ---------------------------------------------------------------------
-- Cadastro inicial: cria a locadora e o usuário dono em uma chamada
-- ---------------------------------------------------------------------
create or replace function criar_locadora(p_nome text, p_cpf_cnpj text, p_nome_usuario text,
                                          p_versao_termos text, p_ip inet default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login antes de criar a locadora.'; end if;
  if exists (select 1 from usuarios where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma locadora.';
  end if;
  insert into locadoras (nome, cpf_cnpj) values (p_nome, p_cpf_cnpj) returning id into v_id;
  insert into usuarios (id, locadora_id, nome, papel) values (auth.uid(), v_id, p_nome_usuario, 'dono');
  insert into assinaturas_plano (locadora_id) values (v_id);
  insert into aceites_termos (usuario_id, versao, ip) values (auth.uid(), p_versao_termos, p_ip);
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Negócio
-- ---------------------------------------------------------------------
create table brinquedos (
  id           uuid primary key default gen_random_uuid(),
  locadora_id  uuid not null default minha_locadora() references locadoras(id) on delete cascade,
  nome         text not null,
  categoria    text,
  quantidade   int  not null default 1 check (quantidade >= 1),
  valor_diaria numeric(12,2) not null check (valor_diaria >= 0),
  dimensoes    text,
  faixa_etaria text,
  capacidade   int check (capacidade >= 0),
  energia      text,
  regras       text,
  fotos        text[] not null default '{}',
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);
create index on brinquedos (locadora_id);

create table clientes (
  id          uuid primary key default gen_random_uuid(),
  locadora_id uuid not null default minha_locadora() references locadoras(id) on delete cascade,
  nome        text not null,
  cpf         text not null check (cpf ~ '^\d{11}$'),     -- só dígitos
  rg          text,
  telefone    text,
  email       text,
  cep         text, rua text, numero text, complemento text, bairro text, cidade text, uf char(2),
  observacoes text,
  criado_em   timestamptz not null default now(),
  unique (locadora_id, cpf)
);
create index on clientes (locadora_id);

create table locacoes (
  id              uuid primary key default gen_random_uuid(),
  locadora_id     uuid not null default minha_locadora() references locadoras(id) on delete cascade,
  numero          int  not null default 0,
  cliente_id      uuid references clientes(id) on delete restrict,
  data_inicio     date not null,
  data_fim        date not null,
  hora_entrega    time,
  hora_retirada   time,
  endereco_evento text not null,
  resp_nome       text, resp_cpf text, resp_telefone text,
  frete           numeric(12,2) not null default 0 check (frete >= 0),
  desconto        numeric(12,2) not null default 0 check (desconto >= 0),
  caucao          numeric(12,2) not null default 0 check (caucao >= 0),
  forma_pagamento text,
  condicoes       text,
  status          locacao_status not null default 'orcamento',
  origem          locacao_origem not null default 'app',
  codigo_publico  text unique default encode(gen_random_bytes(12), 'hex'),
  observacoes     text,
  criado_em       timestamptz not null default now(),
  check (data_fim >= data_inicio),
  check (data_fim - data_inicio <= 60),
  unique (locadora_id, numero)
);
create index on locacoes (locadora_id, data_inicio);

create table locacao_itens (
  id           uuid primary key default gen_random_uuid(),
  locacao_id   uuid not null references locacoes(id) on delete cascade,
  brinquedo_id uuid references brinquedos(id) on delete set null,
  nome         text not null,          -- copiado: o contrato não muda se o brinquedo mudar
  quantidade   int  not null check (quantidade >= 1),
  valor        numeric(12,2) not null check (valor >= 0)
);
create index on locacao_itens (locacao_id);
create index on locacao_itens (brinquedo_id);

create table vistorias (
  id          uuid primary key default gen_random_uuid(),
  locacao_id  uuid not null references locacoes(id) on delete cascade,
  fase        vistoria_fase not null,
  itens       text[] not null default '{}',
  observacoes text,
  fotos       text[] not null default '{}',
  usuario_id  uuid default auth.uid() references usuarios(id) on delete set null,
  feita_em    timestamptz not null default now(),
  unique (locacao_id, fase)
);

create table documentos (
  id             uuid primary key default gen_random_uuid(),
  locacao_id     uuid not null references locacoes(id) on delete cascade,
  versao_modelo  text not null,
  conteudo_html  text not null,
  hash_sha256    text generated always as (encode(digest(conteudo_html, 'sha256'), 'hex')) stored,
  criado_em      timestamptz not null default now()
);
create index on documentos (locacao_id);

create table assinaturas_doc (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id) on delete cascade,
  papel        assinante_papel not null,
  imagem_png   text not null,          -- data URL da assinatura
  nome         text not null,
  cpf          text,
  hash_documento text not null,        -- hash do documento no momento da assinatura
  ip           inet,
  aparelho     text,
  geolocalizacao text,
  assinado_em  timestamptz not null default now()
);

create table caixa (
  id          uuid primary key default gen_random_uuid(),
  locadora_id uuid not null default minha_locadora() references locadoras(id) on delete cascade,
  tipo        caixa_tipo not null,
  valor       numeric(12,2) not null check (valor > 0),
  data        date not null default current_date,
  categoria   text not null,
  forma       text,
  descricao   text,
  locacao_id  uuid references locacoes(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index on caixa (locadora_id, data);

create table logs_acesso (
  id          bigint generated always as identity primary key,
  locadora_id uuid,
  usuario_id  uuid,
  acao        text not null,
  tabela      text not null,
  registro_id uuid,
  feito_em    timestamptz not null default now()
);
create index on logs_acesso (locadora_id, feito_em);

-- ---------------------------------------------------------------------
-- Regras de integridade (triggers)
-- ---------------------------------------------------------------------

-- Filhos (itens, vistorias, documentos) precisam pertencer à mesma locadora da locação
create or replace function locacao_da_minha_locadora(p_locacao uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from locacoes where id = p_locacao and locadora_id = minha_locadora())
$$;

-- Número sequencial por locadora (com trava na linha da locadora)
create or replace function tg_numero_locacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update locadoras set proximo_numero = proximo_numero + 1
   where id = new.locadora_id
   returning proximo_numero - 1 into new.numero;
  return new;
end $$;
create trigger numero_locacao before insert on locacoes
  for each row execute function tg_numero_locacao();

-- Cliente, brinquedo e locação vinculados precisam ser da mesma locadora
create or replace function tg_locacao_mesma_locadora() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_id is not null
     and not exists (select 1 from clientes where id = new.cliente_id and locadora_id = new.locadora_id) then
    raise exception 'Cliente não pertence a esta locadora.';
  end if;
  return new;
end $$;
create trigger mesma_locadora before insert or update on locacoes
  for each row execute function tg_locacao_mesma_locadora();

create or replace function tg_item_mesma_locadora() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brinquedo_id is not null
     and not exists (select 1 from brinquedos b join locacoes l on l.locadora_id = b.locadora_id
                     where b.id = new.brinquedo_id and l.id = new.locacao_id) then
    raise exception 'Brinquedo não pertence a esta locadora.';
  end if;
  return new;
end $$;
create trigger mesma_locadora before insert or update on locacao_itens
  for each row execute function tg_item_mesma_locadora();

create or replace function tg_caixa_mesma_locadora() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.locacao_id is not null
     and not exists (select 1 from locacoes where id = new.locacao_id and locadora_id = new.locadora_id) then
    raise exception 'Locação não pertence a esta locadora.';
  end if;
  return new;
end $$;
create trigger mesma_locadora before insert or update on caixa
  for each row execute function tg_caixa_mesma_locadora();

-- Limite de brinquedos no plano Essencial
create or replace function tg_limite_plano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select plano from assinaturas_plano where locadora_id = new.locadora_id) = 'essencial'
     and (select count(*) from brinquedos where locadora_id = new.locadora_id) >= 15 then
    raise exception 'O plano Essencial permite até 15 brinquedos. Mude de plano para cadastrar mais.';
  end if;
  return new;
end $$;
create trigger limite_plano before insert on brinquedos
  for each row execute function tg_limite_plano();

-- Disponibilidade: roda no fim da transação (deferred), depois que os itens
-- foram gravados, e trava as linhas dos brinquedos envolvidos para que duas
-- gravações simultâneas não passem juntas.
create or replace function verifica_disponibilidade(p_locacao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l   locacoes%rowtype;
  r   record;
begin
  select * into l from locacoes where id = p_locacao;
  if not found or l.status not in ('confirmada','entregue') then return; end if;

  perform 1 from brinquedos
   where id in (select brinquedo_id from locacao_itens where locacao_id = p_locacao)
   order by id for update;

  for r in
    select b.nome, d::date as dia, b.quantidade,
           (select coalesce(sum(i2.quantidade),0)
              from locacao_itens i2 join locacoes l2 on l2.id = i2.locacao_id
             where i2.brinquedo_id = b.id
               and l2.status in ('confirmada','entregue')
               and d::date between l2.data_inicio and l2.data_fim) as reservado
      from (select brinquedo_id, sum(quantidade) q from locacao_itens
             where locacao_id = p_locacao and brinquedo_id is not null group by brinquedo_id) it
      join brinquedos b on b.id = it.brinquedo_id
      cross join generate_series(l.data_inicio, l.data_fim, interval '1 day') d
  loop
    if r.reservado > r.quantidade then
      raise exception 'Sem disponibilidade: % em % (% reservado(s) para % unidade(s)).',
        r.nome, to_char(r.dia, 'DD/MM/YYYY'), r.reservado, r.quantidade
        using errcode = 'P0001', hint = 'reserva_dupla';
    end if;
  end loop;
end $$;

create or replace function tg_disponibilidade_locacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform verifica_disponibilidade(new.id); return null; end $$;
create or replace function tg_disponibilidade_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform verifica_disponibilidade(new.locacao_id); return null; end $$;
create constraint trigger disponibilidade after insert or update on locacoes
  deferrable initially deferred for each row execute function tg_disponibilidade_locacao();
create constraint trigger disponibilidade after insert or update on locacao_itens
  deferrable initially deferred for each row execute function tg_disponibilidade_item();

-- Documento congelado depois da primeira assinatura
create or replace function tg_documento_congelado() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from assinaturas_doc where documento_id = old.id) then
    raise exception 'Documento já assinado não pode ser alterado. Gere uma nova versão.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger documento_congelado before update or delete on documentos
  for each row execute function tg_documento_congelado();

-- Assinatura grava o hash do documento no momento em que foi feita
create or replace function tg_hash_assinatura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select hash_sha256 into new.hash_documento from documentos where id = new.documento_id;
  new.assinado_em := now();
  return new;
end $$;
create trigger hash_assinatura before insert on assinaturas_doc
  for each row execute function tg_hash_assinatura();

-- Registro de acesso a dados pessoais (somente inclusão)
create or replace function tg_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  v := case when tg_op = 'DELETE' then old else new end;
  insert into logs_acesso (locadora_id, usuario_id, acao, tabela, registro_id)
  values (v.locadora_id, auth.uid(), lower(tg_op), tg_table_name, v.id);
  return null;
end $$;
create trigger log after insert or update or delete on clientes for each row execute function tg_log();
create trigger log after insert or update or delete on locacoes for each row execute function tg_log();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table locadoras         enable row level security;
alter table usuarios          enable row level security;
alter table assinaturas_plano enable row level security;
alter table aceites_termos    enable row level security;
alter table brinquedos        enable row level security;
alter table clientes          enable row level security;
alter table locacoes          enable row level security;
alter table locacao_itens     enable row level security;
alter table vistorias         enable row level security;
alter table documentos        enable row level security;
alter table assinaturas_doc   enable row level security;
alter table caixa             enable row level security;
alter table logs_acesso       enable row level security;

-- Locadora: todos da equipe leem; só o dono altera
create policy ler on locadoras for select using (id = minha_locadora());
create policy dono_altera on locadoras for update
  using (id = minha_locadora() and meu_papel() = 'dono' and pode_gravar())
  with check (id = minha_locadora());

-- Usuários: equipe se vê; dono gerencia
create policy ler on usuarios for select using (locadora_id = minha_locadora());
create policy dono_gerencia on usuarios for all
  using (locadora_id = minha_locadora() and meu_papel() = 'dono')
  with check (locadora_id = minha_locadora() and meu_papel() = 'dono');

-- Plano: só leitura pelo app (quem altera é a função de webhook, com service role)
create policy ler on assinaturas_plano for select using (locadora_id = minha_locadora());

-- Aceites: cada usuário vê e registra os seus
create policy proprio on aceites_termos for select using (usuario_id = auth.uid());
create policy registrar on aceites_termos for insert with check (usuario_id = auth.uid());

-- Brinquedos: equipe inteira lê; dono e operador gravam
create policy ler on brinquedos for select using (locadora_id = minha_locadora());
create policy gravar on brinquedos for all
  using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar())
  with check (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar());

-- Clientes e caixa: entregador não acessa
create policy equipe on clientes for select using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador'));
create policy gravar on clientes for all
  using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar())
  with check (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar());

create policy equipe on caixa for select using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador'));
create policy gravar on caixa for all
  using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar())
  with check (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar());

-- Locações e itens: todos leem; dono e operador gravam
create policy ler on locacoes for select using (locadora_id = minha_locadora());
create policy gravar on locacoes for all
  using (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar())
  with check (locadora_id = minha_locadora() and meu_papel() in ('dono','operador') and pode_gravar());

create policy ler on locacao_itens for select using (locacao_da_minha_locadora(locacao_id));
create policy gravar on locacao_itens for all
  using (locacao_da_minha_locadora(locacao_id) and meu_papel() in ('dono','operador') and pode_gravar())
  with check (locacao_da_minha_locadora(locacao_id) and meu_papel() in ('dono','operador') and pode_gravar());

-- Vistorias: toda a equipe, inclusive entregador
create policy ler on vistorias for select using (locacao_da_minha_locadora(locacao_id));
create policy gravar on vistorias for all
  using (locacao_da_minha_locadora(locacao_id) and pode_gravar())
  with check (locacao_da_minha_locadora(locacao_id) and pode_gravar());

-- Documentos: dono e operador; assinaturas só inclusão (entregador colhe na entrega)
create policy ler on documentos for select using (locacao_da_minha_locadora(locacao_id));
create policy gravar on documentos for insert
  with check (locacao_da_minha_locadora(locacao_id) and meu_papel() in ('dono','operador') and pode_gravar());

create policy ler on assinaturas_doc for select
  using (exists (select 1 from documentos d where d.id = documento_id and locacao_da_minha_locadora(d.locacao_id)));
create policy incluir on assinaturas_doc for insert
  with check (exists (select 1 from documentos d where d.id = documento_id and locacao_da_minha_locadora(d.locacao_id)) and pode_gravar());
-- sem policy de update/delete: assinaturas não mudam

-- Logs: só o dono lê; ninguém altera pelo app
create policy dono_le on logs_acesso for select using (locadora_id = minha_locadora() and meu_papel() = 'dono');

-- Entregador: ao mudar status (entrega/retirada) usa esta função, não update direto
create or replace function registrar_vistoria(p_locacao uuid, p_fase vistoria_fase, p_itens text[], p_obs text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not locacao_da_minha_locadora(p_locacao) or not pode_gravar() then
    raise exception 'Sem permissão para esta locação.';
  end if;
  insert into vistorias (locacao_id, fase, itens, observacoes, usuario_id)
  values (p_locacao, p_fase, coalesce(p_itens,'{}'), p_obs, auth.uid())
  on conflict (locacao_id, fase) do update set itens = excluded.itens, observacoes = excluded.observacoes, feita_em = now();
  update locacoes set status = case p_fase when 'entrega' then 'entregue'::locacao_status else 'concluida'::locacao_status end
   where id = p_locacao;
end $$;

-- ---------------------------------------------------------------------
-- Link de reserva público (cliente final, sem login)
-- Acesso só por estas funções; o papel anon não lê nenhuma tabela.
-- O locador é sempre identificado como quem aluga (Termos, cláusula 3.6).
-- ---------------------------------------------------------------------
create or replace function reserva_catalogo(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'locador', jsonb_build_object('nome', l.nome, 'cpf_cnpj', l.cpf_cnpj, 'telefone', l.telefone, 'cidade', l.cidade),
    'aviso', 'Reserva feita diretamente com ' || l.nome || '. Esta página é o sistema de gestão usado pela empresa.',
    'brinquedos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'categoria', b.categoria, 'valor', b.valor_diaria,
        'dimensoes', b.dimensoes, 'faixa_etaria', b.faixa_etaria, 'fotos', b.fotos) order by b.nome)
      from brinquedos b where b.locadora_id = l.id and b.ativo), '[]'::jsonb))
  from locadoras l
  where l.slug = p_slug and locadora_pode_gravar(l.id)
    and (select plano from assinaturas_plano where locadora_id = l.id) in ('profissional','equipe')
$$;

create or replace function reserva_disponibilidade(p_slug text, p_inicio date, p_fim date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'livres',
    greatest(0, b.quantidade - coalesce((
      select max(res) from (
        select d, sum(i.quantidade) res
          from generate_series(p_inicio, p_fim, interval '1 day') d
          join locacoes lo on d::date between lo.data_inicio and lo.data_fim
                          and lo.status in ('confirmada','entregue') and lo.locadora_id = l.id
          join locacao_itens i on i.locacao_id = lo.id and i.brinquedo_id = b.id
         group by d) x), 0)))), '[]'::jsonb)
  from locadoras l join brinquedos b on b.locadora_id = l.id and b.ativo
  where l.slug = p_slug and p_fim >= p_inicio and p_fim - p_inicio <= 60
$$;

-- Cria cliente (ou reaproveita pelo CPF) e locação como ORÇAMENTO.
-- O locador confirma no app; só então a data fica bloqueada.
create or replace function reserva_criar(p_slug text, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_loc uuid; v_cli uuid; v_locacao uuid; v_codigo text; it jsonb; v_b brinquedos%rowtype;
  v_cpf text := regexp_replace(p->>'cpf', '\D', '', 'g');
begin
  select id into v_loc from locadoras where slug = p_slug;
  if v_loc is null or not locadora_pode_gravar(v_loc) then raise exception 'Link de reserva indisponível.'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF inválido.'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]')) = 0 then raise exception 'Escolha ao menos um brinquedo.'; end if;

  insert into clientes (locadora_id, nome, cpf, telefone, email, rua, numero, bairro, cidade, uf, cep)
  values (v_loc, p->>'nome', v_cpf, p->>'telefone', p->>'email', p->>'rua', p->>'numero',
          p->>'bairro', p->>'cidade', p->>'uf', p->>'cep')
  on conflict (locadora_id, cpf) do nothing
  returning id into v_cli;
  if v_cli is null then  -- cliente já existe: reaproveita sem alterar dados pelo link público
    select id into v_cli from clientes where locadora_id = v_loc and cpf = v_cpf;
  end if;

  insert into locacoes (locadora_id, cliente_id, data_inicio, data_fim, hora_entrega, hora_retirada,
                        endereco_evento, status, origem, observacoes)
  values (v_loc, v_cli, (p->>'data_inicio')::date, coalesce((p->>'data_fim')::date, (p->>'data_inicio')::date),
          (p->>'hora_entrega')::time, (p->>'hora_retirada')::time, p->>'endereco_evento',
          'orcamento', 'link', p->>'observacoes')
  returning id, codigo_publico into v_locacao, v_codigo;

  for it in select * from jsonb_array_elements(p->'itens') loop
    select * into v_b from brinquedos where id = (it->>'id')::uuid and locadora_id = v_loc and ativo;
    if not found then raise exception 'Brinquedo indisponível.'; end if;
    insert into locacao_itens (locacao_id, brinquedo_id, nome, quantidade, valor)
    values (v_locacao, v_b.id, v_b.nome, greatest(1, coalesce((it->>'quantidade')::int, 1)), v_b.valor_diaria);
  end loop;
  return v_codigo;
end $$;

create or replace function reserva_consultar(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('numero', lo.numero, 'status', lo.status, 'data_inicio', lo.data_inicio,
         'data_fim', lo.data_fim, 'locador', l.nome, 'telefone_locador', l.telefone,
         'itens', (select jsonb_agg(jsonb_build_object('nome', nome, 'quantidade', quantidade)) from locacao_itens where locacao_id = lo.id))
  from locacoes lo join locadoras l on l.id = lo.locadora_id
  where lo.codigo_publico = p_codigo
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- ---------------------------------------------------------------------
revoke all on function reserva_catalogo(text), reserva_disponibilidade(text, date, date),
                       reserva_criar(text, jsonb), reserva_consultar(text) from public;
grant execute on function reserva_catalogo(text), reserva_disponibilidade(text, date, date),
                          reserva_criar(text, jsonb), reserva_consultar(text) to anon, authenticated;
revoke all on function criar_locadora(text, text, text, text, inet), registrar_vistoria(uuid, vistoria_fase, text[], text) from public, anon;
grant execute on function criar_locadora(text, text, text, text, inet), registrar_vistoria(uuid, vistoria_fase, text[], text) to authenticated;
revoke all on function verifica_disponibilidade(uuid), locadora_pode_gravar(uuid) from public, anon;
