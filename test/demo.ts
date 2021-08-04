import http from 'http'
const test  = require('./test')

const h = require('./hi')

const server = http.createServer((req, res) => {
<<<<<<< HEAD
  console.log(h.a)
  res.end('hello world3')
=======
  console.log(test.value)
  res.end('hello world')
>>>>>>> develop
})
server.listen(3000, () => {
  console.log('server start~')
})
