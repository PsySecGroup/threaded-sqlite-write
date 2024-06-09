import SqliteDatabaseConnection from 'better-sqlite3'
import { doWork } from './thread'
import { ensureFileSync } from  'fs-extra'

/**
 * A cache of all connections
 */
const cache: {
  [key: string]: SqliteDatabaseConnection
} = {}

/**
 * Get a sqlite database connection
 */
export const getDb = (path: string) => {
  if (cache[path] === undefined) {
    ensureFileSync(path)
    cache[path] = new SqliteDatabaseConnection(path)
    process.on('exit', () => cache[path].close());
    process.on('SIGHUP', () => process.exit(128 + 1));
    process.on('SIGINT', () => process.exit(128 + 2));
    process.on('SIGTERM', () => process.exit(128 + 15));
  }

  return cache[path]
}

/**
 * enqueue
 */
 export const enqueue = async (data: any[]) => {
  return doWork({ type: 'collection', data })
}

/**
 * run
 */
export const run = (query: string, parameters: Object | undefined = undefined, db: SqliteDatabaseConnection): Object[] => {
  const statement = db.prepare(query)
  if (parameters === undefined) {
    return statement.run()
  } else {
    return statement.bind(parameters).run()
  }
}

/**
 * query
 * @param query sql
 * @param parameters Object
 * @param db SqliteDatabaseConnection
 * @return Object[]
 */
export const query = (query: string, parameters: Object = {}, db: SqliteDatabaseConnection): Object[] => {
  const statement = db.prepare(query)
  return statement.bind(parameters).all()
}
