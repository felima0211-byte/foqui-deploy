// Cria o banco (data/foqui.db) e carrega os dados dos documentos.
//   npm run setup   -> cria se não existir
//   npm run reset   -> apaga o banco e recria do zero
import { existsSync, rmSync } from 'node:fs';
import { abrirBanco, CAMINHO_PADRAO } from '../src/db.js';
import { carregarSeed } from '../src/seed.js';

const caminho = process.env.FOQUI_DB || CAMINHO_PADRAO;
if (process.argv.includes('--reset')) {
  for (const sufixo of ['', '-wal', '-shm']) if (existsSync(caminho + sufixo)) rmSync(caminho + sufixo);
  console.log('Banco anterior apagado.');
}

const db = abrirBanco(caminho);
const r = carregarSeed(db);
if (r.carregado) {
  console.log(`Banco criado em ${caminho}`);
  console.log(`  ${r.insumos} insumos, ${r.preparos} preparos, ${r.receitas} receitas, ${r.medidas} medidas, ${r.lanches} lanches (com as vendas de agosto).`);
  console.log('Próximo passo: npm start  (e abra http://localhost:3000)');
} else {
  console.log(r.motivo);
}
db.close();
