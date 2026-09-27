-- =====================================================================
-- Migração 002: gravar locação e itens na mesma transação
--
-- O supabase-js faz uma requisição (e uma transação) por comando. Sem esta
-- função, editar uma locação confirmada exigiria apagar e reinserir os itens
-- em requisições separadas: se a checagem de disponibilidade barrasse a
-- inserção, a locação ficaria sem itens.
--
-- security invoker: roda com as permissões de quem chama. Todas as políticas
-- de RLS da 001 continuam valendo; esta função não muda nenhuma regra de
-- acesso. A checagem de disponibilidade (trigger deferred) roda no fim da
-- transação da chamada e desfaz tudo se faltar brinquedo.
-- =====================================================================

create or replace function salvar_locacao(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id    uuid := nullif(p->>'id', '')::uuid;
  v_nomes jsonb := '{}'::jsonb;   -- nomes já gravados nos itens (preserva o texto do contrato)
  it      jsonb;
  v_bid   uuid;
  v_nome  text;
  v_qtd   int;
begin
  if jsonb_typeof(coalesce(p->'itens', '[]'::jsonb)) <> 'array' then
    raise exception 'Itens inválidos.';
  end if;

  if v_id is null then
    insert into locacoes (cliente_id, data_inicio, data_fim, hora_entrega, hora_retirada, endereco_evento,
                          resp_nome, resp_cpf, resp_telefone, frete, desconto, caucao,
                          forma_pagamento, condicoes, status, observacoes)
    values ((p->>'cliente_id')::uuid, (p->>'data_inicio')::date,
            coalesce(nullif(p->>'data_fim', '')::date, (p->>'data_inicio')::date),
            nullif(p->>'hora_entrega', '')::time, nullif(p->>'hora_retirada', '')::time,
            p->>'endereco_evento', p->>'resp_nome', p->>'resp_cpf', p->>'resp_telefone',
            coalesce((p->>'frete')::numeric, 0), coalesce((p->>'desconto')::numeric, 0),
            coalesce((p->>'caucao')::numeric, 0), p->>'forma_pagamento', p->>'condicoes',
            coalesce(nullif(p->>'status', ''), 'orcamento')::locacao_status, p->>'observacoes')
    returning id into v_id;
  else
    update locacoes set
      cliente_id      = (p->>'cliente_id')::uuid,
      data_inicio     = (p->>'data_inicio')::date,
      data_fim        = coalesce(nullif(p->>'data_fim', '')::date, (p->>'data_inicio')::date),
      hora_entrega    = nullif(p->>'hora_entrega', '')::time,
      hora_retirada   = nullif(p->>'hora_retirada', '')::time,
      endereco_evento = p->>'endereco_evento',
      resp_nome       = p->>'resp_nome',
      resp_cpf        = p->>'resp_cpf',
      resp_telefone   = p->>'resp_telefone',
      frete           = coalesce((p->>'frete')::numeric, 0),
      desconto        = coalesce((p->>'desconto')::numeric, 0),
      caucao          = coalesce((p->>'caucao')::numeric, 0),
      forma_pagamento = p->>'forma_pagamento',
      condicoes       = p->>'condicoes',
      status          = coalesce(nullif(p->>'status', ''), status::text)::locacao_status,
      observacoes     = p->>'observacoes'
    where id = v_id;
    if not found then
      raise exception 'Locação não encontrada ou sem permissão para alterar.';
    end if;

    select coalesce(jsonb_object_agg(brinquedo_id::text, nome), '{}'::jsonb) into v_nomes
      from locacao_itens where locacao_id = v_id and brinquedo_id is not null;
    delete from locacao_itens where locacao_id = v_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) loop
    v_qtd := coalesce((it->>'quantidade')::int, 0);
    continue when v_qtd < 1;
    v_bid := nullif(it->>'brinquedo_id', '')::uuid;
    if v_bid is null then
      v_nome := nullif(trim(it->>'nome'), '');       -- item de brinquedo já excluído
      if v_nome is null then raise exception 'Item sem brinquedo.'; end if;
    else
      v_nome := coalesce(v_nomes->>v_bid::text, (select nome from brinquedos where id = v_bid));
      if v_nome is null then raise exception 'Brinquedo não encontrado.'; end if;
    end if;
    insert into locacao_itens (locacao_id, brinquedo_id, nome, quantidade, valor)
    values (v_id, v_bid, v_nome, v_qtd, coalesce((it->>'valor')::numeric, 0));
  end loop;

  return v_id;
end $$;

revoke all on function salvar_locacao(jsonb) from public, anon;
grant execute on function salvar_locacao(jsonb) to authenticated;
