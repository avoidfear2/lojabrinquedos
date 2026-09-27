'use client'

import { Area, BotaoConfirmar, Campo, Erro, Selecao } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { excluirBrinquedo, salvarBrinquedo } from '@/lib/acoes/brinquedos'
import { CATS_B, ENERGIA } from '@/lib/dominio/constantes'
import { nfmt } from '@/lib/dominio/formato'
import type { Brinquedo } from '@/lib/tipos'

export function FormBrinquedo({ b, onFim }: { b?: Brinquedo | null; onFim: () => void }) {
  const { executar, erro, pendente } = useAcao()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        executar(() => salvarBrinquedo(fd), onFim)
      }}
    >
      <input type="hidden" name="id" value={b?.id ?? ''} />
      <Campo rotulo="Nome" name="nome" defaultValue={b?.nome} obrigatorio placeholder="Ex.: Pula-pula 3 x 3 m" />
      <div className="g2">
        <Selecao rotulo="Categoria" name="categoria" opcoes={CATS_B} defaultValue={b?.categoria ?? 'Inflável'} />
        <Campo rotulo="Quantidade que você tem" name="quantidade" type="number" min={1} inputMode="numeric" defaultValue={b?.quantidade ?? 1} obrigatorio />
      </div>
      <div className="g2">
        <Campo rotulo="Valor da diária (R$)" name="valor" inputMode="decimal" placeholder="0,00" defaultValue={b ? nfmt(b.valor_diaria) : ''} obrigatorio />
        <Campo rotulo="Dimensões" name="dimensoes" placeholder="3 x 3 x 2,5 m" defaultValue={b?.dimensoes} />
      </div>
      <div className="g2">
        <Campo rotulo="Faixa etária" name="faixa_etaria" placeholder="3 a 10 anos" defaultValue={b?.faixa_etaria} />
        <Campo rotulo="Crianças ao mesmo tempo" name="capacidade" type="number" min={0} inputMode="numeric" defaultValue={b?.capacidade} />
      </div>
      <Selecao rotulo="Energia elétrica" name="energia" opcoes={ENERGIA} defaultValue={b?.energia ?? 'Não precisa'} />
      <Area rotulo="Regras de uso deste brinquedo" name="regras" defaultValue={b?.regras} placeholder="Ex.: Peso máximo de 40 kg por criança. Proibido uso com água." />
      <label className="check">
        <input type="checkbox" name="ativo" defaultChecked={b ? b.ativo : true} /> Disponível para locação
      </label>
      <Erro msg={erro} />
      <div className="acts">
        {b && (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => excluirBrinquedo(b.id), onFim)}>
            Excluir
          </BotaoConfirmar>
        )}
        <button className="btn primary" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar brinquedo'}
        </button>
      </div>
    </form>
  )
}
