import { fork, ChildProcess } from 'child_process'
import chokidar from 'chokidar'
import glob from 'glob'
import path from 'path'

const kill = require('tree-kill')

import * as ipc from './utils/ipc'
import { Options } from './bin'
import { makeCfg } from './utils/cfg'
import { makeNotify } from './utils/notify'
import { makeLog } from './utils/log'
import { createCompiledDir } from './utils/helper'

export const runDev = (
  script: string,
  scriptArgs: string[],
  nodeArgs: string[],
  opts: Options
) => {
  if (typeof script !== 'string' || script.length === 0) {
    throw new TypeError('`script` must be a string')
  }

  if (!Array.isArray(scriptArgs)) {
    throw new TypeError('`scriptArgs` must be an array')
  }

  if (!Array.isArray(nodeArgs)) {
    throw new TypeError('`nodeArgs` must be an array')
  }

  // The child_process
  let child:
    | (ChildProcess & {
        stopping?: boolean
        respawn?: boolean
      })
    | undefined

  const wrapper = glob.sync(path.join(__dirname, 'child-wrap.{js,ts}'))[0]
  const main = glob.sync(path.resolve(script))[0]
  const cfg = makeCfg(main, opts)
  const log = makeLog(cfg)
  const notify = makeNotify(cfg, log)
  function initWatcher() {

    const watcher = chokidar.watch([], {
      usePolling: opts.poll,
      interval: parseInt(opts.interval) || undefined,
    })
    watcher.on('change', restart)

    watcher.on('fallback', function (limit) {
      log.warn(
        'node-dev ran out of file handles after watching %s files.',
        limit
      )
      log.warn('Falling back to polling which uses more CPU.')
      log.info('Run ulimit -n 10000 to increase the file descriptor limit.')
      if (cfg.deps) log.info('... or add `--no-deps` to use less file handles.')
    })
    if (!opts.watched) {
      watcher.close()
    }
    return watcher
  }
  let watcher = initWatcher()

  let starting = false

  function start() {
    createCompiledDir(opts['cache-directory'])
    if (cfg.clear) process.stdout.write('\u001bc')
    for (const watched of (opts.watch || '').split(',')) {
      if (watched) watcher.add(watched)
    }

    let cmd = nodeArgs.concat(
      wrapper,
      script,
      scriptArgs,
      `--options=${JSON.stringify(opts)}`
    )
    const childHookPath = glob.sync(
      path.join(__dirname, 'child-compiler.{js,ts}')
    )[0]

    cmd = (opts.priorNodeArgs || []).concat(['-r', childHookPath]).concat(cmd)

    log.debug('Starting child process %s', cmd.join(' '))

    child = fork(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: process.env,
    })

    starting = false

    child.on('message', function (message) {
      //  TODO
    })

    child.on('exit', function (code) {
      log.debug('Child exited with code %s', code)
      if (!child) return
      if (!child.respawn) process.exit(code || 0)
      child = undefined
    })

    if (cfg.respawn) {
      child.respawn = true
    }

    // Listen for `required` messages and watch the required file.
    ipc.on(child, 'required', function (m: ipc.IPCMessage) {
      const required = m.required!
      const isIgnored =
        cfg.ignore.some(isPrefixOf(required)) ||
        cfg.ignore.some(isRegExpMatch(required))

      if (!isIgnored && (cfg.deps === -1 || getLevel(required) <= cfg.deps)) {
        log.debug(required, 'added to watcher')
        watcher.add(required)
      }
    })

    // Upon errors, display a notification and tell the child to exit.
    ipc.on(child, 'error', function (m: ipc.IPCMessage) {
      log.debug('Child error')
      notify(m.error!, m.message!, 'error')
      stop(m.willTerminate)
    })
  }
  const killChild = () => {
    if (!child) return
    log.debug('Sending SIGTERM kill to child pid', child.pid)
    if (opts['tree-kill']) {
      log.debug('Using tree-kill')
      kill(child.pid)
    } else {
      child.kill('SIGTERM')
    }
  }
  function stop(willTerminate?: boolean) {
    if (!child || child.stopping) {
      return
    }
    child.stopping = true
    child.respawn = true
    if (child.connected === undefined || child.connected === true) {
      log.debug('Disconnecting from child')
      child.disconnect()
      if (!willTerminate) {
        killChild()
      }
    }
  }

  function restart(file: string, isManualRestart?: boolean) {
    notify('Restarting', file + ' has been modified')

    if (starting) {
      log.debug('Already starting')
      return
    }
    log.debug('Removing all watchers from files')

    watcher.close()
    watcher = initWatcher()
    starting = true
    if (child) {
      log.debug('Child is still running, restart upon exit')
      child.on('exit', start)
      stop()
    } else {
      log.debug('Child is already stopped, probably due to a previous error')
      start()
    }
  }

  //  kill child process
  process.on('SIGTERM', function () {
    log.debug('Process got SIGTERM')
    killChild()
    process.exit(0)
  })

  process.on('SIGINT', function () {
    log.debug('Process got SIGINT')
    killChild()
    process.exit(0)
  })

  start()
}

/**
 * Returns the nesting-level of the given module.
 * Will return 0 for modules from the main package or linked modules,
 * a positive integer otherwise.
 */
function getLevel(mod: string) {
  const p = getPrefix(mod)
  return p.split('node_modules').length - 1
}

/**
 * Returns the path up to the last occurence of `node_modules` or an
 * empty string if the path does not contain a node_modules dir.
 */
function getPrefix(mod: string) {
  const n = 'node_modules'
  const i = mod.lastIndexOf(n)
  return ~i ? mod.slice(0, i + n.length) : ''
}

function isPrefixOf(value: string) {
  return function (prefix: string) {
    return value.indexOf(prefix) === 0
  }
}

function isRegExpMatch(value: string) {
  return function (regExp: string) {
    return new RegExp(regExp).test(value)
  }
}
