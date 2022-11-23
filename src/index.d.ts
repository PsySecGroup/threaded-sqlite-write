export interface KeyPair<T = any> {
  [key: string]: T;
}

export interface Message {
  type?: 'connect' | 'collection',
  path?: string
  transactions?: string
  sql?: string
  data?: any[]
}

export interface Db {
  name: string
  open: boolean
  inTransaction: boolean
  readonly: boolean
  memory: boolean
}

export interface Job {
  message: Message
  resolve: (value: Db | PromiseLike<Db>) => void
  reject: (Error) => void
}

export interface iWorker {
  takeWork: () => void
  shutdown: () => void
}
