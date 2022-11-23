import type { Message, Job, iWorker, Db } from './index.d'
import * as os from 'os'
import { Worker } from 'worker_threads'
import { ensureDirSync } from 'fs-extra'
import { exec } from 'shelljs'

const queue: Job[] = []
const cpus = os.cpus()
const workerCount = cpus.length
const createTableRegex = /CREATE TABLE IF NOT EXISTS ([^\s]+) \(/

let workers: iWorker[] = []
let nextId = 0
let cleaningUp = false
let processing = 0

/**
 * Start workers
 */
 async function start (workerPath: string, startup: (worker: Worker, index: number) => void, cleanup: () => boolean) {
    return new Promise(resolve => {
    /**
     * Spawns a worker
     */
    function spawn(cpuInfo: os.CpuInfo, index: number) {
      const worker = new Worker(workerPath)

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
        }
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
              if (cleanup() === true) {
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
  })
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
 * Start SQLite Batch Writes
 */
export const startWriters = async (dbPath: string, fileName: string, createTableSql: string, transactionsFactory: (data: any[]) => string, consolidate: boolean = false) => {
  ensureDirSync(dbPath)

  return start(
    __dirname + '/../dist/insert.js',

    // Startup
    (worker, index) => {
      // Create the SQLite database per worker
      worker.postMessage({
        type: 'connect',
        path: dbPath + '/' + fileName + '.' + index + '.sqlite',
        transactions: transactionsFactory.toString() || 'function (sql) { return sql }'
      })

      // Register the database to insert into
      worker.postMessage({
        sql: createTableSql
      })
    },

    // Cleanup after all workers are finished
    () => {
      if (queue.length > 0 || consolidate === false || cleaningUp) {
        // No clean up coming on
        return false
      }

      cleaningUp = true

      workers.forEach(w => w.shutdown())

      const consolidatedFilePath = dbPath + '/' + fileName + '.sqlite'

      const commands: string[] = [
        `(rm -f "${consolidatedFilePath}" && touch "${consolidatedFilePath}")`
      ]

      for (let i = 0; i  < workerCount; i++) {
        const filePath = dbPath + '/' + fileName + '.' + i + '.sqlite'
        const tableName = createTableSql.match(createTableRegex)[1]

        commands.push(`(sqlite3 "${filePath}" ".dump ${tableName}" | sed -e 's/CREATE TABLE ${tableName} /CREATE TABLE IF NOT EXISTS ${tableName} /' | sqlite3 "${consolidatedFilePath}")`)
        commands.push(`(rm -f "${filePath}" && rm -f "${filePath}-journal")`)
      }

      exec(`((${commands.join(' && ')}) & wait)`)

      return true
    }
  )
}
