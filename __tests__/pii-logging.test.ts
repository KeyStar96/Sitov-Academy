/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sitovDiagnosticModule = '@/lib/sitov-server-failure'
const sitovApprovedCalls: Record<string, readonly string[]> = {
  'lib/learning-new-server.ts': [
    "console.error('[learning-new] counts_unavailable', { failure: sitovServerFailure(error) })",
    "console.error('[learning-new] counts_invalid', { failure: sitovServerFailure(data) })",
    "console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error) })",
    "console.error('[learning-new] items_invalid', { failure: sitovServerFailure(data) })",
  ],
  'lib/last-active-level.ts': [
    "console.error('[last-active-level] unavailable', { failure: sitovServerFailure(error ?? failure) })",
    "console.error('[last-active-level] unavailable', { failure: sitovServerFailure(error) })",
    "console.error('[last-active-level] invalid_response', { failure: 'schema:invalid_response' })",
  ],
  'lib/verbs/server.ts': [
    "console.error('[sitov-verbs] Request unavailable', { stage: error instanceof SitovServerReadError ? error.source : stage, failure: error instanceof SitovServerReadError ? error.failure : sitovServerFailure(error) })",
  ],
}
const sitovPrinter = ts.createPrinter()
function sitovCanonical(node: ts.Node, source: ts.SourceFile): string {
  return sitovPrinter.printNode(ts.EmitHint.Unspecified, node, source)
}
// Compare semantic AST children, excluding source positions, layout and trailing commas.
function sitovCallAst(node: ts.Node): string {
  function shape(current: ts.Node): unknown[] {
    const children: unknown[] = [current.kind]
    if (ts.isIdentifier(current) || ts.isStringLiteralLike(current) || ts.isNumericLiteral(current)) children.push(current.text)
    ts.forEachChild(current, child => { children.push(shape(child)) })
    return children
  }
  return JSON.stringify(shape(node))
}
function sitovSource(text: string): ts.SourceFile {
  return ts.createSourceFile('fixture.ts', text, ts.ScriptTarget.Latest, true)
}
const sitovApprovedAst = Object.fromEntries(Object.entries(sitovApprovedCalls).map(([file, calls]) => [file,
  calls.map(call => { const source = sitovSource(call); return sitovCallAst((source.statements[0] as ts.ExpressionStatement).expression) }),
]))

/** Exact reviewed call ASTs plus direct, unshadowed imports; no general object/sanitizer exemption. */
function sitovReviewedBindings(source: ts.SourceFile, verbs: boolean): boolean {
  const names = verbs ? ['sitovServerFailure', 'SitovServerReadError'] : ['sitovServerFailure']
  const found = new Set<string>()
  let valid = true, stages = 0
  function visit(node: ts.Node) {
    if (ts.isImportSpecifier(node) && names.includes(node.name.text)) {
      const declaration = node.parent.parent.parent
      if (node.propertyName || node.isTypeOnly || !ts.isImportDeclaration(declaration)
        || declaration.importClause?.isTypeOnly || !ts.isStringLiteral(declaration.moduleSpecifier)
        || declaration.moduleSpecifier.text !== sitovDiagnosticModule || found.has(node.name.text)) valid = false
      found.add(node.name.text)
    } else if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)
      || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node)
      || ts.isClassExpression(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) {
      if (node.name && ts.isIdentifier(node.name) && names.includes(node.name.text)) valid = false
      if (verbs && node.name && ts.isIdentifier(node.name) && node.name.text === 'stage') {
        stages++
        if (!ts.isVariableDeclaration(node) || !node.type || !node.initializer
          || sitovCanonical(node.type, source) !== "'client' | 'auth' | 'work'"
          || !ts.isStringLiteral(node.initializer) || node.initializer.text !== 'client') valid = false
      }
    }
    if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left)) {
      if (names.includes(node.left.text)) valid = false
      if (verbs && node.left.text === 'stage'
        && (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isStringLiteral(node.right)
          || !['client', 'auth', 'work'].includes(node.right.text))) valid = false
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return valid && names.every(name => found.has(name)) && (!verbs || stages === 1)
}
function sitovAllowedLog(node: ts.CallExpression, source: ts.SourceFile, file: string): boolean {
  if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) return true
  if (node.arguments.length !== 2 || !ts.isStringLiteral(node.arguments[0]) || !ts.isObjectLiteralExpression(node.arguments[1])) return false
  return Boolean(sitovApprovedAst[file]?.includes(sitovCallAst(node)))
    && sitovReviewedBindings(source, file === 'lib/verbs/server.ts')
}
function sitovInspect(text: string, file: string): { inspected: number; violations: number[] } {
  const source = sitovSource(text), violations: number[] = []
  let inspected = 0
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === 'console'
      && ['error', 'warn'].includes(node.expression.name.text)) {
      inspected++
      if (!sitovAllowedLog(node, source, file)) violations.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { inspected, violations }
}

