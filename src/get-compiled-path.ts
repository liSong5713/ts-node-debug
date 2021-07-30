import crypto from 'crypto'
import path from 'path'

export const getCompiledPath = (
  code: string,
  fileName: string,
  compiledDir: string
) => {
  const hash = crypto
    .createHash('MD5')
    .update(fileName + code, 'utf8')
    .digest('hex')
  // const hashed = fileName.replace(/[^\w]/g, '_') + '_' + hash + '.js'
  return path.join(compiledDir, hash.concat('.js'))
}
