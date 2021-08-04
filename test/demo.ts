import http from 'http'

const h = require('./hi')

const server = http.createServer((req, res) => {
  console.log(h.a)
  res.end('hello world3')
})
server.listen(3000, () => {
  console.log('server start~')
})