it('all application warning/error logs are static events or exact reviewed bounded diagnostics', () => {
  const violations: string[] = []
  let inspected = 0
  function inspect(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) { inspect(file); continue }
      if (!/\.(tsx?|m?js|jsx)$/.test(file)) continue
      const result = sitovInspect(fs.readFileSync(file, 'utf8'), path.relative(process.cwd(), file).split(path.sep).join('/'))
      inspected += result.inspected
      violations.push(...result.violations.map(line => `${file}:${line}`))
    }
  }
  for (const directory of ['app', 'lib', 'components', 'utils', 'scripts']) inspect(path.join(process.cwd(), directory))
  expect(inspected).toBeGreaterThan(100)
  expect(violations).toEqual([])
})

const sitovImport = `import { sitovServerFailure, SitovServerReadError } from '${sitovDiagnosticModule}';`
const sitovStage = "let stage: 'client' | 'auth' | 'work' = 'client'; stage = 'auth'; stage = 'work';"
it.each(Object.entries(sitovApprovedCalls).flatMap(([file, calls]) => calls.map(call => [file, call])))('permits only the reviewed AST in %s', (file, call) => {
  expect(sitovInspect(`${sitovImport}\n${file === 'lib/verbs/server.ts' ? sitovStage : ''}\n${call}`, file).violations).toEqual([])
})
it.each([
  "console.error('[learning-new] items_unavailable', error)",
  "console.error('[learning-new] items_unavailable', { failure: error })",
  "console.error('[learning-new] items_unavailable', { failure: error.message })",
  "console.error('[learning-new] items_unavailable', { failure: data })",
  "console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error), token: token })",
  "console.error('[learning-new] items_unavailable', { failure: { nested: error } })",
  "console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error as Error) })",
  "console.error('[learning-new] items_unavailable', { ...data, failure: sitovServerFailure(error) })",
  "console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error.message) })",
  "console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error, data) })",
  "console.error('[learning-new] items_unavailable', { failure: (sitovServerFailure as any)(error) })",
  "console.error('[learning-new] items_unavailable', { failure: alias(error) })",
  "console.error('[learning-new] items_unavailable', { failure: `code:${error.code}` })",
  "console.error(`[learning-new] items_unavailable`, { failure: sitovServerFailure(error) })",
  "console.warn('[learning-new] items_unavailable', { failure: sitovServerFailure(error) })",
])('rejects raw fields, extra shape, casts, spreads, templates and helper misuse', call => {
  expect(sitovInspect(`${sitovImport}\n${call}`, 'lib/learning-new-server.ts').violations).toHaveLength(1)
})
it.each([
  `import { sitovServerFailure } from './unreviewed';`,
  `import { unsafe as sitovServerFailure } from '${sitovDiagnosticModule}';`,
  `const sitovServerFailure = (value: unknown) => value;`,
  `${sitovImport} function leak(sitovServerFailure: any) {}`,
  `${sitovImport} sitovServerFailure = unsafe;`,
])('rejects missing, aliased or shadowed diagnostic imports', prefix => {
  expect(sitovInspect(`${prefix}\n${sitovApprovedCalls['lib/learning-new-server.ts'][2]}`, 'lib/learning-new-server.ts').violations).toHaveLength(1)
})
it('rejects the same diagnostic expression in another file or with an unbounded stage', () => {
  expect(sitovInspect(`${sitovImport}\n${sitovApprovedCalls['lib/learning-new-server.ts'][2]}`, 'lib/other.ts').violations).toHaveLength(1)
  expect(sitovInspect(`${sitovImport}\n${sitovStage}\nstage = userInput;\n${sitovApprovedCalls['lib/verbs/server.ts'][0]}`, 'lib/verbs/server.ts').violations).toHaveLength(1)
})
