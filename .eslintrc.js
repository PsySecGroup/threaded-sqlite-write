module.exports = {
  "parser": "@typescript-eslint/parser",
  "ignorePatterns": [
    "node_modules",
    ".eslintrc.js",
    ".git/**",
    "dist",
    "data"
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