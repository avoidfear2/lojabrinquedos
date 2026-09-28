import type { Metadata } from 'next'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import { FormEntrar } from './FormEntrar'

export const metadata: Metadata = { title: 'Entrar' }

/** Problemas comuns de configuração das variáveis na hospedagem (mostrados só quando existem). */
function problemasConfig(): string[] {
  const p: string[] = []
  if (!SUPABASE_URL) p.push('NEXT_PUBLIC_SUPABASE_URL está vazia.')
  else if (!/^https:\/\/[^/]+$/.test(SUPABASE_URL.replace(/\/$/, ''))) {
    p.push('NEXT_PUBLIC_SUPABASE_URL deve ser só o endereço do projeto, como https://xxxx.supabase.co (sem espaços nem /rest/v1 no fim).')
  }
  if (!SUPABASE_ANON_KEY) p.push('NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia.')
  else if (SUPABASE_ANON_KEY.startsWith('sb_secret_')) {
    p.push('NEXT_PUBLIC_SUPABASE_ANON_KEY está com a chave secreta. Use a publishable key (sb_publishable_…).')
  } else if (/\s/.test(SUPABASE_ANON_KEY)) p.push('NEXT_PUBLIC_SUPABASE_ANON_KEY tem espaços ou quebras de linha.')
  return p
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const config = problemasConfig()
  return (
    <>
      <h1>Sua locadora organizada</h1>
      <p className="lead">Agenda, locações, clientes, brinquedos e caixa num só lugar, no celular.</p>
      {config.length > 0 && (
        <div className="warn">
          O app não está configurado corretamente. Ajuste as variáveis na hospedagem e faça um novo deploy:
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {config.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}
      {erro === 'link' && <div className="warn">O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.</div>}
      <FormEntrar />
    </>
  )
}
