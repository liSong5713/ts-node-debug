const fs = require('fs')
const getCompiledPath = require('./get-compiled-path').getCompiledPath
const minimist = require('minimist')
const sep = require('path').sep
const path = require('path')
const extname = require('path').extname
const execSync = require('child_process').execSync
const Module = require('module')

const opts = minimist(process.argv.slice(2))
const {
  allowJs = false,
  preferTs = false,
  execCheck = false,
  compiledDir = '',
  readyFile = '',
} = opts

const timeThreshold = 0 //  limit for compile single .ts file
const ignore = [/node_modules/]
const sourceMapSupportPath = path.join(
  path.resolve('./node_modules/source-map-support'),
  'source-map-support.js'
)

const checkFileScript = path.join(__dirname, 'check-file-exists.js')

const waitForFile = function (fileName: string) {
  const start = new Date().getTime()
  while (true) {
    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, 'utf-8')
    }
    const passed = new Date().getTime() - start
    if (timeThreshold && passed > timeThreshold) {
      throw new Error('Could not require ' + fileName)
    }
  }
}

const compile = (code: string, fileName: string) => {
  const compiledPath = getCompiledPath(code, fileName, compiledDir)
  try {
    // send master process to complier
    process.send({
      compile: fileName,
      compiledPath: compiledPath,
    })
  } catch (e) {
    console.error('Error while sending compile request via process.send')
  }
  //  get ts-node compiled file
  const compiled = waitForFile(compiledPath)
  return compiled
}

function registerExtensions(extensions: string[]) {
  extensions.forEach(function (ext) {
    const old = require.extensions[ext] || require.extensions['.js']
    require.extensions[ext] = function (m: any, fileName) {
      const _compile = m._compile
      m._compile = function (code: string, fileName: string) {
        return _compile.call(this, compile(code, fileName), fileName)
      }
      return old(m, fileName)
    }
  })
  if (preferTs) {
    const reorderRequireExtension = (ext: string) => {
      const old = require.extensions[ext]
      delete require.extensions[ext]
      require.extensions[ext] = old
    }
    const order = ['.ts', '.tsx'].concat(
      Object.keys(require.extensions).filter((_) => _ !== '.ts' && _ !== '.tsx')
    )
    order.forEach(function (ext) {
      reorderRequireExtension(ext)
    })
  }
}

function isFileInNodeModules(fileName: string) {
  return fileName.indexOf(sep + 'node_modules' + sep) >= 0
}

function registerJsExtension() {
  const old = require.extensions['.js']
  // handling preferTs probably redundant after reordering
  if (allowJs) {
    require.extensions['.jsx'] = require.extensions['.js'] = function (
      m: any,
      fileName
    ) {
      if (fileName.indexOf(__dirname) === 0) {
        return old(m, fileName)
      }
      const tsCode: string | undefined = undefined
      const tsFileName = ''
      const _compile = m._compile
      const isIgnored =
        ignore &&
        ignore.reduce(function (res, ignore) {
          return res || ignore.test(fileName)
        }, false)
      const ext = extname(fileName)
      if (tsCode !== undefined || (allowJs && !isIgnored && ext == '.js')) {
        m._compile = function (code: string, fileName: string) {
          if (tsCode !== undefined) {
            code = tsCode
            fileName = tsFileName
          }
          return _compile.call(this, compile(code, fileName), fileName)
        }
      }

      return old(m, fileName)
    }
  }
}

const sourceMapRequire = Module.createRequire
  ? Module.createRequire(sourceMapSupportPath)
  : require

sourceMapRequire(sourceMapSupportPath).install({
  hookRequire: true,
})

registerJsExtension()
registerExtensions(['.ts', '.tsx'])

// 是否需要等待编译
if (readyFile) {
  const time = new Date().getTime()
  while (!fs.existsSync(readyFile)) {
    if (new Date().getTime() - time > 5000) {
      throw new Error('Waiting ts-node-dev ready file failed')
    }
  }
}

process.on('SIGTERM', function () {
  console.log('Child got SIGTERM, exiting.')
  process.exit()
})

module.exports.registerExtensions = registerExtensions
