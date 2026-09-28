-- =====================================================================
-- Migração 003: fotos das vistorias (Supabase Storage)
--
-- Bucket privado "vistorias". Caminho de cada foto:
--   <locadora_id>/<locacao_id>/<entrega|retirada>/<nome>.jpg
--
-- Regras (mesma lógica das vistorias na 001):
--   1. Só quem é da locadora vê as fotos dela (inclusive o entregador).
--   2. Só envia foto para locação da própria locadora, e só com a conta
--      em dia (pode_gravar), como as demais gravações.
--   3. Fotos não podem ser alteradas nem apagadas pelo app: são registro
--      do estado dos brinquedos na entrega e na retirada.
--   4. O papel anon não acessa nada.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vistorias', 'vistorias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- O caminho aponta para uma locação da locadora de quem está logado?
create or replace function public.foto_da_minha_locadora(p_nome text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  partes text[] := string_to_array(p_nome, '/');
  v_locacao uuid;
begin
  if coalesce(array_length(partes, 1), 0) <> 4 or partes[3] not in ('entrega', 'retirada') or partes[4] = '' then
    return false;
  end if;
  if minha_locadora() is null or partes[1] is distinct from minha_locadora()::text then
    return false;
  end if;
  begin
    v_locacao := partes[2]::uuid;
  exception when others then
    return false;
  end;
  return locacao_da_minha_locadora(v_locacao);
end $$;

revoke all on function public.foto_da_minha_locadora(text) from public, anon;
grant execute on function public.foto_da_minha_locadora(text) to authenticated;

create policy vistorias_fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'vistorias' and public.foto_da_minha_locadora(name));

create policy vistorias_fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'vistorias' and public.foto_da_minha_locadora(name) and public.pode_gravar());

-- sem policy de update/delete: fotos de vistoria não mudam

-- A lista de fotos da vistoria só aceita caminhos da própria locação e fase
create or replace function tg_fotos_vistoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefixo text; f text;
begin
  select l.locadora_id::text || '/' || l.id::text || '/' || new.fase::text || '/'
    into v_prefixo from locacoes l where l.id = new.locacao_id;
  foreach f in array coalesce(new.fotos, '{}') loop
    if v_prefixo is null or left(f, length(v_prefixo)) <> v_prefixo or position('/' in substr(f, length(v_prefixo) + 1)) > 0 then
      raise exception 'Foto inválida para esta vistoria.';
    end if;
  end loop;
  if coalesce(array_length(new.fotos, 1), 0) > 20 then
    raise exception 'No máximo 20 fotos por vistoria.';
  end if;
  return new;
end $$;
create trigger fotos_vistoria before insert or update on vistorias
  for each row execute function tg_fotos_vistoria();
