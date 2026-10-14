import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.js';
import { carregarSeed } from '../src/seed.js';
import { criarServidor } from '../src/server.js';

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
  return { chamar, porta: servidor.address().port, fechar: () => new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(ok); }), db };
}

test('fluxo completo: cadastrar lanche, definir meta, ver plano e lista de compras', async () => {
  const { chamar, fechar } = await subir();
  try {
    const itens = (await chamar('GET', '/api/itens')).corpo;
    const id = (nome) => itens.find((i) => i.nome === nome).id;

    const novo = await chamar('POST', '/api/lanches', { nome: 'Teste Pernil' });
    assert.equal(novo.status, 201);
    const lancheId = novo.corpo.id;

    const put = await chamar('PUT', `/api/lanches/${lancheId}`, {
      meta_qtd: 100,
      componentes: [
        { item_id: id('Pernil desfiado'), qtd: 80 },
        { item_id: id('Maionese de alho'), qtd: 50 },
      ],
    });
    assert.equal(put.status, 200);
    assert.equal(put.corpo.componentes.length, 2);

    const plano = (await chamar('GET', '/api/plano')).corpo;
    assert.equal(plano.totalLanches, 100);
    const pernil = plano.producao.find((p) => p.nome === 'Pernil desfiado');
    assert.equal(pernil.necessario, 8000);
    assert.equal(pernil.lotes, 2); // 8000 / 7440 => 2 lotes
    const maio = plano.producao.find((p) => p.nome === 'Maionese de alho');
    assert.equal(maio.necessario, 5000);
    assert.equal(maio.lotes, 4); // 5000 / 1550 => 4 lotes
    const ordem = plano.producao.map((p) => p.nome);
    assert.ok(ordem.indexOf('Alho batido') < ordem.indexOf('Pernil desfiado'), 'alho batido deve ser feito antes do pernil');

    const compras = (await chamar('GET', '/api/compras')).corpo;
    const suino = compras.comprar.find((c) => c.nome === 'Pernil suíno');
    assert.equal(suino.comprar, 40000); // 2 lotes x 20 kg

    // Dar entrada no estoque reduz a compra
    await chamar('POST', '/api/estoque/movimentos', { item_id: id('Pernil suíno'), tipo: 'entrada', qtd: 15000 });
    const depois = (await chamar('GET', '/api/compras')).corpo.comprar.find((c) => c.nome === 'Pernil suíno');
    assert.equal(depois.comprar, 25000);

    // Marcar como comprado
    await chamar('PUT', '/api/compras/checks', { item_id: id('Pernil suíno'), marcado: true });
    assert.equal((await chamar('GET', '/api/compras')).corpo.comprar.find((c) => c.nome === 'Pernil suíno').marcado, true);

    const csv = await chamar('GET', '/api/compras.csv');
    assert.equal(csv.status, 200);
    assert.ok(csv.corpo.includes('Pernil suíno'));
  } finally {
    await fechar();
  }
});

test('contagem de estoque ajusta até o valor contado', async () => {
  const { chamar, fechar } = await subir();
  try {
    const sal = (await chamar('GET', '/api/itens')).corpo.find((i) => i.nome === 'Sal');
    await chamar('POST', '/api/estoque/movimentos', { item_id: sal.id, tipo: 'entrada', qtd: 1000 });
    const r = await chamar('POST', '/api/estoque/movimentos', { item_id: sal.id, tipo: 'contagem', qtd: 400 });
    assert.equal(r.corpo.qtd, 400);
  } finally {
    await fechar();
  }
});

test('rejeita receita em ciclo e não grava nada', async () => {
  const { chamar, fechar } = await subir();
  try {
    const itens = (await chamar('GET', '/api/itens')).corpo;
    const id = (nome) => itens.find((i) => i.nome === nome).id;
    // Maionese de pesto usa Pesto batido; fazer o Pesto batido usar a Maionese de pesto fecha um ciclo.
    const antes = (await chamar('GET', `/api/receitas/${id('Pesto batido')}`)).corpo;
    const r = await chamar('PUT', `/api/receitas/${id('Pesto batido')}`, {
      rendimento_qtd: 1000,
      ingredientes: [{ item_id: id('Maionese de pesto'), qtd: 100 }],
    });
    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /ciclo/i);
    const depois = (await chamar('GET', `/api/receitas/${id('Pesto batido')}`)).corpo;
    assert.deepEqual(depois.ingredientes, antes.ingredientes);
  } finally {
    await fechar();
  }
});

test('validações: número inválido, item em uso, lanche duplicado', async () => {
  const { chamar, fechar } = await subir();
  try {
    const itens = (await chamar('GET', '/api/itens')).corpo;
    const sal = itens.find((i) => i.nome === 'Sal');
    const ruim = await chamar('POST', '/api/estoque/movimentos', { item_id: sal.id, tipo: 'entrada', qtd: 'abc' });
    assert.equal(ruim.status, 400);

    const emUso = await chamar('DELETE', `/api/itens/${sal.id}`);
    assert.equal(emUso.status, 409);

    assert.equal((await chamar('POST', '/api/lanches', { nome: 'Igual' })).status, 201);
    assert.equal((await chamar('POST', '/api/lanches', { nome: 'Igual' })).status, 409);
    assert.equal((await chamar('GET', '/api/nao-existe')).status, 404);
  } finally {
    await fechar();
  }
});

test('capacidade e auditoria respondem', async () => {
  const { chamar, fechar } = await subir();
  try {
    const aud = (await chamar('GET', '/api/auditoria')).corpo;
    assert.equal(aud.receitas.length, 32);
    assert.equal(aud.semReceita.length, 6);
    assert.equal((await chamar('GET', '/api/capacidade')).status, 200);
  } finally {
    await fechar();
  }
});

test('serve a página inicial e bloqueia caminhos fora de public/', async () => {
  const { fechar, porta } = await subir();
  try {
    const base = `http://127.0.0.1:${porta}`;
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Foqui Tech/);
    assert.equal((await fetch(base + '/app.js')).status, 200);
    assert.equal((await fetch(base + '/nao-existe.js')).status, 404);
    // fetch normaliza ".."; usamos uma requisição crua para testar de verdade
    const { request } = await import('node:http');
    const status = await new Promise((ok) => {
      const req = request({ host: '127.0.0.1', port: porta, path: '/..%2fpackage.json', method: 'GET' }, (res) => { res.resume(); ok(res.statusCode); });
      req.end();
    });
    assert.ok([403, 404].includes(status), `esperava 403/404, veio ${status}`);
  } finally {
    await fechar();
  }
});
