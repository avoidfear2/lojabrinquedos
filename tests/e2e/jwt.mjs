import crypto from 'node:crypto'
const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const s = process.env.JWT_SECRET
for (const role of ['anon', 'service_role']) {
  const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ iss: 'supabase-demo', role, exp: 1983812996 })
  console.log(role + '=' + h + '.' + p + '.' + crypto.createHmac('sha256', s).update(h + '.' + p).digest('base64url'))
}
