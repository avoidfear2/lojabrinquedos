# Testes do esquema num Postgres local que simula o Supabase.
# Uso (Linux, com Postgres instalado): sudo bash supabase/testes/testes_banco.sh
# Aplica, em ordem, todas as migrações de supabase/migrations.
set -u
DIR=$(cd "$(dirname "$0")" && pwd); MIG=$(cd "$DIR/../migrations" && pwd)
chmod o+rx "$DIR" "$MIG" 2>/dev/null
su postgres -c "dropdb --if-exists t; createdb t" 2>/dev/null
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d t -f $DIR/simulacao_supabase.sql" >/dev/null
for f in "$MIG"/*.sql; do
  su postgres -c "psql -q -v ON_ERROR_STOP=1 -d t -f $f" || { echo "SCHEMA_FAIL $f"; exit 1; }
done
su postgres -c "psql -q -d t -c \"grant usage on schema public to anon, authenticated; grant select,insert,update,delete on all tables in schema public to anon, authenticated;\""
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222; E=33333333-3333-3333-3333-333333333333
q(){ su postgres -c "psql -X -q -t -A -d t" 2>&1 <<EOF
$1
EOF
}
as(){ echo "begin; set local role $1; select set_config('request.jwt.claim.sub','$2',true) \\gset
$3; commit;"; }
ok(){ if echo "$2" | grep -q -- "$3"; then echo "PASSOU  $1"; else echo "FALHOU  $1 -> $2"; fi; }
q "insert into auth.users values ('$A'),('$B'),('$E');" >/dev/null
q "$(as authenticated $A "select criar_locadora('Pula Alegria','12345678000190','Ana','1.0')")" >/dev/null
q "$(as authenticated $B "select criar_locadora('Festa Kids','98765432000110','Bruno','1.0')")" >/dev/null
LA=$(q "select id from locadoras where nome='Pula Alegria'")
q "update locadoras set slug='pula-alegria' where id='$LA'; update assinaturas_plano set plano='profissional' where locadora_id='$LA'; insert into usuarios(id,locadora_id,nome,papel) values ('$E','$LA','Edu','entregador');" >/dev/null
q "$(as authenticated $A "insert into brinquedos(nome,quantidade,valor_diaria) values ('Pula-pula 3x3',1,250); insert into clientes(nome,cpf) values ('Maria','52998224725')")" >/dev/null
BR=$(q "select id from brinquedos limit 1"); CL=$(q "select id from clientes limit 1")

ok "B não vê brinquedos nem clientes de A" "$(q "$(as authenticated $B "select (select count(*) from brinquedos)||'/'||(select count(*) from clientes)")")" "^0/0$"
ok "B não insere na locadora de A" "$(q "$(as authenticated $B "insert into brinquedos(locadora_id,nome,valor_diaria) values ('$LA','x',1)")")" "row-level security"
ok "B não altera cliente de A" "$(q "$(as authenticated $B "with u as (update clientes set nome='hack' returning 1) select count(*) from u")")" "^0$"
ok "anon não lê tabelas" "$(q "$(as anon '' "select count(*) from clientes")")" "^0$"

L1=aaaaaaaa-0000-0000-0000-000000000001; L2=aaaaaaaa-0000-0000-0000-000000000002; L3=aaaaaaaa-0000-0000-0000-000000000003
nova(){ echo "insert into locacoes(id,cliente_id,data_inicio,data_fim,endereco_evento,status) values ('$1','$CL','$2','$3','Rua','$4'); insert into locacao_itens(locacao_id,brinquedo_id,nome,quantidade,valor) values ('$1','$BR','Pula',1,250)"; }
ok "A confirma locação em 10/10" "$(q "$(as authenticated $A "$(nova $L1 2026-10-10 2026-10-10 confirmada); select 'ok'")")" "ok"
ok "reserva dupla bloqueada (09 a 11/10)" "$(q "$(as authenticated $A "$(nova $L2 2026-10-09 2026-10-11 confirmada)")")" "Sem disponibilidade: Pula-pula 3x3 em 10/10/2026"
ok "orçamento na mesma data é aceito" "$(q "$(as authenticated $A "$(nova $L3 2026-10-10 2026-10-10 orcamento); select 'ok'")")" "ok"
ok "confirmar o orçamento em conflito é bloqueado" "$(q "$(as authenticated $A "update locacoes set status='confirmada' where id='$L3'")")" "Sem disponibilidade"
ok "outra data (11/10) é aceita" "$(q "$(as authenticated $A "update locacoes set data_inicio='2026-10-11', data_fim='2026-10-11', status='confirmada' where id='$L3'; select 'ok'")")" "ok"
ok "números sequenciais por locadora" "$(q "select string_agg(numero::text,',' order by numero) from locacoes where locadora_id='$LA'")" "^1,2$"

ok "entregador não vê clientes" "$(q "$(as authenticated $E "select count(*) from clientes")")" "^0$"
ok "entregador não vê caixa" "$(q "$(as authenticated $E "select count(*) from caixa")")" "^0$"
ok "entregador vê locações" "$(q "$(as authenticated $E "select count(*) from locacoes")")" "^2$"
ok "entregador não edita locação direto" "$(q "$(as authenticated $E "with u as (update locacoes set frete=1 returning 1) select count(*) from u")")" "^0$"
ok "entregador registra entrega" "$(q "$(as authenticated $E "select registrar_vistoria('$L1','entrega',array['Montado'],null); select status from locacoes where id='$L1'")")" "entregue"

D=$(q "$(as authenticated $A "insert into documentos(locacao_id,versao_modelo,conteudo_html) values ('$L1','1.0','<p>Contrato</p>') returning id")" | grep -E '^[0-9a-f-]{36}$')
q "$(as authenticated $A "insert into assinaturas_doc(documento_id,papel,imagem_png,nome,hash_documento) values ('$D','locatario','data:x','Maria','x')")" >/dev/null
ok "hash gravado na assinatura" "$(q "select hash_documento = (select hash_sha256 from documentos where id='$D') from assinaturas_doc")" "^t$"
ok "app não altera documento (0 linhas)" "$(q "$(as authenticated $A "with u as (update documentos set conteudo_html='x' where id='$D' returning 1) select count(*) from u")")" "^0$"
ok "nem o administrador altera documento assinado" "$(q "update documentos set conteudo_html='x' where id='$D'")" "já assinado"
ok "assinatura não pode ser apagada" "$(q "$(as authenticated $A "with d as (delete from assinaturas_doc returning 1) select count(*) from d")")" "^0$"

D1=$(date -d "+20 days" +%F); D2=$(date -d "+21 days" +%F)  # pedidos pelo link exigem data futura (004)
ok "link: catálogo mostra o locador e o aviso" "$(q "$(as anon '' "select reserva_catalogo('pula-alegria')->>'aviso'")")" "Reserva feita diretamente com Pula Alegria"
ok "link: disponibilidade em 10/10 = 0" "$(q "$(as anon '' "select reserva_disponibilidade('pula-alegria','2026-10-10','2026-10-10')->0->>'livres'")")" "^0$"
COD=$(q "$(as anon '' "select reserva_criar('pula-alegria', jsonb_build_object('nome','João','cpf','111.444.777-35','data_inicio','$D1','endereco_evento','Rua X','itens',jsonb_build_array(jsonb_build_object('id','$BR'))))")" | grep -E '^[0-9a-f]{24}$')
ok "link: pedido entra como orçamento" "$(q "$(as anon '' "select reserva_consultar('$COD')->>'status'")")" "orcamento"
ok "link: CPF existente não é alterado" "$(q "$(as anon '' "select reserva_criar('pula-alegria', jsonb_build_object('nome','Outro Nome','cpf','52998224725','data_inicio','$D2','endereco_evento','Rua Y','itens',jsonb_build_array(jsonb_build_object('id','$BR'))))") ; select nome from clientes where cpf='52998224725'")" "Maria"
ok "link: plano Essencial não tem link" "$(q "$(as anon '' "select coalesce(reserva_catalogo('x')::text,'nulo')")")" "nulo"

q "update assinaturas_plano set status='atrasada', vencimento=current_date-8 where locadora_id='$LA'" >/dev/null
ok "inadimplente há 8 dias: leitura ok" "$(q "$(as authenticated $A "select count(*) from brinquedos")")" "^1$"
ok "inadimplente há 8 dias: gravação bloqueada" "$(q "$(as authenticated $A "insert into brinquedos(nome,valor_diaria) values ('y',1)")")" "row-level security"
q "update assinaturas_plano set status='ativa', vencimento=current_date+30 where locadora_id='$LA'" >/dev/null

# concorrência: duas sessões confirmando o mesmo brinquedo na mesma data ao mesmo tempo
q "$(as authenticated $A "insert into brinquedos(id,nome,quantidade,valor_diaria) values ('bbbbbbbb-0000-0000-0000-000000000009','Cama elástica',1,200)")" >/dev/null
BR=bbbbbbbb-0000-0000-0000-000000000009
X1=cccccccc-0000-0000-0000-000000000001; X2=cccccccc-0000-0000-0000-000000000002
cmd(){ echo "begin; set local role authenticated; select set_config('request.jwt.claim.sub','$A',true); $(nova $1 2026-11-05 2026-11-05 confirmada); select pg_sleep(1); commit;"; }
(q "$(cmd $X1)" > /tmp/c1.txt) & (q "$(cmd $X2)" > /tmp/c2.txt) & wait
ok "concorrência: só uma das duas gravou" "$(q "select count(*) from locacao_itens where brinquedo_id='$BR'")" "^1$"
ok "concorrência: a outra recebeu erro" "$(cat /tmp/c1.txt /tmp/c2.txt)" "Sem disponibilidade"

# ---- 002: salvar_locacao grava locação e itens na mesma transação ----
PULA=$(q "select id from brinquedos where nome='Pula-pula 3x3'")
sl(){ echo "select salvar_locacao('$1'::jsonb)"; }
J4="{\"cliente_id\":\"$CL\",\"data_inicio\":\"2026-10-12\",\"endereco_evento\":\"Rua\",\"status\":\"confirmada\",\"itens\":[{\"brinquedo_id\":\"$PULA\",\"quantidade\":1,\"valor\":250}]}"
L4=$(q "$(as authenticated $A "$(sl "$J4")")" | grep -E '^[0-9a-f-]{36}$')
ok "salvar_locacao cria locação com itens" "$(q "select count(*) from locacao_itens where locacao_id='$L4'")" "^1$"
J4E="{\"id\":\"$L4\",\"cliente_id\":\"$CL\",\"data_inicio\":\"2026-10-10\",\"endereco_evento\":\"Rua\",\"status\":\"confirmada\",\"itens\":[{\"brinquedo_id\":\"$PULA\",\"quantidade\":1,\"valor\":300}]}"
ok "salvar_locacao: edição em data ocupada é bloqueada" "$(q "$(as authenticated $A "$(sl "$J4E")")")" "Sem disponibilidade"
ok "salvar_locacao: edição barrada não perde itens nem data" "$(q "select l.data_inicio||'/'||count(i.*)||'/'||max(i.valor) from locacoes l join locacao_itens i on i.locacao_id=l.id where l.id='$L4' group by l.id")" "^2026-10-12/1/250.00$"
J4V="{\"id\":\"$L4\",\"cliente_id\":\"$CL\",\"data_inicio\":\"2026-10-13\",\"endereco_evento\":\"Rua\",\"status\":\"confirmada\",\"itens\":[{\"brinquedo_id\":\"$PULA\",\"quantidade\":1,\"valor\":300}]}"
q "update brinquedos set nome='Pula-pula renomeado' where id='$PULA'" >/dev/null
ok "salvar_locacao: edição válida troca itens e mantém o nome do contrato" "$(q "$(as authenticated $A "$(sl "$J4V")"); select data_inicio||'/'||(select string_agg(nome||':'||valor,',') from locacao_itens where locacao_id='$L4') from locacoes where id='$L4'")" "2026-10-13/Pula-pula 3x3:300.00"
q "update brinquedos set nome='Pula-pula 3x3' where id='$PULA'" >/dev/null
ok "salvar_locacao: entregador não grava" "$(q "$(as authenticated $E "$(sl "$J4V")")")" "sem permissão\\|row-level security"
ok "salvar_locacao: outra locadora não edita" "$(q "$(as authenticated $B "$(sl "$J4V")")")" "sem permissão\\|row-level security\\|não pertence"
JB="{\"cliente_id\":null,\"data_inicio\":\"2026-12-01\",\"endereco_evento\":\"Rua\",\"status\":\"orcamento\",\"itens\":[{\"brinquedo_id\":\"$PULA\",\"quantidade\":1,\"valor\":1}]}"
ok "salvar_locacao: outra locadora não usa brinquedo de A" "$(q "$(as authenticated $B "$(sl "$JB")")")" "Brinquedo não encontrado"
ok "salvar_locacao: anon não executa" "$(q "$(as anon '' "$(sl "$J4V")")")" "permission denied"

# ---- 003: fotos das vistorias (Storage) ----
F="$LA/$L1/entrega/f1.jpg"
fo(){ echo "insert into storage.objects(bucket_id,name) values ('vistorias','$1')"; }
ok "foto: dono envia para a própria locação" "$(q "$(as authenticated $A "$(fo "$F"); select 'ok'")")" "ok"
ok "foto: entregador envia e vê fotos da locadora" "$(q "$(as authenticated $E "$(fo "$LA/$L1/retirada/f2.jpg"); select count(*) from storage.objects")")" "^2$"
ok "foto: outra locadora não vê" "$(q "$(as authenticated $B "select count(*) from storage.objects")")" "^0$"
ok "foto: outra locadora não envia para A" "$(q "$(as authenticated $B "$(fo "$LA/$L1/entrega/x.jpg")")")" "row-level security"
LB=$(q "select id from locadoras where nome='Festa Kids'")
ok "foto: A não envia usando a pasta de B" "$(q "$(as authenticated $A "$(fo "$LB/$L1/entrega/x.jpg")")")" "row-level security"
ok "foto: caminho fora do padrão é recusado" "$(q "$(as authenticated $A "$(fo "$LA/$L1/outra/x.jpg")")")" "row-level security"
ok "foto: anon não vê nem envia" "$(q "$(as anon '' "select count(*) from storage.objects")") $(q "$(as anon '' "$(fo "$LA/$L1/entrega/y.jpg")")")" "^0 .*row-level security"
ok "foto: não pode ser apagada" "$(q "$(as authenticated $A "with d as (delete from storage.objects returning 1) select count(*) from d")")" "^0$"
ok "foto: não pode ser alterada" "$(q "$(as authenticated $A "with u as (update storage.objects set name='$LA/$L1/entrega/z.jpg' returning 1) select count(*) from u")")" "^0$"
ok "vistoria aceita foto da própria locação e fase" "$(q "$(as authenticated $A "update vistorias set fotos=array['$F'] where locacao_id='$L1' and fase='entrega'; select array_length(fotos,1) from vistorias where locacao_id='$L1' and fase='entrega'")")" "^1$"
ok "vistoria recusa foto de outra locação" "$(q "$(as authenticated $A "update vistorias set fotos=array['$LA/$L3/entrega/f.jpg'] where locacao_id='$L1' and fase='entrega'")")" "Foto inválida"
q "update assinaturas_plano set status='atrasada', vencimento=current_date-8 where locadora_id='$LA'" >/dev/null
ok "foto: conta inadimplente não envia" "$(q "$(as authenticated $A "$(fo "$LA/$L1/entrega/f9.jpg")")")" "row-level security"
q "update assinaturas_plano set status='ativa', vencimento=current_date+30 where locadora_id='$LA'" >/dev/null

# ---- 004: link de reserva ----
rc(){ echo "select reserva_criar('pula-alegria', jsonb_build_object('nome','$1','cpf','$2','data_inicio','$3','endereco_evento','Rua do Evento, 10','itens',jsonb_build_array(jsonb_build_object('id','$PULA','quantidade',$4))))"; }
ok "link 004: CPF com dígito errado é recusado" "$(q "$(as anon '' "$(rc 'Ana Paula' '11144477736' "$D1" 1)")")" "CPF inválido"
ok "link 004: data no passado é recusada" "$(q "$(as anon '' "$(rc 'Ana Paula' '11144477735' "$(date -d '-1 day' +%F)" 1)")")" "a partir de hoje"
ok "link 004: quantidade acima do estoque é recusada" "$(q "$(as anon '' "$(rc 'Ana Paula' '11144477735' "$D1" 5)")")" "Quantidade maior"
ok "link 004: nome curto é recusado" "$(q "$(as anon '' "$(rc 'A' '11144477735' "$D1" 1)")")" "nome completo"
for i in 1 2 3 4 5; do q "$(as anon '' "$(rc 'Ana Paula' '39053344705' "$D1" 1)")" >/dev/null; done
ok "link 004: sexto pedido do mesmo CPF no dia é barrado" "$(q "$(as anon '' "$(rc 'Ana Paula' '39053344705' "$D1" 1)")")" "vários pedidos hoje"
ok "link 004: pedidos do link entram como orçamento com origem link" "$(q "select count(*) from locacoes where origem='link' and status='orcamento' and locadora_id='$LA'")" "^[6-9]$"
q "update assinaturas_plano set plano='essencial' where locadora_id='$LA'" >/dev/null
ok "link 004: plano Essencial não recebe pedido" "$(q "$(as anon '' "$(rc 'Ana Paula' '52998224725' "$D1" 1)")")" "Link de reserva indisponível"
ok "link 004: plano Essencial não mostra catálogo nem disponibilidade" "$(q "$(as anon '' "select coalesce(reserva_catalogo('pula-alegria')::text,'nulo') || ' ' || reserva_disponibilidade('pula-alegria', current_date, current_date)::text")")" "^nulo \\[\\]$"
q "update assinaturas_plano set plano='profissional' where locadora_id='$LA'" >/dev/null
ok "link 004: anon continua sem ler tabelas" "$(q "$(as anon '' "select (select count(*) from locacoes) + (select count(*) from clientes)")")" "^0$"
ok "link 004: anon não chama a função interna do link" "$(q "$(as anon '' "select locadora_link_ativo('$LA')")")" "permission denied"
