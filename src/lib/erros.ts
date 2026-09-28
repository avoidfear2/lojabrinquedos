export type Resultado<T = undefined> = { ok: true; dados?: T; msg?: string } | { ok: false; erro: string }

interface ErroBanco {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

/** Traduz erros do Postgres/PostgREST/Auth para mensagens para o locador. */
export function traduzErro(e: unknown, podeGravar = true): string {
  const err = (e ?? {}) as ErroBanco
  const m = err.message ?? String(e ?? '')

  // Mensagens das funções e triggers do banco já estão em português
  if (err.code === 'P0001' || /^(Sem disponibilidade|O plano Essencial|Faça login|Este usuário já pertence|Cliente não pertence|Brinquedo não|Locação não|Documento já assinado|Sem permissão|Item sem brinquedo|Itens inválidos)/.test(m)) {
    return m
  }
  if (err.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return podeGravar
      ? 'Você não tem permissão para alterar estes dados.'
      : 'Sua conta está somente leitura: a assinatura do plano está pendente. Regularize para voltar a gravar.'
  }
  if (err.code === '23505') {
    if (/clientes/.test(m) || /cpf/.test(m)) return 'Já existe um cliente com este CPF.'
    if (/slug/.test(m)) return 'Este endereço de link já está em uso.'
    return 'Já existe um registro igual.'
  }
  if (err.code === '23503') {
    if (/clientes|cliente_id/.test(m + (err.details ?? ''))) return 'Este cliente tem locações. Exclua ou troque o cliente dessas locações antes de remover o cadastro.'
    return 'Este registro está ligado a outros dados e não pode ser excluído.'
  }
  if (err.code === '23514') {
    if (/data_fim/.test(m)) return 'Confira as datas: a retirada deve ser no máximo 60 dias depois da entrega e nunca antes dela.'
    if (/cpf/.test(m)) return 'CPF inválido.'
    return 'Algum valor está fora do permitido. Confira os campos.'
  }
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') return 'Algum campo está em formato inválido. Confira datas, horários e valores.'
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (/User already registered|already been registered/i.test(m)) return 'Este e-mail já tem conta.'
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/rate limit/i.test(m)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (/secret API key/i.test(m)) {
    return 'Configuração: a chave secreta (sb_secret_…) foi usada no navegador. Em NEXT_PUBLIC_SUPABASE_ANON_KEY vai a publishable key (sb_publishable_…).'
  }
  if (/Invalid API key|No API key|apikey/i.test(m)) {
    return 'Configuração: a chave do Supabase não foi aceita. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel e faça um novo deploy.'
  }
  if (/Failed to fetch|fetch failed|NetworkError|Load failed|ERR_NAME_NOT_RESOLVED/i.test(m)) {
    return 'Não foi possível conectar ao Supabase. Verifique a internet e, se persistir, confira NEXT_PUBLIC_SUPABASE_URL na Vercel.'
  }
  return 'Não foi possível salvar. Verifique a conexão e tente de novo.'
}

/** Erros de login e cadastro: quando não há tradução, mostra o detalhe técnico para facilitar o suporte. */
export function traduzErroAuth(e: unknown): string {
  const t = traduzErro(e)
  if (!t.startsWith('Não foi possível salvar')) return t
  const m = (e as ErroBanco | null)?.message ?? String(e ?? '')
  return `Não foi possível entrar. Detalhe: ${m || 'erro desconhecido'}`
}
