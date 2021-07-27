import * as tsNode from 'ts-node'
import fs from 'fs'
import path from 'path'
import os from 'os'
import mkdirp from 'mkdirp'
import { resolveSync } from 'tsconfig'
import { Options } from './bin'
import { getCompiledPath } from './get-compiled-path'
import { Log } from './log'
import { getCwd } from './get-cwd'

const compileExtensions = ['.ts', '.tsx']
const cwd = process.cwd()
const compilationInstanceStamp = Math.random().toString().slice(2)
const originalJsHandler = require.extensions['.js']

export type CompileParams = {
  code?: string
  compile: string
  compiledPath: string
}

export const makeCompiler = (
  options: Options,
  {
    log,
    restart,
  }: {
    log: Log
    restart: (fileName: string) => void
  }
) => {
  let _errorCompileTimeout: ReturnType<typeof setTimeout>
  let allowJs = false

  const project = options['project']
  const tsConfigPath =
    resolveSync(cwd, typeof project === 'string' ? project : undefined) || ''

  const compiledPathsHash: Record<string, true> = {}

  const tmpDir = options['cache-directory']
    ? path.resolve(options['cache-directory'])
    : fs.mkdtempSync(path.join(os.tmpdir(), '.ts-node'))

  const getHookChildArgs = (options: Options) => {
    return [
      allowJs && '--allowJs',
      options['exec-check'] && '--execCheck',
      options['prefer-ts-exts'] && '--preferTs',
      `--compilationId=${getCompilationId()}`,
      `--compiledDir=${getCompiledDir()}`,
      `--readyFile=${getCompilerReadyFilePath()}`,
    ].filter((item) => item)
  }

  const init = () => {
    registerTsNode()

    /* clean up compiled on each new init*/
    // rimraf.sync(getCompiledDir())
    createCompiledDir()

    // check if `allowJs` compiler option enable
    // (.js handler was changed while ts-node registration)
    allowJs = require.extensions['.js'] !== originalJsHandler
    if (allowJs) {
      compileExtensions.push('.js', '.jsx')
    }
  }

  const getCompilationId = () => {
    return compilationInstanceStamp
  }
  const createCompiledDir = () => {
    const compiledDir = getCompiledDir()
    if (!fs.existsSync(compiledDir)) {
      mkdirp.sync(getCompiledDir())
    }
  }
  const getCompiledDir = () => {
    return path.join(tmpDir, 'compiled').replace(/\\/g, '/')
  }
  const getCompileReqFilePath = () => {
    return path.join(getCompiledDir(), getCompilationId() + '.req')
  }
  const getCompilerReadyFilePath = () => {
    return path
      .join(os.tmpdir(), 'ts-node-dev-ready-' + compilationInstanceStamp)
      .replace(/\\/g, '/')
  }

  const getChildHookPath = () => {
    return path
      .join(os.tmpdir(), 'ts-node-dev-hook-' + compilationInstanceStamp + '.js')
      .replace(/\\/g, '/')
  }
  const writeReadyFile = () => {
    fs.writeFileSync(getCompilerReadyFilePath(), '')
  }

  const clearErrorCompile = () => {
    clearTimeout(_errorCompileTimeout)
  }
  const registerTsNode = () => {
    Object.keys(compiledPathsHash).forEach((key) => {
      delete compiledPathsHash[key]
    })
    // revert back original handler extensions
    // in case of re-registering
    ;['.js', '.jsx', '.ts', '.tsx'].forEach(function (ext) {
      require.extensions[ext] = originalJsHandler
    })

    const scriptPath = options._.length
      ? path.resolve(cwd, options._[0])
      : undefined

    const DEFAULTS = tsNode.DEFAULTS

    tsNode.register({
      // --dir does not work (it gives a boolean only) so we only check for script-mode
      dir: getCwd(options['dir'], options['script-mode'], scriptPath),
      scope: options['scope'] || DEFAULTS.scope,
      emit: options['emit'] || DEFAULTS.emit,
      files: options['files'] || DEFAULTS.files,
      pretty: options['pretty'] || DEFAULTS.pretty,
      transpileOnly: options['transpile-only'] || DEFAULTS.transpileOnly,
      ignore: options['ignore']
        ? tsNode.split(options['ignore'])
        : DEFAULTS.ignore,
      preferTsExts: options['prefer-ts-exts'] || DEFAULTS.preferTsExts,
      logError: options['log-error'] || DEFAULTS.logError,
      project: options['project'],
      skipProject: options['skip-project'],
      skipIgnore: options['skip-ignore'],
      compiler: options['compiler'] || DEFAULTS.compiler,
      compilerHost: options['compiler-host'] || DEFAULTS.compilerHost,
      ignoreDiagnostics: options['ignore-diagnostics']
        ? tsNode.split(options['ignore-diagnostics'])
        : DEFAULTS.ignoreDiagnostics,
      compilerOptions: tsNode.parse(options['compiler-options']),
    })
  }

  const compiler = {
    tsConfigPath,
    init,
    getCompileReqFilePath,
    getChildHookPath,
    getHookChildArgs,
    writeReadyFile,
    clearErrorCompile,
    compileChanged: function (fileName: string) {
      const ext = path.extname(fileName)
      if (compileExtensions.indexOf(ext) < 0) return
      try {
        const code = fs.readFileSync(fileName, 'utf-8')
        compiler.compile({
          code: code,
          compile: fileName,
          compiledPath: getCompiledPath(code, fileName, getCompiledDir()),
        })
      } catch (e) {
        console.error(e)
      }
    },
    compile: function (params: CompileParams) {
      const fileName = params.compile
      // const code = fs.readFileSync(fileName, 'utf-8')
      const compiledPath = params.compiledPath

      // Prevent occasional duplicate compilation requests
      if (compiledPathsHash[compiledPath]) {
        return
      }
      compiledPathsHash[compiledPath] = true

      function writeCompiled(code: string, fileName?: string) {
        fs.writeFile(compiledPath, code, (err) => {
          err && log.error(err)
          // TODO 优化
          fs.writeFile(compiledPath + '.done', '', (err) => {
            err && log.error(err)
          })
        })
      }
      if (fs.existsSync(compiledPath)) {
        return
      }
      const starTime = new Date().getTime()
      const m: any = {
        _compile: writeCompiled,
      }
      const _compile = () => {
        const ext = path.extname(fileName)
        const extHandler = require.extensions[ext]!

        extHandler(m, fileName)

        log.debug(
          fileName,
          'compiled in',
          new Date().getTime() - starTime,
          'ms'
        )
      }
      try {
        _compile()
      } catch (e) {
        console.error('Compilation error in', fileName)
        const errorCode =
          'throw ' + 'new Error(' + JSON.stringify(e.message) + ')' + ';'
        writeCompiled(errorCode)

        // reinitialize ts-node compilation to clean up state after error
        // without timeout in causes cases error not be printed out
        setTimeout(() => {
          registerTsNode()
        }, 0)

        if (!options['error-recompile']) {
          return
        }
        const timeoutMs =
          parseInt(process.env.TS_NODE_DEV_ERROR_RECOMPILE_TIMEOUT || '0') ||
          5000
        const errorHandler = () => {
          clearTimeout(_errorCompileTimeout)
          _errorCompileTimeout = setTimeout(() => {
            try {
              _compile()
              restart(fileName)
            } catch (e) {
              registerTsNode()
              errorHandler()
            }
          }, timeoutMs)
        }

        errorHandler()
      }
    },
  }

  return compiler
}