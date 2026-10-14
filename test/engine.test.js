import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.js';
import { carregarSeed } from '../src/seed.js';
import { carregarModelo, calcularPlano, demandaDasMetas, planoDasMetas, capacidade, auditar, ordenarTopologico, ErroDeModelo } from '../src/engine.js';

// Banco em memória com um cenário pequeno e fácil de conferir na mão.
function cenario() {
  const db = abrirBanco(':memory:');
  const item = (slug, tipo, unidade = 'g', extra = {}) =>
    Number(
      db.prepare('INSERT INTO itens (slug, nome, tipo, unidade, porcao_qtd, aproveitamento) VALUES (?, ?, ?, ?, ?, ?)')
        .run(slug, slug, tipo, unidade, extra.porcao ?? null, extra.aprov ?? 1).lastInsertRowid
    );
  const receita = (itemId, rend, linhas, fracionavel = 0) => {
    db.prepare('INSERT INTO receitas (item_id, rendimento_qtd, fracionavel) VALUES (?, ?, ?)').run(itemId, rend, fracionavel);
    for (const [ing, qtd] of linhas) db.prepare('INSERT INTO receita_ingredientes (receita_item_id, item_id, qtd) VALUES (?, ?, ?)').run(itemId, ing, qtd);
  };
  const estoque = (itemId, qtd) => db.prepare("INSERT INTO estoque_movimentos (item_id, qtd, tipo) VALUES (?, ?, 'entrada')").run(itemId, qtd);
  const lanche = (nome, comps, meta = 0) => {
    const id = Number(db.prepare('INSERT INTO lanches (nome, meta_qtd) VALUES (?, ?)').run(nome, meta).lastInsertRowid);
    for (const [it, q] of comps) db.prepare('INSERT INTO lanche_componentes (lanche_id, item_id, qtd) VALUES (?, ?, ?)').run(id, it, q);
    return id;
  };
  return { db, item, receita, estoque, lanche };
}

const porId = (lista, id) => lista.find((x) => x.itemId === id);

test('arredonda lotes para cima e informa a sobra', () => {
  const { db, item, receita, lanche } = cenario();
  const a = item('farinha', 'insumo');
  const p = item('pasta', 'preparo');
  receita(p, 100, [[a, 50]]);
  const l = lanche('x', [[p, 25]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]); // precisa de 250 g
  const pr = porId(plano.producao, p);
  assert.equal(pr.necessario, 250);
  assert.equal(pr.lotes, 3);
  assert.equal(pr.produzido, 300);
  assert.equal(pr.sobra, 50);
  assert.equal(porId(plano.compras, a).comprar, 150);
});

test('receita fracionável usa meio lote', () => {
  const { db, item, receita, lanche } = cenario();
  const a = item('farinha', 'insumo');
  const p = item('pasta', 'preparo');
  receita(p, 100, [[a, 50]], 1);
  const l = lanche('x', [[p, 25]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]);
  assert.equal(porId(plano.producao, p).lotes, 2.5);
  assert.equal(porId(plano.producao, p).sobra, 0);
  assert.equal(porId(plano.compras, a).comprar, 125);
});

test('estoque de preparo reduz os lotes', () => {
  const { db, item, receita, lanche, estoque } = cenario();
  const a = item('farinha', 'insumo');
  const p = item('pasta', 'preparo');
  receita(p, 100, [[a, 50]]);
  estoque(p, 100);
  const l = lanche('x', [[p, 30]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]); // 300 - 100 = 200 => 2 lotes
  const pr = porId(plano.producao, p);
  assert.equal(pr.usaEstoque, 100);
  assert.equal(pr.lotes, 2);
  assert.equal(porId(plano.compras, a).comprar, 100);
});

test('sub-receita usada por vários pais soma a demanda antes de calcular lotes', () => {
  const { db, item, receita, lanche } = cenario();
  const ov = item('ovo', 'insumo');
  const base = item('maionese', 'preparo');
  const molho = item('molho', 'preparo');
  receita(base, 300, [[ov, 100]]);
  receita(molho, 100, [[base, 40]]);
  // por lanche: 50 g de maionese + 10 g de molho. Para 10 lanches: 500 maionese direto + 100 molho (=1 lote => 40 maionese)
  const l = lanche('x', [[base, 50], [molho, 10]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]);
  assert.equal(porId(plano.producao, base).necessario, 540);
  assert.equal(porId(plano.producao, base).lotes, 2); // 540/300 => 2 lotes (e não 2 + 1 separados)
  assert.equal(porId(plano.compras, ov).comprar, 200);
});

