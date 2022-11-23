module.exports = {
  "parser": "@typescript-eslint/parser",
  "ignorePatterns": [
    "node_modules",
    "build/**",
    "src/dev-index.js",
    ".eslintrc.js",
    ".git/**"
  ],
  "parserOptions": {
    "tsconfigRootDir": __dirname,
    "project": __dirname + "/tsconfig.eslint.json"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "standard-with-typescript"
  ],
  "rules": {
    "@typescript-eslint/prefer-function-type": "off",
    "@typescript-eslint/no-empty-interface": "off"
  }
}