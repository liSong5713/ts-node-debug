import http from 'http'

const server = http.createServer((req, res) => {
  res.end('hello world3')
})
server.listen(3000, () => {
  console.log('server start~')
})
