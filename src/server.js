import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco } from './db.js';
import { carregarSeed } from './seed.js';
import { criarApi } from './api.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const PUBLICO = resolve(aqui, '../public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const LIMITE_CORPO = 1_000_000;

export function criarServidor(db) {
  const api = criarApi(db);

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        let corpo = {};
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          const partes = [];
          let total = 0;
          for await (const p of req) {
            total += p.length;
            if (total > LIMITE_CORPO) throw Object.assign(new Error('Corpo grande demais'), { status: 413 });
            partes.push(p);
          }
          const bruto = Buffer.concat(partes).toString('utf8');
          try {
            corpo = bruto ? JSON.parse(bruto) : {};
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ erro: 'JSON inválido.' }));
          }
        }
        const r = api(req.method, url.pathname, corpo);
        if (r.csv !== undefined) {
          res.writeHead(r.status, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.nome}"` });
          return res.end('﻿' + r.csv);
        }
        res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(r.corpo));
      }

      // Arquivos estáticos (impede sair da pasta public/)
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (!rel) rel = 'index.html';
      const arquivo = join(PUBLICO, rel);
      if (!arquivo.startsWith(PUBLICO)) {
        res.writeHead(403);
        return res.end('Acesso negado');
      }
      const dados = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dados);
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Não encontrado');
      }
      res.writeHead(e.status ?? 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(e.status ? e.message : 'Erro interno');
      if (!e.status) console.error(e);
    }
  });
}

// Executado direto (npm start): abre o banco, carrega os dados se estiver vazio e sobe o servidor.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.PORT || 3000);
  const db = abrirBanco();
  const r = carregarSeed(db);
  if (r.carregado) console.log(`Primeira execução: ${r.insumos} insumos, ${r.preparos} preparos e ${r.receitas} receitas carregados.`);
  const host = process.env.HOST || '0.0.0.0';
  criarServidor(db).listen(porta, host, () => {
    console.log(`Foqui Tech rodando em http://${host === '0.0.0.0' ? 'localhost' : host}:${porta}`);
  });
}
