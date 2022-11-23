import { parentPort } from 'worker_threads'
import { getDb } from '.'

let db
let transactionFactory

parentPort.on('message', (command) => {
  const { type } = command

  if (type === 'connect') {
    // Initial connection
    const { transactions, path } = command

    db = getDb(path)
    db.exec('PRAGMA journal_mode = OFF;')
    db.exec('PRAGMA synchronous = 0;')
    db.exec('PRAGMA cache_size = 1000000;')
    db.exec('PRAGMA locking_mode = EXCLUSIVE')
    db.exec('PRAGMA temp_store = MEMORY;')

    transactionFactory = new Function(`return ${transactions}`)()

  } else if (type === 'collection') {
    // Dealing with transactions
    const { data } = command
    db.exec(`BEGIN TRANSACTION;${transactionFactory(data)}COMMIT;`)
    parentPort.postMessage(true)

  } else {
    // Arbitrary sql
    const { sql } = command
    parentPort.postMessage(db.exec(sql))
  }
})
