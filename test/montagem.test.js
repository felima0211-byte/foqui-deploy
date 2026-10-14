// Testes com os dados reais das linhas de montagem, das medidas (concha -> g) e das vendas.
// As contas esperadas foram feitas à mão a partir dos documentos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.js';
import { carregarSeed } from '../src/seed.js';
import { criarServidor } from '../src/server.js';
import { carregarModelo, planoDasMetas, pendenciasDasMetas, capacidade, sugerirCompra, sugerirMetas } from '../src/engine.js';
import { LINHAS, TOTAL_RELATORIO, consolidar } from '../data/vendas.js';
import { LANCHES } from '../data/lanches.js';
import { MEDIDAS } from '../data/seed.js';

function banco() {
  const db = abrirBanco(':memory:');
  carregarSeed(db);
  const modelo = () => carregarModelo(db);
  const lanche = (nome) => db.prepare('SELECT id FROM lanches WHERE nome = ?').get(nome).id;
  const item = (nome) => db.prepare('SELECT id FROM itens WHERE nome = ?').get(nome).id;
  return { db, modelo, lanche, item };
}
const compra = (plano, nome) => plano.compras.find((c) => c.nome === nome);
const lotes = (plano, nome) => plano.producao.find((p) => p.nome === nome)?.lotes;

test('Frango x100: concha de 85 ml vale 50 g, tomate 4 fatias de 10 g, molho 30 g', () => {
  const { modelo, lanche } = banco();
  const plano = planoDasMetas(modelo(), [{ lancheId: lanche('Frango'), qtd: 100 }]);
  assert.equal(compra(plano, 'Muçarela ralada').necessario, 5000); // 100 x 50 g (e não 8.500 g)
  assert.equal(compra(plano, 'Tomate (fatias)').necessario, 4000); // 100 x 4 x 10 g
  assert.equal(compra(plano, 'Rúcula').necessario, 1500); // 100 x 15 g
  assert.equal(lotes(plano, 'Tiras de frango'), 2); // 7.000 g / 4.060 g por lote
  assert.equal(lotes(plano, 'Maionese de tomate seco com manjericão'), 7); // 3.000 g / 480 g = 6,25 => 7
  assert.equal(lotes(plano, 'Foqui G (pão)'), 1); // 2 fatias = 0,1 pão; 10 pães < 16 por lote
  // tempero do tomate: 1 g por sanduíche = 100 g, receita fracionável de 1.200 g
  const tempero = plano.producao.find((p) => p.nome === 'Tempero para tomate');
  assert.equal(tempero.necessario, 100);
  assert.ok(Math.abs(tempero.lotes - 100 / 1200) < 1e-9);
});

test('Caprese x10: muçarela 60 ml = 35 g, búfala 85 ml = 50 g, 7 fatias = 70 g', () => {
  const { modelo, lanche } = banco();
  const plano = planoDasMetas(modelo(), [{ lancheId: lanche('Caprese'), qtd: 10 }]);
  assert.equal(compra(plano, 'Muçarela ralada').necessario, 350);
  assert.equal(compra(plano, 'Muçarela de búfala').necessario, 500);
  assert.equal(compra(plano, 'Tomate (fatias)').necessario, 700);
  assert.equal(lotes(plano, 'Maionese de pesto'), 1); // 300 g < 510 g
});

test('Linguiça Blumenau x10: catupiry em tiras de 20 g, pacote de 1,5 kg', () => {
  const { modelo, lanche } = banco();
  const plano = planoDasMetas(modelo(), [{ lancheId: lanche('Linguiça Blumenau'), qtd: 10 }]);
  const c = compra(plano, 'Catupiry');
  assert.equal(c.necessario, 400); // 2 tiras x 20 g x 10
  assert.deepEqual(c.compra.embalagens, { n: 1, nome: 'pacote', tamanho: 1.5 });
  assert.equal(c.compra.sugerido, 1.5);
  assert.equal(compra(plano, 'Provolone').necessario, 350); // 60 ml = 35 g
  assert.equal(compra(plano, 'Linguiça Blumenau').necessario, 800);
});

