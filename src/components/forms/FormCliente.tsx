'use client'

import { Area, BotaoConfirmar, Campo, Erro, Selecao } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { excluirCliente, salvarCliente } from '@/lib/acoes/clientes'
import { UFS } from '@/lib/dominio/constantes'
import type { Cliente } from '@/lib/tipos'

export function FormCliente({
  c,
  onFim,
  ufPadrao,
  permitirExcluir = true,
}: {
  c?: Cliente | null
  onFim: (c?: Cliente) => void
  ufPadrao?: string
  permitirExcluir?: boolean
}) {
  const { executar, erro, pendente } = useAcao()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        executar(() => salvarCliente(fd), (novo) => onFim(novo))
      }}
    >
      <input type="hidden" name="id" value={c?.id ?? ''} />
      <Campo rotulo="Nome completo" name="nome" defaultValue={c?.nome} obrigatorio autoComplete="off" />
      <div className="g2">
        <Campo rotulo="CPF" name="cpf" mascara="cpf" inputMode="numeric" placeholder="000.000.000-00" defaultValue={c?.cpf} obrigatorio />
        <Campo rotulo="RG" name="rg" defaultValue={c?.rg} />
      </div>
      <div className="g2">
        <Campo rotulo="Telefone / WhatsApp" name="telefone" mascara="tel" inputMode="tel" placeholder="(41) 99999-9999" defaultValue={c?.telefone} obrigatorio />
        <Campo rotulo="E-mail" name="email" type="email" defaultValue={c?.email} />
      </div>
      <fieldset>
        <legend>Endereço</legend>
        <div className="g2">
          <Campo rotulo="CEP" name="cep" mascara="cep" inputMode="numeric" defaultValue={c?.cep} />
          <Campo rotulo="Número" name="numero" defaultValue={c?.numero} obrigatorio />
        </div>
        <Campo rotulo="Rua" name="rua" defaultValue={c?.rua} obrigatorio />
        <div className="g2">
          <Campo rotulo="Complemento" name="complemento" defaultValue={c?.complemento} />
          <Campo rotulo="Bairro" name="bairro" defaultValue={c?.bairro} obrigatorio />
        </div>
        <div className="g2">
          <Campo rotulo="Cidade" name="cidade" defaultValue={c?.cidade} obrigatorio />
          <Selecao rotulo="UF" name="uf" opcoes={UFS} defaultValue={c?.uf ?? ufPadrao ?? ''} vazio="" />
        </div>
      </fieldset>
      <Area rotulo="Observações" name="observacoes" defaultValue={c?.observacoes} placeholder="Ex.: prefere contato à tarde; portão lateral" />
      <Erro msg={erro} />
      <div className="acts">
        {c && permitirExcluir && (
          <BotaoConfirmar disabled={pendente} onConfirmar={() => executar(() => excluirCliente(c.id), () => onFim())}>
            Excluir
          </BotaoConfirmar>
        )}
        <button className="btn primary" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar cliente'}
        </button>
      </div>
    </form>
  )
}
