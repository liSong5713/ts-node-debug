import { Service, create, CreateOptions } from 'ts-node'

export default class Compiler {
  engine: Service
  constructor(options: CreateOptions) {
    this.engine = create(options)
  }
  compile(code: string, fileName: string) {
    return this.engine.compile(code, fileName)
  }
}
