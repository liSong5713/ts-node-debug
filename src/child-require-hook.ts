import fs from 'fs'
import { getCompiledPath } from './get-compiled-path'
const minimist = require('minimist')
const path = require('path')
const Module = require('module')
import * as tsNode from 'ts-node'
// TODO typeCheck
const tsCompiler = tsNode.create({ transpileOnly: true })

const opts = minimist(process.argv.slice(2))
const { allowJs = false, preferTs = false, compiledDir = '' } = opts

function compileAndCache(code: string, fileName: string): string {
  const compilePath = getCompiledPath(code, fileName, compiledDir)
  const result = tsCompiler.compile(code, fileName)
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
