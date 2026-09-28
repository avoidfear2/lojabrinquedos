#!/bin/bash
# Sobe um "Supabase local" mínimo para testes de ponta a ponta:
#   Postgres (local) + GoTrue (Docker) + Storage (código-fonte) + PostgREST (binário) + gateway + SMTP de teste.
# Depois sobe o app em http://localhost:3000 apontando para esse stack.
#
# Uso (Linux, como root, com Postgres 15+ e Docker):  sudo bash tests/e2e/subir.sh
# Em seguida:                                          npm run test:e2e
set -eu
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
DIR="$RAIZ/tests/e2e"
TMP="$RAIZ/.e2e"
mkdir -p "$TMP"
# encerra o que ficou de uma execução anterior
pkill -f "tsx src/start/server.ts" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
for f in "$TMP"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
sleep 1
export JWT_SECRET=${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
SENHA=senha_local
DB=e2e

echo "» banco $DB"
su postgres -c "psql -q" <<SQL
select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid();
drop database if exists $DB;
create database $DB;
do \$\$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit password '$SENHA'; end if;
  if not exists (select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login createrole password '$SENHA'; end if;
end \$\$;
grant anon, authenticated, service_role to authenticator;
SQL
su postgres -c "psql -q -d $DB" <<SQL
create schema auth authorization supabase_auth_admin;
grant create on database $DB to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant usage on schema auth to anon, authenticated, service_role;
SQL

echo "» GoTrue (auth)"
docker rm -f e2e-gotrue >/dev/null 2>&1 || true
docker run -d --name e2e-gotrue --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e "DATABASE_URL=postgres://supabase_auth_admin:$SENHA@127.0.0.1:5432/$DB?search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e "GOTRUE_URI_ALLOW_LIST=http://localhost:3000/**" \
  -e GOTRUE_JWT_SECRET=$JWT_SECRET -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
  -e GOTRUE_SMTP_HOST=127.0.0.1 -e GOTRUE_SMTP_PORT=2525 -e GOTRUE_SMTP_USER=x -e GOTRUE_SMTP_PASS=x \
  -e GOTRUE_SMTP_ADMIN_EMAIL=admin@local.test -e GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
  supabase/gotrue:v2.170.0 >/dev/null
for i in $(seq 1 30); do curl -sf localhost:9999/health >/dev/null && break; sleep 1; done

echo "» Storage (código-fonte do supabase/storage)"
node "$DIR/jwt.mjs" > "$TMP/chaves.env"
# como no Supabase: o Storage usa um usuário próprio, com search_path = storage
su postgres -c "psql -q" <<SQL
do \$\$ begin
  if not exists (select from pg_roles where rolname='supabase_storage_admin') then
    create role supabase_storage_admin login superuser password '$SENHA';
  end if;
end \$\$;
alter role supabase_storage_admin set search_path = storage;
SQL
if [ ! -d "$TMP/storage/node_modules/fs-xattr/build" ]; then
  [ -d "$TMP/storage" ] || git clone -q --depth 1 --branch v1.19.1 https://github.com/supabase/storage.git "$TMP/storage"
  (cd "$TMP/storage" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null && npm rebuild fs-xattr >/dev/null)
fi
mkdir -p "$TMP/storage-data"
cat > "$TMP/storage/.env" <<CONF
SERVER_HOST=127.0.0.1
SERVER_PORT=5000
SERVER_ADMIN_PORT=5001
SERVER_REGION=local
AUTH_JWT_SECRET=$JWT_SECRET
AUTH_JWT_ALGORITHM=HS256
ANON_KEY=$(grep ^anon= "$TMP/chaves.env" | cut -d= -f2)
SERVICE_KEY=$(grep ^service_role= "$TMP/chaves.env" | cut -d= -f2)
DATABASE_URL=postgresql://supabase_storage_admin:$SENHA@127.0.0.1:5432/$DB
DB_INSTALL_ROLES=false
DB_ANON_ROLE=anon
DB_SERVICE_ROLE=service_role
DB_AUTHENTICATED_ROLE=authenticated
DB_SUPER_USER=postgres
STORAGE_BACKEND=file
STORAGE_FILE_BACKEND_PATH=$TMP/storage-data
STORAGE_S3_BUCKET=local
TENANT_ID=local
GLOBAL_S3_BUCKET=local
UPLOAD_FILE_SIZE_LIMIT=52428800
UPLOAD_FILE_SIZE_LIMIT_STANDARD=52428800
IMAGE_TRANSFORMATION_ENABLED=false
RATE_LIMITER_ENABLED=false
PG_QUEUE_ENABLE=false
DEFAULT_METRICS_ENABLED=false
LOG_LEVEL=warn
CONF
(cd "$TMP/storage" && nohup npx tsx src/start/server.ts > "$TMP/storage.log" 2>&1 & echo $! > "$TMP/storage.pid")
for i in $(seq 1 60); do curl -sf localhost:5000/status >/dev/null && break; sleep 1; done
curl -sf localhost:5000/status >/dev/null || { tail -20 "$TMP/storage.log"; exit 1; }

echo "» migrações"
su postgres -c "psql -q -d $DB" <<SQL
-- Privilégios padrão do Storage no Supabase (quem protege os arquivos é a RLS de storage.objects)
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
grant all on all functions in schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
SQL
chmod o+rx "$RAIZ" "$RAIZ/supabase" "$RAIZ/supabase/migrations" 2>/dev/null || true
for f in "$RAIZ"/supabase/migrations/*.sql; do su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $f"; done

echo "» PostgREST, gateway e SMTP"
if [ ! -x "$TMP/postgrest" ]; then
  curl -sSL -o "$TMP/pgrst.tar.xz" https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
  tar xf "$TMP/pgrst.tar.xz" -C "$TMP"
fi
cat > "$TMP/pgrst.conf" <<CONF
db-uri = "postgres://authenticator:$SENHA@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
server-host = "127.0.0.1"
CONF
rm -f "$TMP/mail.log"
nohup "$TMP/postgrest" "$TMP/pgrst.conf" > "$TMP/postgrest.log" 2>&1 & echo $! > "$TMP/postgrest.pid"
nohup node "$DIR/gateway.mjs" > "$TMP/gateway.log" 2>&1 & echo $! > "$TMP/gateway.pid"
MAIL_LOG="$TMP/mail.log" nohup node "$DIR/smtp.mjs" > "$TMP/smtp.log" 2>&1 & echo $! > "$TMP/smtp.pid"

echo "» app"
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(grep ^anon= "$TMP/chaves.env" | cut -d= -f2)
export SUPABASE_SERVICE_ROLE_KEY=$(grep ^service_role= "$TMP/chaves.env" | cut -d= -f2)
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
cd "$RAIZ"
npx next build >"$TMP/build.log" 2>&1 || { tail -30 "$TMP/build.log"; exit 1; }
nohup npx next start -p 3000 > "$TMP/next.log" 2>&1 & echo $! > "$TMP/next.pid"
for i in $(seq 1 30); do curl -sf -o /dev/null localhost:3000/entrar && break; sleep 1; done
echo "Pronto: http://localhost:3000 (e-mails de teste em .e2e/mail.log)"
