/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  moduleFileExtensions: [ 'js', 'ts' ],
  testEnvironment: 'node',
  testMatch: [ '**/*.spec.ts' ],
  globals: {
    'ts-jest': {
      tsconfig: 'test/tsconfig.json',
      isolatedModules: true,
    },
  },
}