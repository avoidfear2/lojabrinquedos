import net from 'node:net'
import fs from 'node:fs'
net.createServer((s) => {
  let data = false, buf = '', msg = ''
  s.write('220 local ESMTP\r\n')
  s.on('data', (d) => {
    buf += d.toString()
    let i
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2)
      if (data) {
        if (line === '.') { data = false; fs.appendFileSync(process.env.MAIL_LOG || 'mail.log', msg + '\n=====\n'); msg = ''; s.write('250 OK\r\n') }
        else msg += line + '\n'
        continue
      }
      const c = line.slice(0, 4).toUpperCase()
      if (c === 'EHLO') s.write('250-local\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n')
      else if (c === 'HELO') s.write('250 OK\r\n')
      else if (c === 'AUTH') s.write('235 OK\r\n')
      else if (c === 'DATA') { data = true; s.write('354 go\r\n') }
      else if (c === 'QUIT') { s.write('221 bye\r\n'); s.end() }
      else s.write('250 OK\r\n')
    }
  })
}).listen(2525, '127.0.0.1')
