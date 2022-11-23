const { startWriters, enqueue } = require('./index');

async function main () {
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
    // Directory to save the sqlite databases
    'data',

    // The name of the sqlite databases
    'items',

    // The CREATE TABLE sql for the table to populate (Must be CREATE TABLE IF NOT EXISTS)
    'CREATE TABLE IF NOT EXISTS comments (username TEXT, message TEXT);',

    // The function that converts enqueue() arrays of data into a semicolon-separated string of SQL INSERTs.
    function (data) {
      let query = '';

      for (const item of data) {
        const username = item.username
        const message = item.message
        
        query += `INSERT INTO comments (username, message) VALUES ('${username}', '${message}');`
      }
      console.log(query)
      return query
    },

    // If set to true, all created databases will be merged into one single database with every record (default)
    true
  );
}

main();