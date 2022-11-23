import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { startWriters, enqueue, getDb } from '../src/index'
import { exec } from 'shelljs'

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
    'data', 'items',
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
  );

  const db = getDb('data/items.sqlite')
  const result = db.prepare('SELECT * from comments;').bind().all()

  assert.equal(result.length, 6);
  assert.equal(result[0].username, 'a');
  assert.equal(result[0].message, 'hey');
  assert.equal(result[1].username, 'b');
  assert.equal(result[1].message, 'no');
  assert.equal(result[2].username, 'c');
  assert.equal(result[2].message, 'yes');
  assert.equal(result[3].username, 'd');
  assert.equal(result[3].message, 'what');
  assert.equal(result[4].username, 'e');
  assert.equal(result[4].message, 'but');
  assert.equal(result[5].username, 'f');
  assert.equal(result[5].message, 'why');

  exec('rm data/items.sqlite && rmdir data');
})

test.run()