test('ordem de produção: sub-receita vem antes de quem a usa', () => {
  const { db, item, receita, lanche } = cenario();
  const ov = item('ovo', 'insumo');
  const base = item('maionese', 'preparo');
  const molho = item('molho', 'preparo');
  receita(base, 300, [[ov, 100]]);
  receita(molho, 100, [[base, 40]]);
  const l = lanche('x', [[molho, 10]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]);
  const ordem = plano.producao.map((p) => p.itemId);
  assert.ok(ordem.indexOf(base) < ordem.indexOf(molho));
});

test('aproveitamento do insumo aumenta o que se compra', () => {
  const { db, item, lanche, estoque } = cenario();
  const rep = item('repolho', 'insumo', 'g', { aprov: 0.8 });
  estoque(rep, 30);
  const l = lanche('x', [[rep, 8]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 10 }]); // 80 usáveis => 100 brutos - 30 = 70
  const c = porId(plano.compras, rep);
  assert.equal(c.bruto, 100);
  assert.equal(c.comprar, 70);
});

test('preparo sem receita vira produção manual e torna o plano inviável', () => {
  const { db, item, lanche } = cenario();
  const p = item('torta', 'preparo', 'un');
  const l = lanche('x', [[p, 1]]);
  const plano = planoDasMetas(carregarModelo(db), [{ lancheId: l, qtd: 5 }]);
  assert.equal(plano.semReceita.length, 1);
  assert.equal(plano.semReceita[0].falta, 5);
  assert.equal(plano.viavel, false);
});

test('detecta ciclo entre receitas', () => {
  const { db, item, receita } = cenario();
  const a = item('a', 'preparo');
  const b = item('b', 'preparo');
  receita(a, 100, [[b, 10]]);
  receita(b, 100, [[a, 10]]);
  assert.throws(() => ordenarTopologico(carregarModelo(db)), ErroDeModelo);
});

test('capacidade: quantos lanches dá para fazer com o estoque de insumos e de prontos', () => {
  const { db, item, receita, lanche, estoque } = cenario();
  const a = item('farinha', 'insumo');
  const p = item('pasta', 'preparo');
  receita(p, 100, [[a, 50]]);
  estoque(a, 1000); // dá para 20 lotes de pasta = 2000 g
  const l = lanche('x', [[p, 100]]); // 100 g de pasta por lanche
  const [cap] = capacidade(carregarModelo(db));
  assert.equal(cap.possivel, 20);
  assert.equal(cap.prontos, 0); // nenhuma pasta pronta ainda
  estoque(p, 250);
  const [cap2] = capacidade(carregarModelo(db));
  assert.equal(cap2.prontos, 2);
  assert.equal(cap2.possivel, 22); // 250 g prontos + 2000 g produzíveis = 2250 => 22 lanches
  assert.ok(l > 0);
});

test('meta zero não gera demanda', () => {
  const { db, item, lanche } = cenario();
  const a = item('farinha', 'insumo');
  const l = lanche('x', [[a, 10]]);
  const m = carregarModelo(db);
  assert.equal(demandaDasMetas(m, [{ lancheId: l, qtd: 0 }]).size, 0);
  assert.equal(calcularPlano(m, new Map()).compras.length, 0);
});

// ── Dados dos documentos ────────────────────────────────────────────────
test('seed dos documentos: carrega, não tem ciclo e rendimentos fecham com os ingredientes', () => {
  const db = abrirBanco(':memory:');
  const r = carregarSeed(db);
  assert.equal(r.carregado, true);
  assert.equal(r.receitas, 32);
  const modelo = carregarModelo(db);
  assert.doesNotThrow(() => ordenarTopologico(modelo));
  const { receitas } = auditar(modelo);
  const problemas = receitas.filter((x) => x.notas.some((n) => n.includes('maior que a soma') || n.includes('sem ingredientes')));
  assert.deepEqual(problemas.map((x) => x.nome), []);
});

test('seed dos documentos: Pernil desfiado = 93 porções de 80 g e Bacon frito = 5.750 g', () => {
  const db = abrirBanco(':memory:');
  carregarSeed(db);
  const q = (slug) => db.prepare('SELECT i.porcao_qtd, r.rendimento_qtd FROM itens i JOIN receitas r ON r.item_id = i.id WHERE i.slug = ?').get(slug);
  assert.equal(q('pernil-desfiado').rendimento_qtd / q('pernil-desfiado').porcao_qtd, 93);
  assert.equal(q('bacon-frito').rendimento_qtd, 5750);
  assert.equal(Math.round(q('bacon-frito').rendimento_qtd / q('bacon-frito').porcao_qtd), 383);
});

test('seed dos documentos: carregar duas vezes não duplica', () => {
  const db = abrirBanco(':memory:');
  carregarSeed(db);
  assert.equal(carregarSeed(db).carregado, false);
});
