/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

it('all application warning/error logs are static events without user data or raw errors', () => {
  const violations: string[] = []
  let inspected = 0
  function inspect(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) { inspect(file); continue }
      if (!/\.(tsx?|m?js|jsx)$/.test(file)) continue
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.getText(source) === 'console'
          && ['error', 'warn'].includes(node.expression.name.text)) {
          inspected++
          if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) {
            violations.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  for (const directory of ['app', 'lib', 'components', 'utils', 'scripts']) inspect(path.join(process.cwd(), directory))
  expect(inspected).toBeGreaterThan(100)
  expect(violations).toEqual([])
})
