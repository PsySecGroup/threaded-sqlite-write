interface KeyPair<T = any> {
  [key: string]: T;
}

interface Message {
  type?: 'connect' | 'collection',
  path?: string
  transactions?: string
  sql?: string
  data?: any[]
}

interface Db {
  name: string
  open: boolean
  inTransaction: boolean
  readonly: boolean
  memory: boolean
}

interface Job {
  message: Message
  resolve: (value: Db | PromiseLike<Db>) => void
  reject: (Error) => void
}

interface iWorker {
  takeWork: () => void
  shutdown: () => void
}

export { Db, Job, KeyPair, Message, iWorker };
