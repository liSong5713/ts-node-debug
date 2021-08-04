import fs from 'fs'
import os from 'os'
import stripJsonComments from 'strip-json-comments'
import mkdirp from 'mkdirp'
import crypto from 'crypto'
import path from 'path'
import { resolveSync } from 'tsconfig'
import { CreateOptions } from 'ts-node'

export function getTmpDir(dir: string) {
  return dir
    ? path.resolve(dir)
    : path.join(os.tmpdir(), '.ts-node', md5(process.cwd()))
}

export function createCompiledDir(dir: string) {
  const compiledDir = getTmpDir(dir)
  if (!fs.existsSync(compiledDir)) {
    mkdirp.sync(compiledDir)
  }
}

export function getTSConfig(project: string) {
  return JSON.parse(
    stripJsonComments(fs.readFileSync(getTSConfigPath(project), 'utf-8'))
  )['ts-node'] as CreateOptions
}

export function getTSConfigPath(project: string) {
  return resolveSync(process.cwd(), project || 'tsconfig.json') || ''
}

export const getCompiledPath = (
  code: string,
  fileName: string,
  compiledDir: string
) => {
  const hash = md5(fileName + code)
  return path.join(compiledDir, hash.concat('.js'))
}

function md5(str: string) {
  return crypto.createHash('MD5').update(str, 'utf8').digest('hex')
}
