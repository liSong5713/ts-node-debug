import { Options } from './bin'
import fs from 'fs'
import { getCompiledPath, getTSConfig } from './utils/helper'
import path from 'path'
import minimist from 'minimist'
import Module from 'module'
import { getTmpDir } from './utils/helper'
import Compiler from './compiler'

const opts = minimist(process.argv.slice(2))
const options = JSON.parse(opts.options) as Options
const compiledDir = getTmpDir(options['cache-directory'])
const tsNodeConfig = getTSConfig(options.project)
const complier = new Compiler(tsNodeConfig)

// compile and cache result
function compileAndCache(code: string, fileName: string): string {
  const compilePath = getCompiledPath(code, fileName, compiledDir)
  if (fs.existsSync(compilePath)) {
    const content = fs.readFileSync(compilePath, 'utf-8')
    if (content) return content
  }
  const result = complier.compile(code, fileName)
  fs.writeFile(compilePath, result, (err) => {
    if (err) {
      console.warn('write file fail:', compilePath)
      console.error(err)
    }
  })
  return result
}
// ts loader define
function registerExtensions(extensions: string[]) {
  extensions.forEach(function (ext) {
    const old = require.extensions[ext] || require.extensions['.js']
    require.extensions[ext] = function (m: any, fileName) {
      const _compile = m._compile
      m._compile = function (code: string, fileName: string) {
        const result = compileAndCache(code, fileName)
        return _compile.call(this, result, fileName)
      }
      return old(m, fileName)
    }
  })

  if (options['prefer-ts']) {
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

function sourceMapSupport() {
  const sourceMapSupportPath = path.join(
    path.resolve('./node_modules/source-map-support'),
    'source-map-support.js'
  )
  const sourceMapRequire = Module.createRequire
    ? Module.createRequire(sourceMapSupportPath)
    : require

  sourceMapRequire(sourceMapSupportPath).install({
    hookRequire: true,
  })
}

registerExtensions(['.ts', '.tsx'])
sourceMapSupport()

process.on('SIGTERM', function () {
  console.log('Child got SIGTERM, exiting.')
  process.exit()
})

module.exports.registerExtensions = registerExtensions
