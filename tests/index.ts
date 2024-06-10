import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { startWriters, enqueue, getDb } from '../src/index'
import { exec } from '../src/shell'

test('Enqueue and insert example', async () => {

  // Enqueue gives jobs to worker threads to parse
  enqueue([
    { username: 'a', message: 'hey' },
    { username: 'b', message: 'no' },
    { username: 'c', message: 'yes' },
  ])

  enqueue([
    { username: 'd', message: 'what' },
    { username: 'e', message: 'but' },
    { username: 'f', message: 'why' },
  ])

  await startWriters(
    'tests', 'items',
    'CREATE TABLE IF NOT EXISTS comments (username TEXT, message TEXT);',
    function (data) {
      let query = '';

      for (const item of data) {
        const username = item.username
        const message = item.message
        
        query += `INSERT INTO comments (username, message) VALUES ('${username}', '${message}');`
      }

      return query
    },
    true
  )

  const db = getDb('tests/items.sqlite')
  const result = db.prepare('SELECT * from comments;').bind().all()

  assert.equal(result.length, 6);

  if (result[0].username === 'a') {
    assert.equal(result, [
      { username: 'a', message: 'hey' },
      { username: 'b', message: 'no' },
      { username: 'c', message: 'yes' },
      { username: 'd', message: 'what' },
      { username: 'e', message: 'but' },
      { username: 'f', message: 'why' }
    ])
  } else {
    assert.equal(result, [
      { username: 'd', message: 'what' },
      { username: 'e', message: 'but' },
      { username: 'f', message: 'why' },
      { username: 'a', message: 'hey' },
      { username: 'b', message: 'no' },
      { username: 'c', message: 'yes' }
    ])
  }


  db.close()
  await exec('rm tests/items.sqlite')
})

test.run()
