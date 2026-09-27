// Percorre os fluxos da Fase 1 num navegador de verdade contra o stack local
// (tests/e2e/subir.sh). Uso: npm run test:e2e
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const B = process.env.APP_URL || 'http://localhost:3000'
const SHOTS = process.env.SHOTS || '.e2e/telas'
const MAIL = process.env.MAIL_LOG || '.e2e/mail.log'
fs.mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const ok = (c, m) => { console.log((c ? 'PASSOU  ' : 'FALHOU  ') + m); if (!c) process.exitCode = 1 }
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })

async function novoCtx() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('ERRO JS:', e.message))
  return p
}
const vis = (l) => l.waitFor({ timeout: 8000 }).then(() => true, () => false)
const toast = async (p) => (await p.locator('#toast.on').textContent({ timeout: 8000 }).catch(() => ''))?.trim()

const email = `dono${Date.now()}@teste.local`
const p = await novoCtx()

// 1. Criar conta e cadastrar a locadora
await p.goto(B + '/inicio')
ok(p.url().endsWith('/entrar'), 'sem sessão vai para /entrar')
await shot(p, '01-entrar')
await p.getByRole('button', { name: 'Criar conta' }).first().click()
await p.locator('.panel [name="email"], main form [name="email"]').first().fill(email)
await p.locator('[name="senha"]').fill('senha-forte-123')
await p.locator('.panel [name="senha2"], main form [name="senha2"]').first().fill('senha-forte-123')
await p.locator('form').getByRole('button', { name: 'Criar conta' }).last().click()
await p.waitForURL('**/cadastro')
ok(true, 'conta criada, cai no cadastro da locadora')
await p.locator('.panel [name="nome"], main form [name="nome"]').first().fill('Pula Alegria Festas')
await p.locator('.panel [name="doc"], main form [name="doc"]').first().fill('11222333000181')
await p.locator('.panel [name="nome_usuario"], main form [name="nome_usuario"]').first().fill('Ana Souza')
await shot(p, '02-cadastro')
await p.getByRole('button', { name: 'Criar minha locadora' }).click()
await p.waitForTimeout(800)
ok((await p.locator('.warn').textContent().catch(() => ''))?.includes('aceite os Termos') || p.url().endsWith('/cadastro'), 'exige aceite dos termos')
await p.locator('input[name=aceite]').check()
await p.getByRole('button', { name: 'Criar minha locadora' }).click()
await p.waitForURL('**/inicio')
ok((await p.locator('.brand b').textContent()) === 'Pula Alegria Festas', 'locadora criada; topo mostra o nome')
ok(await p.getByText('Primeiros passos').waitFor({ timeout: 8000 }).then(() => true, () => false), 'início mostra primeiros passos')
await shot(p, '03-inicio-vazio')

// 2. Brinquedos
await p.goto(B + '/cadastros/brinquedos')
for (const [nome, qtd, valor] of [['Pula-pula 3x3', '1', '250,00'], ['Cama elástica', '2', '200']]) {
  await p.getByRole('button', { name: 'Novo brinquedo' }).click()
  await p.locator('.panel [name="nome"], main form [name="nome"]').first().fill(nome)
  await p.locator('.panel [name="quantidade"], main form [name="quantidade"]').first().fill(qtd)
  await p.locator('.panel [name="valor"], main form [name="valor"]').first().fill(valor)
  await p.getByRole('button', { name: 'Salvar brinquedo' }).click()
  ok((await toast(p)) === 'Brinquedo cadastrado', `brinquedo "${nome}" cadastrado`)
  await p.waitForTimeout(400)
}
await p.getByRole('button', { name: /Pula-pula 3x3/ }).waitFor()
await shot(p, '04-brinquedos')

// 3. Clientes (CPF inválido e depois válido)
await p.goto(B + '/cadastros/clientes')
await p.getByRole('button', { name: 'Novo cliente' }).click()
const preencheCli = async (nome, cpf) => {
  await p.locator('.panel [name="nome"], main form [name="nome"]').first().fill(nome)
  await p.locator('.panel [name="cpf"], main form [name="cpf"]').first().fill(cpf)
  await p.locator('.panel [name="telefone"], main form [name="telefone"]').first().fill('41999998888')
  await p.locator('.panel [name="numero"], main form [name="numero"]').first().fill('100')
  await p.locator('.panel [name="rua"], main form [name="rua"]').first().fill('Rua das Flores')
  await p.locator('.panel [name="bairro"], main form [name="bairro"]').first().fill('Centro')
  await p.locator('.panel [name="cidade"], main form [name="cidade"]').first().fill('Curitiba')
  await p.locator('.panel [name="uf"], main form [name="uf"]').first().selectOption('PR')
}
await preencheCli('Maria Silva', '11111111111')
await p.getByRole('button', { name: 'Salvar cliente' }).click()
ok((await p.locator('.warn').textContent({ timeout: 5000 }))?.includes('CPF inválido'), 'CPF inválido é recusado')
await p.locator('.panel [name="cpf"], main form [name="cpf"]').first().fill('52998224725')
await p.getByRole('button', { name: 'Salvar cliente' }).click()
ok((await toast(p)) === 'Cliente cadastrado', 'cliente cadastrado')
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'Novo cliente' }).click()
await preencheCli('Outra Pessoa', '529.982.247-25')
await p.getByRole('button', { name: 'Salvar cliente' }).click()
ok((await p.locator('.warn').textContent({ timeout: 5000 }))?.includes('Já existe um cliente com este CPF'), 'CPF duplicado é recusado')
await p.keyboard.press('Escape')