test('Salada Pernil: coleslaw em dobro e molho Caesar de 70 g', () => {
  const { modelo, lanche } = banco();
  const plano = planoDasMetas(modelo(), [{ lancheId: lanche('Salada Pernil'), qtd: 10 }]);
  assert.equal(compra(plano, 'Repolho roxo fatiado').necessario, 500); // 2 x 25 g x 10
  assert.equal(compra(plano, 'Cenoura').necessario, 400); // 2 x 20 g x 10 (a carne de panela, que também usa cenoura, não está na meta)
  assert.equal(compra(plano, 'Abacaxi em cubos').necessario, 600); // 2 x 30 g x 10
  const caesar = plano.producao.find((p) => p.nome === 'Molho Caesar');
  assert.equal(caesar.necessario, 700);
});

test('Sobremesas: Rabanada x10 usa brioche 2/9 de pão, sorvete 80 g, calda 30 g', () => {
  const { modelo, lanche } = banco();
  const plano = planoDasMetas(modelo(), [{ lancheId: lanche('Rabanada'), qtd: 10 }]);
  const brioche = plano.producao.find((p) => p.nome === 'Brioche (pão)');
  assert.ok(Math.abs(brioche.necessario - 20 / 9) < 1e-9);
  assert.equal(compra(plano, 'Sorvete (bola de 80 g)').necessario, 800);
  assert.equal(plano.producao.find((p) => p.nome === 'Calda de doce de leite').necessario, 300);
});

test('compra sempre em kg/L, para cima em passos de 0,1; embalagem vira pacotes inteiros', () => {
  const kg = { unidade: 'g' };
  assert.deepEqual(sugerirCompra(kg, 5430), { un: 'kg', exato: 5.43, sugerido: 5.5, embalagens: null });
  assert.equal(sugerirCompra(kg, 300).sugerido, 0.3); // sem erro de ponto flutuante
  assert.equal(sugerirCompra(kg, 8).sugerido, 0.1);
  assert.equal(sugerirCompra(kg, 0).sugerido, 0);
  assert.deepEqual(sugerirCompra({ unidade: 'ml' }, 1250), { un: 'L', exato: 1.25, sugerido: 1.3, embalagens: null });
  assert.equal(sugerirCompra({ unidade: 'un', unidade_label: 'limão' }, 2.2).sugerido, 3);
  const catupiry = { unidade: 'g', embalagem_qtd: 1500, embalagem_nome: 'pacote' };
  assert.equal(sugerirCompra(catupiry, 1500).embalagens.n, 1);
  assert.equal(sugerirCompra(catupiry, 1501).embalagens.n, 2);
  assert.equal(sugerirCompra(catupiry, 1501).sugerido, 3);
});

test('vendas: cada linha do relatório entra uma vez e o total fecha com 4.299', () => {
  assert.equal(LINHAS.reduce((s, l) => s + l[2], 0), TOTAL_RELATORIO);
  const codigos = LINHAS.map((l) => l[0]);
  assert.equal(new Set(codigos).size, codigos.length, 'código repetido');
  const { porLanche, ignorados } = consolidar();
  const chaves = new Set(LANCHES.map((l) => l[0]));
  for (const k of porLanche.keys()) assert.ok(chaves.has(k), `venda para lanche inexistente: ${k}`);
  const q = (k) => porLanche.get(k).qtd;
  // sanduíche avulso + iFood + combos que carregam o sanduíche
  assert.equal(q('frango'), 136 + 230);
  assert.equal(q('frango-bacon'), 138 + 71 + 75 + 28);
  assert.equal(q('pernil'), 104 + 137 + 74 + 20);
  assert.equal(q('mignon'), 85 + 80 + 12 + 19);
  assert.equal(q('brigadeiro'), 26 + 52 + 5); // "5 brigadeiros" vale 5
  const mapeado = [...porLanche.values()].reduce((s, v) => s + v.qtd, 0);
  const ign = ignorados.reduce((s, i) => s + i.qtd, 0);
  assert.equal(mapeado + ign, TOTAL_RELATORIO + 4); // o "5 brigadeiros" conta 1 no relatório e 5 na produção
});

