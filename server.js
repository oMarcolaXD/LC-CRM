'use strict'

// Redireciona stderr para stdout para aparecer nos logs da Hostinger
process.stderr.write = process.stdout.write.bind(process.stdout)

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)

process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===')
  console.error(err.message)
  console.error(err.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('=== UNHANDLED REJECTION ===')
  console.error(reason)
  process.exit(1)
})

console.log(`Iniciando servidor na porta ${port}...`)

const app = next({ dev: false })
const handle = app.getRequestHandler()

app.prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true)
      handle(req, res, parsedUrl)
    }).listen(port, (err) => {
      if (err) {
        console.error('=== ERRO AO INICIAR SERVIDOR ===')
        console.error(err)
        process.exit(1)
      }
      console.log(`> Servidor pronto em http://localhost:${port}`)
    })
  })
  .catch((err) => {
    console.error('=== ERRO AO PREPARAR APP ===')
    console.error(err.message)
    console.error(err.stack)
    process.exit(1)
  })