// 4. Locação confirmada em 10/10/2026 com o pula-pula
await p.goto(B + '/locacoes/nova?dia=2026-10-10')
await p.locator('select').first().selectOption({ label: 'Maria Silva – 529.982.247-25' })
const linhaPula = p.locator('.it', { hasText: 'Pula-pula 3x3' })
await linhaPula.getByRole('button', { name: 'Mais Pula-pula 3x3' }).click()
await p.getByLabel('Taxa de entrega').fill('50,00')
await p.waitForTimeout(600)
ok((await linhaPula.locator('.lv').textContent())?.includes('1 de 1 livre'), 'formulário mostra disponibilidade (1 de 1 livre)')
ok((await p.locator('.sum .big').textContent())?.replace(/\s/g, ' ') === 'R$ 300,00', 'total calculado (250 + 50)')
await shot(p, '05-nova-locacao')
await p.getByRole('button', { name: 'Registrar locação' }).click()
await p.waitForURL(/\/locacoes\/[0-9a-f-]{36}$/)
const urlL1 = p.url()
ok((await p.locator('.muted', { hasText: 'Contrato' }).first().textContent()) === 'Contrato 0001/2026', 'locação registrada com número 0001/2026')
await shot(p, '06-detalhe')

// 5. Segunda locação no mesmo dia: a tela avisa e bloqueia; como orçamento passa
await p.goto(B + '/locacoes/nova?dia=2026-10-10')
await p.locator('select').first().selectOption({ label: 'Maria Silva – 529.982.247-25' })
const l2 = p.locator('.it', { hasText: 'Pula-pula 3x3' })
await p.waitForTimeout(600)
ok((await l2.locator('.lv').textContent())?.includes('Sem unidade livre'), 'segunda locação: pula-pula aparece sem unidade livre')
await l2.getByRole('button', { name: 'Mais Pula-pula 3x3' }).click()
await p.getByRole('button', { name: 'Registrar locação' }).click()
ok((await p.locator('.warn').textContent({ timeout: 5000 }))?.includes('Falta disponibilidade'), 'tela bloqueia reserva dupla')
await shot(p, '07-conflito')
await p.getByLabel('Situação').selectOption('orcamento')
await p.getByRole('button', { name: 'Registrar locação' }).click()
await p.waitForURL(/\/locacoes\/[0-9a-f-]{36}$/)
ok(await vis(p.getByText('Orçamento', { exact: true }).first()), 'mesmo dia como orçamento é aceito')
await p.getByRole('button', { name: 'Confirmar reserva' }).click()
await p.waitForTimeout(1500)
const w = await p.locator('.warn').textContent().catch(() => '')
ok(w?.includes('Sem disponibilidade: Pula-pula 3x3 em 10/10/2026'), 'banco barra a confirmação do orçamento em conflito: ' + w)

// 6. Pagamento e caixa
await p.goto(urlL1)
await p.getByRole('button', { name: 'Registrar pagamento' }).click()
await p.locator('.panel [name="valor"], main form [name="valor"]').first().fill('100,00')
await p.locator('form').getByRole('button', { name: 'Registrar pagamento' }).click()
ok((await toast(p)) === 'Pagamento registrado', 'pagamento registrado')
await p.waitForTimeout(800)
ok((await p.locator('b.due').textContent())?.replace(/\s/g, ' ') === 'R$ 200,00', 'saldo da locação: R$ 200,00')
await p.goto(B + '/caixa?mes=' + new Date().toISOString().slice(0, 7))
await p.getByRole('button', { name: 'Lançar saída' }).click()
await p.locator('.panel [name="valor"], main form [name="valor"]').first().fill('80')
await p.locator('.panel [name="categoria"], main form [name="categoria"]').first().selectOption('Combustível')
await p.locator('.panel [name="descricao"], main form [name="descricao"]').first().fill('Gasolina da semana')
await p.getByRole('button', { name: 'Salvar lançamento' }).click()
ok((await toast(p)) === 'Lançamento salvo', 'saída lançada')
await p.waitForTimeout(800)
const stats = (await p.locator('.stats').textContent())?.replace(/\s/g, ' ')
ok(stats?.includes('R$ 100,00') && stats?.includes('R$ 80,00') && stats?.includes('R$ 20,00'), 'caixa: entradas 100, saídas 80, saldo 20')
await shot(p, '08-caixa')

