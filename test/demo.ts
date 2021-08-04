import http from 'http'
const test  = require('./test')

const server = http.createServer((req, res) => {
  console.log(test.value)
  res.end('hello world')
})
server.listen(3000, () => {
  console.log('server start~')
})
