# threaded-sqlite-write

Extreme speed SQLite bulk insertions spread across multiple threads then compiled into a single SQLite file.

## Example

```ts
const { startWriters, enqueue } = require('@psysecgroup/threaded-sqlite-write');

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

      return query
    },

    // If set to true, all created databases will be merged into one single database with every record (default)
    // If set to false, a SQLite file will exist for each core your CPU has
    true
  );
}

main();
```

## Install

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/psysecgroup/threaded-sqlite-write)

First, install `sqlite3`:

```bash
# Debian/Ubuntu
sudo apt-get install sqlite3

# CentOS / Fedora / RedHat
sudo yum install sqlite3

# MacPorts
sudo port install sqlite3

# Brew
sudo brew install sqlite3

#Choco
choco install sqlite
```

Then, install the module:

```bash
# NPM
npm install -S https://github.com/psysecgroup/threaded-sqlite-write

# Yarn
yarn add https://github.com/psysecgroup/threaded-sqlite-write
```

## Testing

Add your tests to the [`tests`](tests) folder, then import them in the [`tests/index.ts`](tests/index.ts) file.

## CLI

### npm

- `npm run build`: Builds the source TypeScript to CommonJS, ESM, and IIFE JavaScript files in [`dist`](dist)
- `npm run sb-watch`: Watches for changes for TypeScript files, builds the source on a change, then runs [`dist/index.js`](dist/index.js) (StackBlitz-friendly)
- `npm run watch`: Watches for changes for TypeScript files, builds the source on a change, then runs [`dist/index.js`](dist/index.js) (Every other system)
- `npm test`: Runs tests.

### yarn

- `yarn build`: Builds the source TypeScript to CommonJS, ESM, and IIFE JavaScript files in [`dist`](dist)
- `yarn sb-watch`: Watches for changes for TypeScript files, builds the source on a change, then runs [`dist/index.js`](dist/index.js) (StackBlitz-friendly)
- `yarn watch`: Watches for changes for TypeScript files, builds the source on a change, then runs [`dist/index.js`](dist/index.js) (Every other system)
- `yarn test`: Runs tests.