// 7. Agenda
await p.goto(B + '/agenda?mes=2026-10&dia=2026-10-10')
ok(await p.getByText('0 de 1 livre').waitFor({ timeout: 8000 }).then(() => true, () => false), 'agenda: disponibilidade no dia 10/10 (0 de 1 livre)')
await shot(p, '09-agenda')

// 8. Editar locação: tentar mover a locação 1 para uma data vaga funciona
await p.goto(urlL1 + '/editar')
await p.locator('input[type=date]').first().fill('2026-10-12')
await p.getByRole('button', { name: 'Salvar alterações' }).click()
await p.waitForURL(urlL1)
ok(await vis(p.getByText('12/10/2026').first()), 'edição muda a data (via salvar_locacao)')

// 9. Equipe: convidar entregador
await p.goto(B + '/ajustes/equipe')
await p.getByRole('button', { name: 'Convidar' }).click()
const emailE = `edu${Date.now()}@teste.local`
await p.locator('.panel [name="nome"], main form [name="nome"]').first().fill('Edu Entregador')
await p.locator('.panel [name="email"], main form [name="email"]').first().fill(emailE)
await p.locator('.panel [name="papel"], main form [name="papel"]').first().selectOption('entregador')
await p.getByRole('button', { name: 'Enviar convite' }).click()
const t = await toast(p)
ok(t === `Convite enviado para ${emailE}`, 'convite enviado: ' + t)
await shot(p, '10-equipe')

// 10. Entregador abre o link do convite, cria senha, aceita termos
await p.waitForTimeout(1000)
const mail = fs.readFileSync(MAIL, 'utf8')
const bloco = mail.split('=====').reverse().find((m) => m.includes(emailE)) ?? ''
const link = (bloco.replace(/=\r?\n/g, '').replace(/=3D/g, '=').match(/https?:\/\/[^\s"<>]+verify[^\s"<>]+/) ?? [])[0]?.replace(/&amp;/g, '&')
ok(!!link, 'e-mail de convite capturado')
const e = await novoCtx()
await e.goto(link)
await e.waitForURL('**/definir-senha', { timeout: 15000 })
ok(true, 'link padrão do convite (sessão no #fragmento) leva a /definir-senha')
await e.locator('.panel [name="senha"], main form [name="senha"]').first().fill('senha-entregador-1')
await e.locator('.panel [name="senha2"], main form [name="senha2"]').first().fill('senha-entregador-1')
await e.getByRole('button', { name: 'Salvar senha' }).click()
await e.waitForURL('**/aceite')
ok(true, 'membro convidado precisa aceitar os termos')
await e.locator('input[name=aceite]').check()
await e.getByRole('button', { name: 'Continuar' }).click()
await e.waitForURL('**/inicio')
const abas = await e.locator('.tabs a').allTextContents()
ok(abas.join(',') === 'Início,Agenda,Locações', 'entregador só vê Início, Agenda e Locações: ' + abas.join(','))
await e.goto(B + '/caixa')
ok(await e.waitForURL('**/inicio', { timeout: 8000 }).then(() => true, () => false), 'entregador não abre o caixa')
await e.goto(urlL1)
await e.locator('.blk h3', { hasText: 'Brinquedos' }).waitFor()
ok(!(await e.getByText('Falta receber').isVisible()), 'entregador não vê valores')
ok(!(await e.getByRole('link', { name: 'Editar' }).isVisible()), 'entregador não edita locação')
await shot(e, '11-entregador-detalhe')
await e.getByRole('button', { name: 'Registrar entrega' }).click()
await e.getByText('Brinquedos montados e ancorados').click()
await e.getByRole('button', { name: 'Confirmar entrega' }).click()
ok((await toast(e)) === 'Entrega registrada', 'entregador registra entrega')
await e.waitForTimeout(800)
ok(await vis(e.getByText('Montada no local').first()), 'status muda para "Montada no local"')

// 11. Dono vê a entrega registrada
await p.goto(urlL1)
ok(await vis(p.getByText(/Entrega registrada/)), 'dono vê a vistoria de entrega')
await shot(p, '12-detalhe-entregue')

await browser.close()
