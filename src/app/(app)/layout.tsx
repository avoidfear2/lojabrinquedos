import { Abas } from '@/components/Abas'
import { SessaoProvider } from '@/components/Sessao'
import { Topo } from '@/components/Topo'
import { ToastProvider } from '@/components/ui'
import { PAPEIS } from '@/lib/dominio/constantes'
import { fData } from '@/lib/dominio/formato'
import { abas } from '@/lib/permissoes'
import { contexto } from '@/lib/sessao'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { usuario, locadora, plano, podeGravar, uid } = await contexto()
  const subtitulo = usuario.papel === 'dono' ? 'Painel do locador' : `${usuario.nome} · ${PAPEIS[usuario.papel]}`
  return (
    <SessaoProvider valor={{ papel: usuario.papel, podeGravar, uid }}>
      <ToastProvider>
        <Topo nome={locadora.nome} subtitulo={subtitulo} />
        <main id="main">
          {!podeGravar && (
            <div className="banner" role="status">
              Conta somente leitura: a assinatura do plano está pendente
              {plano?.vencimento ? ` (vencimento em ${fData(plano.vencimento)})` : ''}. Você ainda consulta tudo, mas não consegue gravar.
            </div>
          )}
          {children}
        </main>
        <Abas abas={abas(usuario.papel)} />
      </ToastProvider>
    </SessaoProvider>
  )
}
