'use client'

import { Area, Campo, Erro } from '@/components/ui'
import { useAcao } from '@/components/useAcao'
import { salvarAjustes } from '@/lib/acoes/ajustes'
import { nfmt } from '@/lib/dominio/formato'
import type { Locadora } from '@/lib/tipos'

export function FormAjustes({ l }: { l: Locadora }) {
  const { executar, erro, pendente } = useAcao()
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault()
        executar(() => salvarAjustes(new FormData(e.currentTarget)))
      }}
    >
      <fieldset style={{ marginTop: 0 }}>
        <legend>Dados do locador</legend>
        <p className="muted" style={{ marginTop: -4, fontSize: '.9rem' }}>
          Aparecem para os seus clientes: nas mensagens e, na próxima fase, no contrato, com você como locador.
        </p>
        <Campo rotulo="Nome ou razão social" name="nome" defaultValue={l.nome} obrigatorio />
        <div className="g2">
          <Campo rotulo="CPF ou CNPJ" name="cpf_cnpj" mascara="doc" inputMode="numeric" defaultValue={l.cpf_cnpj} obrigatorio />
          <Campo rotulo="Telefone / WhatsApp" name="telefone" mascara="tel" inputMode="tel" defaultValue={l.telefone} />
        </div>
        <Campo rotulo="Endereço completo" name="endereco" placeholder="Rua, número, bairro, cidade/UF" defaultValue={l.endereco} />
        <div className="g2">
          <Campo rotulo="Cidade onde o contrato é assinado" name="cidade" placeholder="Curitiba/PR" defaultValue={l.cidade} />
          <Campo rotulo="Comarca do foro" name="comarca_foro" placeholder="Curitiba/PR" defaultValue={l.comarca_foro} />
        </div>
        <Campo rotulo="Chave Pix (sua, para receber dos clientes)" name="chave_pix" defaultValue={l.chave_pix} />
      </fieldset>
      <fieldset>
        <legend>Condições do contrato</legend>
        <div className="g3">
          <Campo rotulo="Cancelamento sem custo até (dias antes)" name="canc_dias" type="number" min={0} inputMode="numeric" defaultValue={l.canc_dias} />
          <Campo rotulo="Retenção após esse prazo (%)" name="canc_pct" type="number" min={0} max={100} inputMode="numeric" defaultValue={l.canc_pct} />
          <Campo rotulo="Taxa de nova visita (R$)" name="taxa_visita" inputMode="decimal" placeholder="0,00" defaultValue={Number(l.taxa_visita) ? nfmt(l.taxa_visita) : ''} />
        </div>
        <Area
          rotulo="Cláusulas adicionais (uma por parágrafo)"
          name="clausulas_extras"
          defaultValue={l.clausulas_extras}
          placeholder="Ex.: O LOCATÁRIO autoriza o uso de fotos do evento, sem identificação das crianças, para divulgação."
        />
      </fieldset>
      <Erro msg={erro} />
      <div className="acts">
        <button className="btn primary" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar ajustes'}</button>
      </div>
    </form>
  )
}