test('metas pelas vendas: "total" fecha exato e "dias" usa a média diária', () => {
  const { db } = banco();
  const linhas = db.prepare('SELECT v.lanche_id AS lancheId, l.categoria, v.qtd FROM vendas v JOIN lanches l ON l.id = v.lanche_id').all();
  const total = sugerirMetas(linhas, { modo: 'total', total: 100 });
  const principais = linhas.filter((l) => l.categoria !== 'Adicional');
  assert.equal(principais.reduce((s, l) => s + total.get(l.lancheId), 0), 100);
  const frango = db.prepare("SELECT id FROM lanches WHERE nome = 'Frango'").get().id;
  assert.ok(Math.abs(total.get(frango) - (366 / 2711) * 100) < 1); // 13,5 lanches: 13 ou 14, conforme o maior resto
  const dias = sugerirMetas(linhas, { modo: 'dias', dias: 1, fator: 1, diasPeriodo: 31 });
  assert.equal(dias.get(frango), 12); // 366 / 31 = 11,8 por dia
  const folga = sugerirMetas(linhas, { modo: 'dias', dias: 3, fator: 1.2, diasPeriodo: 31 });
  assert.equal(folga.get(frango), 43); // 366 / 31 x 3 x 1,2 = 42,503 -> 43
});

test('capacidade e pendências não quebram com quantidade pendente (manteiga do pão)', () => {
  const { modelo, lanche } = banco();
  const m = modelo();
  const pend = pendenciasDasMetas(m, [{ lancheId: lanche('Frango'), qtd: 5 }]);
  assert.equal(pend[0].confianca, 'pendente'); // pendentes primeiro
  assert.ok(pend.some((p) => p.nome === 'Manteiga sem sal' && p.confianca === 'pendente'));
  assert.ok(pend.some((p) => p.medida === 'Fatia' && p.nome.startsWith('Foqui G') && p.confianca === 'estimado'));
  assert.ok(!pend.some((p) => p.nome === 'Muçarela ralada'), 'muçarela foi pesada: confirmada');
  const cap = capacidade(m);
  assert.equal(cap.length, m.lanches.length);
  assert.ok(cap.every((c) => c.prontos === null || Number.isFinite(c.prontos)));
});

test('dados: toda medida usada existe, nenhuma linha usa unidade errada e a muçarela fatiada saiu', () => {
  const { db } = banco();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM itens WHERE slug = 'mussarela'").get().n, 0);
  const sem = db.prepare('SELECT COUNT(*) AS n FROM lanche_componentes WHERE medida_id IS NOT NULL AND medida_qtd IS NULL').get().n;
  assert.equal(sem, 0);
  // o valor gravado em `qtd` é sempre medida_qtd x medida.qtd
  const bad = db.prepare('SELECT COUNT(*) AS n FROM lanche_componentes c JOIN medidas m ON m.id = c.medida_id WHERE abs(c.qtd - c.medida_qtd * m.qtd) > 1e-9').get().n;
  assert.equal(bad, 0);
  assert.equal(MEDIDAS.filter((m) => m[1] === 'Concha 85 ml' && m[0] === 'mussarela-ralada')[0][2], 50);
});

// ── API ────────────────────────────────────────────────────────────────────
async function subir() {
  const db = abrirBanco(':memory:');
  carregarSeed(db);
  const servidor = criarServidor(db);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const chamar = async (metodo, caminho, corpo) => {
    const r = await fetch(base + caminho, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    const tipo = r.headers.get('content-type') || '';
    return { status: r.status, corpo: tipo.includes('json') ? await r.json() : await r.text() };
  };
  return { chamar, fechar: () => new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(ok); }), db };
}

test('API: corrigir a pesagem da concha recalcula lanches, produção e compras', async () => {
  const { chamar, fechar } = await subir();
  try {
    const frango = (await chamar('GET', '/api/lanches')).corpo.find((l) => l.nome === 'Frango');
    await chamar('PUT', `/api/lanches/${frango.id}`, { meta_qtd: 100 });
    const medidas = (await chamar('GET', '/api/medidas')).corpo;
    const concha = medidas.find((m) => m.item_nome === 'Muçarela ralada' && m.nome === 'Concha 85 ml');
    assert.equal(concha.qtd, 50);
    const antes = (await chamar('GET', '/api/compras')).corpo.comprar.find((c) => c.nome === 'Muçarela ralada');
    assert.equal(antes.necessario, 5000);
    assert.equal(antes.compra.sugerido, 5);

    const r = await chamar('PUT', `/api/medidas/${concha.id}`, { qtd: 52 });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.confianca, 'confirmado');
    const depois = (await chamar('GET', '/api/compras')).corpo.comprar.find((c) => c.nome === 'Muçarela ralada');
    assert.equal(depois.necessario, 5200);
    assert.equal(depois.compra.sugerido, 5.2);
    // o lanche mostra o valor convertido
    const f2 = (await chamar('GET', '/api/lanches')).corpo.find((l) => l.nome === 'Frango');
    const comp = f2.componentes.find((c) => c.nome === 'Muçarela ralada');
    assert.equal(comp.qtd, 52);
    assert.equal(comp.medida_nome, 'Concha 85 ml');

    // medida em uso não pode ser apagada
    assert.equal((await chamar('DELETE', `/api/medidas/${concha.id}`)).status, 409);
  } finally {
    await fechar();
  }
});

