// Mostra, no terminal, onde os números das receitas merecem conferência.
import { abrirBanco } from '../src/db.js';
import { carregarModelo, auditar } from '../src/engine.js';

const db = abrirBanco();
const { receitas, semReceita } = auditar(carregarModelo(db));
const fmt = (n) => (n == null ? '—' : Math.round(n * 10) / 10);

console.log('\nRECEITAS (rendimento x soma dos ingredientes)\n');
console.log('Preparo'.padEnd(42), 'Rend.'.padStart(8), 'Soma ing.'.padStart(10), 'Aprov.'.padStart(8), 'Porções'.padStart(8));
for (const r of receitas) {
  const aprov = r.aproveitamentoDoLote == null ? '—' : Math.round(r.aproveitamentoDoLote * 100) + '%';
  console.log(r.nome.slice(0, 41).padEnd(42), String(fmt(r.rendimento)).padStart(8), String(fmt(r.somaIngredientes)).padStart(10), aprov.padStart(8), String(fmt(r.porcoesPorLote)).padStart(8));
  for (const n of r.notas) console.log('   ! ' + n);
}

console.log(`\nPREPAROS SEM RECEITA (${semReceita.length})\n`);
for (const s of semReceita) console.log(`- ${s.nome}${s.avisos ? ': ' + s.avisos : ''}`);
console.log('');
db.close();
