// Gateway mínimo (só para testes locais) no formato do Supabase: /rest/v1 -> PostgREST, /auth/v1 -> GoTrue, /storage/v1 -> Storage (com CORS, como o Kong)
import http from 'node:http'
const rotas = [['/rest/v1', 3001], ['/auth/v1', 9999], ['/storage/v1', 5000]]
const cors = (req) => ({
  'access-control-allow-origin': req.headers.origin || '*',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
  'access-control-expose-headers': 'content-range, x-supabase-api-version',
})
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); return res.end() }
  const r = rotas.find(([p]) => req.url.startsWith(p))
  if (!r) { res.writeHead(404); return res.end() }
  const headers = { ...req.headers, host: '127.0.0.1:' + r[1] }
  delete headers.origin
  const p = http.request({ host: '127.0.0.1', port: r[1], path: req.url.slice(r[0].length) || '/', method: req.method, headers }, (up) => {
    const h = { ...up.headers }
    for (const k of Object.keys(h)) if (k.startsWith('access-control-')) delete h[k]
    res.writeHead(up.statusCode, { ...h, ...cors(req) }); up.pipe(res)
  })
  p.on('error', (e) => { res.writeHead(502); res.end(String(e)) })
  req.pipe(p)
}).listen(54321, '127.0.0.1')