test('API: sugerir e aplicar metas pelas vendas', async () => {
  const { chamar, fechar } = await subir();
  try {
    const v = (await chamar('GET', '/api/vendas')).corpo;
    assert.equal(v.periodo.dias, 31);
    assert.equal(v.totalPrincipal, 2711);
    const r = await chamar('POST', '/api/metas/sugerir', { modo: 'total', total: 200, aplicar: true });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.totalPrincipal, 200);
    const plano = (await chamar('GET', '/api/plano')).corpo;
    assert.ok(plano.totalLanches >= 200); // inclui adicionais
    const ruim = await chamar('POST', '/api/metas/sugerir', { modo: 'dias', dias: 0 });
    assert.equal(ruim.status, 400);
    assert.equal((await chamar('POST', '/api/metas/zerar')).status, 201);
    assert.equal((await chamar('GET', '/api/plano')).corpo.totalLanches, 0);
  } finally {
    await fechar();
  }
});

test('API: lista de compras em kg, CSV com pacotes e pendências visíveis', async () => {
  const { chamar, fechar } = await subir();
  try {
    await chamar('POST', '/api/metas/sugerir', { modo: 'dias', dias: 1, aplicar: true });
    const c = (await chamar('GET', '/api/compras')).corpo;
    assert.ok(c.comprar.length > 20);
    assert.ok(c.comprar.every((x) => x.compra && x.compra.sugerido >= x.compra.exato - 1e-9));
    assert.ok(c.pendencias.length > 0);
    const csv = (await chamar('GET', '/api/compras.csv')).corpo;
    assert.match(csv, /Catupiry;/);
    assert.match(csv, /pacote\(s\) de 1,5 kg/);
    const todas = (await chamar('GET', '/api/pendencias')).corpo;
    assert.ok(todas.some((p) => p.nome === 'Manteiga sem sal'));
  } finally {
    await fechar();
  }
});

test('API: lanche com quantidade pendente aceita zero; ao preencher vira confirmado', async () => {
  const { chamar, fechar } = await subir();
  try {
    const itens = (await chamar('GET', '/api/itens')).corpo;
    const manteiga = itens.find((i) => i.nome === 'Manteiga sem sal');
    const sal = itens.find((i) => i.nome === 'Sal');
    const l = (await chamar('POST', '/api/lanches', { nome: 'Teste pendente', categoria: 'Sanduíche' })).corpo;
    let r = await chamar('PUT', `/api/lanches/${l.id}`, { componentes: [{ item_id: manteiga.id, qtd: 0, confianca: 'pendente' }] });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.componentes[0].confianca, 'pendente');
    r = await chamar('PUT', `/api/lanches/${l.id}`, { componentes: [{ item_id: manteiga.id, qtd: 6, confianca: 'pendente' }] });
    assert.equal(r.corpo.componentes[0].confianca, 'confirmado');
    // zero só vale quando pendente
    r = await chamar('PUT', `/api/lanches/${l.id}`, { componentes: [{ item_id: sal.id, qtd: 0 }] });
    assert.equal(r.status, 400);
    // medida de outro item é recusada
    const medida = (await chamar('GET', '/api/medidas')).corpo[0];
    r = await chamar('PUT', `/api/lanches/${l.id}`, { componentes: [{ item_id: sal.id, medida_id: medida.id, medida_qtd: 1 }] });
    assert.equal(r.status, 400);
  } finally {
    await fechar();
  }
});
