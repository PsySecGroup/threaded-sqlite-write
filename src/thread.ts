import type { Message, Job, iWorker, Db } from './index.d'
import * as os from 'os'
import { Worker } from 'worker_threads'
import { ensureDirSync } from 'fs-extra'
import { exec } from './shell'

const queue: Job[] = []
const cpus = os.cpus()
export const workerCount = cpus.length
const createTableRegex = /CREATE TABLE IF NOT EXISTS ([^\s]+) \(/
const createTableCacheRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s*(\w+)\s*\(([\s\S]*?)\)/i
const fieldRegex = /(\w+)\s+(\w+)/ig

const workerFunction = `const { parentPort } = require('worker_threads')
const SqliteDatabaseConnection = require('better-sqlite3')

let db
let transactionFactory
let typeCache
let typeCacheKeys
let typeCacheInsert
const escapeRegex = /'/g

function defaultRowParser (data) {
  let result = ''

  for (const item of data) {
    let query = 'INSERT INTO ' + typeCache.tableName + ' (' + typeCacheInsert + ') VALUES ('
    let index = 0

    for(const key of typeCacheKeys) {
      switch (typeCache.fields[key]) {
        case 'TEXT':
        case 'VARCHAR':
        case 'CHAR':
        case 'NCHAR':
        case 'NVARCHAR':
          query += "'" + item[key].replace(escapeRegex, "''") + "'"
          break
        case 'REAL':
        case 'NUMERIC':
          query += parseFloat(item[key])
          break
        default:
          query += parseInt(item[key])
          break
      }

      if (index < typeCacheKeys.length - 1) {
        query += ','
      }

      index += 1
    }

    result += query + ');'
  }

  return result
}

parentPort.on('message', (command) => {
  const { type } = command

  if (type === 'connect') {
    // Initial connection
    const { transactions, path } = command
    typeCache = command.typeCache
    typeCacheKeys = Object.keys(command.typeCache.fields)
    typeCacheInsert = typeCacheKeys.join(', ')

    db = new SqliteDatabaseConnection(path)
    db.exec('PRAGMA journal_mode = OFF;')
    db.exec('PRAGMA synchronous = 0;')
    db.exec('PRAGMA cache_size = 1000000;')
    db.exec('PRAGMA locking_mode = EXCLUSIVE')
    db.exec('PRAGMA temp_store = MEMORY;')

    transactionFactory = transactions === undefined
      ? defaultRowParser
      : new Function('return ' + transactions)()

  } else if (type === 'collection') {
    // Dealing with transactions
    const { data } = command

    db.exec('BEGIN TRANSACTION;' + transactionFactory(data) + 'COMMIT;')
    parentPort.postMessage(true)

  } else {
    // Arbitrary sql
    const { sql } = command
    parentPort.postMessage(db.exec(sql))
  }
})`

let workers: iWorker[] = []
let nextId = 0
let cleaningUp = false
let processing = 0

/**
 * Start workers
 */
 async function start (startup: (worker: Worker, index: number) => void, cleanup: () => boolean) {
    const workerInstances = []
    return new Promise(resolve => {
      /**
       * Spawns a worker
       */
      function spawn(cpuInfo: os.CpuInfo, index: number) {
        const worker = new Worker(workerFunction, {
          eval: true
        })

        workerInstances.push(worker)

        // Current item from the queue
        let job: Job = null 

        /**
         * If work exists, dequeue it and send it to the worker 
         */
        function takeWork() {
          if (!job && queue.length) {
            // If there's a job in the queue, send it to the worker
            processing += 1
            job = queue.shift()

            worker.postMessage(job.message)
            return true
          }
          return false
        }

        worker
          /**
           * Worker is online, register its ability to take work from the master queue
           */
          .on('online', () => {
            workers.push({
              takeWork,
              shutdown: () => worker.terminate()
            })

            // Start taking work
            takeWork()
          })

          /**
           * Worker has received a message, process it
           */
          .on('message', async (result: Db | true) => {
            if (result === true) {
              // Processing is complete
              processing -= 1

              if (queue.length === 0 && processing === 0) {
                // All processing is complete
                const cleanedUp = await cleanup(workerInstances)

                if (cleanedUp === true) {
                  return resolve(true)
                }
              }
            } else {
              // New request
              if (job === null) {
                // No job exists, leave
                return 
              }
      
              job.resolve(result as Db)          
              job = null
      
              takeWork()
            }
          })

          /**
           * Worker has received an error
           */
          .on('error', (err) => {
            console.error(err)
          })
        
        // Startup this thread with the worker and its index
        startup(worker, index)
      }

      // Spawn each worker
      cpus.forEach(spawn)
    }
  )
}

/**
 * Queue up work for a worker
 * @param {object} message 
 * @returns 
 */
export const doWork = async (message: Message): Promise<Db> => {
  return new Promise((resolve, reject) => {
    queue.push({
      resolve,
      reject,
      message
    })
    
    let i = 0

    for (const worker of workers) {
      // Loop through all workers

      if (i === nextId) {
        // Round-robin workers to make sure distribution is fair
        worker.takeWork()
        nextId = (nextId + 1) % workerCount
        break
      }
      i += 1
    }
  })
}

/**
 *
 */
function buildTypeCache(sql) {
  const match = createTableCacheRegex.exec(sql)
  if (!match) {
    throw new Error('Invalid CREATE TABLE statement')
  }
  
  const tableName = match[1];
  const fieldsString = match[2].trim()
  
  const fields = {}
  let fieldMatch
  
  while ((fieldMatch = fieldRegex.exec(fieldsString)) !== null) {
    const fieldName = fieldMatch[1]
    const fieldType = fieldMatch[2].toUpperCase() // Convert type to uppercase
    
    fields[fieldName] = fieldType
  }
  
  return { tableName, fields }
}

/**
 * Start SQLite Batch Writes
 */
export const startWriters = async (dbPath: string, fileName: string, createTableSql: string, transactionsFactory: (data: any[]) => string = undefined, consolidate: boolean = true) => {
  ensureDirSync(dbPath)
  const createTableStatement = 'CREATE TABLE IF NOT EXISTS ' + createTableSql + ';'
  const typeCache = buildTypeCache(createTableStatement)

  return start(
    // Startup
    (worker, index) => {
      // Create the SQLite database per worker
      worker.postMessage({
        typeCache,
        type: 'connect',
        path: dbPath + '/' + fileName + '.' + index + '.sqlite',
        transactions: transactionsFactory?.toString()
      })

      // Register the database to insert into
      worker.postMessage({
        sql: createTableStatement
      })
    },

    // Cleanup after all workers are finished
    async (workerInstances) => {
      if (queue.length > 0 || consolidate === false || cleaningUp) {
        // No clean up coming on
        return false
      }

      cleaningUp = true

      // Terminate all workers
      await Promise.all(workers.map((w, i) => new Promise<void>(resolve => {
        workerInstances[i].on('exit', resolve)
        w.shutdown()
      })))

      // Reset the workers array
      workers = []

      const consolidatedFilePath = dbPath + '/' + fileName + '.sqlite'

      const commands: string[] = [
        `(rm -f "${consolidatedFilePath}" && touch "${consolidatedFilePath}")`
      ]

      for (let i = 0; i  < workerCount; i++) {
        const filePath = dbPath + '/' + fileName + '.' + i + '.sqlite'
        const tableName = createTableStatement.match(createTableRegex)[1]

        commands.push(`(sqlite3 "${filePath}" ".dump ${tableName}" | sed -e 's/CREATE TABLE ${tableName} /CREATE TABLE IF NOT EXISTS ${tableName} /' | sqlite3 "${consolidatedFilePath}")`)
        commands.push(`(rm -f "${filePath}" && rm -f "${filePath}-journal")`)
      }

      // await exec(`((${commands.join(' && ')}) & wait)`)
      await exec(`(${commands.join(' && ')})`)

      cleaningUp = false
      return true
    }
  )
}
