-- =====================================================================
-- Migração 004: link público de reserva mais seguro
--
-- Não muda quem acessa o quê. O papel anon continua sem ler nenhuma tabela
-- e só usa as funções reserva_*. O que muda:
--   1. Pedido pelo link só é aceito quando o link está ativo (conta em dia e
--      plano Profissional ou Equipe), a mesma regra que reserva_catalogo já
--      usava. A disponibilidade segue a mesma regra.
--   2. Validações: CPF com dígito verificador, nome e endereço obrigatórios,
--      data a partir de hoje (até 1 ano), quantidade até o estoque do
--      brinquedo e tamanhos máximos de texto.
--   3. Limites contra abuso: até 5 pedidos por CPF por dia e até 30 pedidos
--      por hora em cada locadora.
-- =====================================================================

create or replace function cpf_valido(p text) returns boolean
language plpgsql immutable as $$
declare
  c text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s int; r int; i int;
begin
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(c, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(c, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(c, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(c, 11, 1)::int;
end $$;

-- Link de reserva ativo: conta pode gravar e plano com link
create or replace function locadora_link_ativo(p_locadora uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select locadora_pode_gravar(p_locadora)
     and coalesce((select plano from assinaturas_plano where locadora_id = p_locadora) in ('profissional', 'equipe'), false)
$$;
revoke all on function locadora_link_ativo(uuid) from public, anon;

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
    and locadora_link_ativo(l.id)
$$;

create or replace function reserva_criar(p_slug text, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_loc uuid; v_cli uuid; v_locacao uuid; v_codigo text; it jsonb; v_b brinquedos%rowtype;
  v_cpf text := regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g');
  v_nome text := trim(coalesce(p->>'nome', ''));
  v_end text := trim(coalesce(p->>'endereco_evento', ''));
  v_ini date; v_fim date; v_qtd int;
begin
  select id into v_loc from locadoras where slug = p_slug;
  if v_loc is null or not locadora_link_ativo(v_loc) then raise exception 'Link de reserva indisponível.'; end if;

  if length(v_nome) < 3 or length(v_nome) > 120 then raise exception 'Informe o nome completo.'; end if;
  if not cpf_valido(v_cpf) then raise exception 'CPF inválido.'; end if;
  if length(v_end) < 5 or length(v_end) > 300 then raise exception 'Informe o endereço do evento.'; end if;
  if length(coalesce(p->>'observacoes', '')) > 1000 then raise exception 'Observações muito longas.'; end if;

  begin
    v_ini := (p->>'data_inicio')::date;
    v_fim := coalesce(nullif(p->>'data_fim', '')::date, v_ini);
  exception when others then
    raise exception 'Data inválida.';
  end;
  if v_ini is null or v_ini < current_date or v_ini > current_date + 365 then
    raise exception 'Escolha uma data a partir de hoje.';
  end if;
  if v_fim < v_ini then raise exception 'A retirada não pode ser antes da entrega.'; end if;

  if jsonb_typeof(p->'itens') <> 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'Escolha ao menos um brinquedo.';
  end if;
  if jsonb_array_length(p->'itens') > 20 then raise exception 'Escolha no máximo 20 brinquedos.'; end if;

  -- limites contra abuso
  if (select count(*) from locacoes where locadora_id = v_loc and origem = 'link' and criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos pedidos agora. Tente de novo mais tarde ou fale direto com a locadora.';
  end if;
  if (select count(*) from locacoes lo join clientes c on c.id = lo.cliente_id
       where lo.locadora_id = v_loc and lo.origem = 'link' and c.cpf = v_cpf and lo.criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Você já enviou vários pedidos hoje. Aguarde o contato da locadora.';
  end if;

  insert into clientes (locadora_id, nome, cpf, telefone, email, rua, numero, bairro, cidade, uf, cep)
  values (v_loc, v_nome, v_cpf, left(p->>'telefone', 20), left(p->>'email', 120), left(p->>'rua', 120), left(p->>'numero', 20),
          left(p->>'bairro', 80), left(p->>'cidade', 80), nullif(upper(left(p->>'uf', 2)), ''), left(p->>'cep', 9))
  on conflict (locadora_id, cpf) do nothing
  returning id into v_cli;
  if v_cli is null then  -- cliente já existe: reaproveita sem alterar dados pelo link público
    select id into v_cli from clientes where locadora_id = v_loc and cpf = v_cpf;
  end if;

  insert into locacoes (locadora_id, cliente_id, data_inicio, data_fim, hora_entrega, hora_retirada,
                        endereco_evento, status, origem, observacoes)
  values (v_loc, v_cli, v_ini, v_fim,
          nullif(p->>'hora_entrega', '')::time, nullif(p->>'hora_retirada', '')::time, v_end,
          'orcamento', 'link', left(p->>'observacoes', 1000))
  returning id, codigo_publico into v_locacao, v_codigo;

  for it in select * from jsonb_array_elements(p->'itens') loop
    select * into v_b from brinquedos where id = (it->>'id')::uuid and locadora_id = v_loc and ativo;
    if not found then raise exception 'Brinquedo indisponível.'; end if;
    v_qtd := greatest(1, coalesce((it->>'quantidade')::int, 1));
    if v_qtd > v_b.quantidade then raise exception 'Quantidade maior que a disponível para %.', v_b.nome; end if;
    insert into locacao_itens (locacao_id, brinquedo_id, nome, quantidade, valor)
    values (v_locacao, v_b.id, v_b.nome, v_qtd, v_b.valor_diaria);
  end loop;
  return v_codigo;
end $$;

-- Mesmas permissões da 001 (create or replace mantém os grants; reforçado aqui)
revoke all on function reserva_disponibilidade(text, date, date), reserva_criar(text, jsonb) from public;
grant execute on function reserva_disponibilidade(text, date, date), reserva_criar(text, jsonb) to anon, authenticated;
