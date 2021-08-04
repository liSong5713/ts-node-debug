#!/usr/bin/env node

import { runDev } from './index'
import minimist from 'minimist'

const nodeArgs: string[] = []
const unknown: string[] = []

const devArgs = process.argv.slice(2, 100)

const tsNodeFlags = {
  boolean: [
    'scope',
    'emit',
    'files',
    'pretty',
    'prefer-ts',
    'log-error',
    'skip-project',
    'skip-ignore',
    'script-mode',
  ],

  string: ['project'],
}

const tsNodeAlias = {
  compiler: 'C',
  'script-mode': 's',
}

type TSNodeOptions = {
  project: string
  compilerOptions: any
  'compiler-options': any
  'prefer-ts-exts': boolean
  ignore?: string
  dir: string
  'script-mode': boolean
  emit: boolean
  files: boolean
  'transpile-only': boolean
  pretty: boolean
  scope: boolean
  'log-error': boolean
  'skip-project': boolean
  'skip-ignore': boolean
  compiler: string
  'compiler-host': boolean
  'ignore-diagnostics': string
}

const devFlags = {
  boolean: [
    'deps',
    'all-deps',
    'dedupe',
    'fork',
    'exec-check',
    'debug',
    'poll',
    'respawn',
    'notify',
    'tree-kill',
    'clear',
    'cls',
    'exit-child',
    'error-recompile',
    'quiet',
    'rs',
    'watched',
  ],
  string: [
    'dir',
    'deps-level',
    'compile-timeout',
    'ignore-watch',
    'interval',
    'debounce',
    'watch',
    'cache-directory',
  ],
}

type DevOptions = {
  poll: boolean
  debug: boolean
  watch: string
  deps: boolean
  respawn: boolean
  notify: boolean
  clear: boolean
  cls: boolean
  watched: boolean
  'all-deps': boolean
  'deps-level': string
  'cache-directory': string
  quiet: boolean
  'tree-kill': boolean
}

export type Options = {
  priorNodeArgs: string[]
  _: string[]
} & DevOptions &
  TSNodeOptions

const opts = minimist(devArgs, {
  stopEarly: true,
  boolean: [...devFlags.boolean, ...tsNodeFlags.boolean],
  string: [...devFlags.string, ...tsNodeFlags.string],
  alias: {
    ...tsNodeAlias,
    'prefer-ts-exts': 'prefer-ts',
  },
  default: {
    fork: true,
    watched: true,
  },
  unknown: function (arg) {
    unknown.push(arg)
    return true
  },
}) as Options

const script = opts._[0]
const scriptArgs = opts._.slice(1)

opts.priorNodeArgs = []

unknown.forEach(function (arg) {
  if (arg === script || nodeArgs.indexOf(arg) >= 0) return

  const argName = arg.replace(/^-+/, '')
  // fix this
  const argOpts = (opts as any)[argName]
  const argValues = Array.isArray(argOpts) ? argOpts : [argOpts]
  argValues.forEach(function (argValue) {
    if ((arg === '-r' || arg === '--require') && argValue === 'esm') {
      opts.priorNodeArgs.push(arg, argValue)
      return false
    }
    nodeArgs.push(arg)
    if (typeof argValue === 'string') {
      nodeArgs.push(argValue)
    }
  })
})

if (!script) {
  // eslint-disable-next-line no-console
  console.log('ts-node-dev: no script to run provided')
  // eslint-disable-next-line no-console
  console.log('Usage: ts-node-dev [options] script [arguments]\n')
  process.exit(1)
}

runDev(script, scriptArgs, nodeArgs, opts)
