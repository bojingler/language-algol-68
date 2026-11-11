'use strict'
// Two tokenizers behind one interface, so that every test runs on both:
//   vscode-textmate  the TextMate engine of VS Code with Oniguruma as WebAssembly; installs anywhere
//   first-mate       the tokenizer of Atom itself (native Oniguruma; builds with Node.js 22 or older)
// An engine yields, for a scope name and a text, the lines as rows of { value, scopes } (the shape
// of Atom's grammar.tokenizeLines) and the depth of the rule stack after the last line; it also
// answers whether a regular expression compiles in its Oniguruma and whether it matches in a text.

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', '..')

function grammarFiles () {
  const dir = path.join(root, 'grammars')
  return fs.readdirSync(dir).filter(f => f.endsWith('.cson')).sort().map(f => path.join(dir, f))
}

function readCson (file) {
  return require('cson-parser').parse(fs.readFileSync(file, 'utf8'))
}

async function vscodeTextmate () {
  const vsctm = require('vscode-textmate')
  const oniguruma = require('vscode-oniguruma')
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'))
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength))
  const raw = {}
  for (const file of grammarFiles()) {
    const g = readCson(file)
    raw[g.scopeName] = g
  }
  // a grammar with an injection selector is offered to every scope that selector names first
  const injections = {}
  for (const g of Object.values(raw)) {
    if (!g.injectionSelector) continue
    for (const target of g.injectionSelector.replace(/[LR]:/g, '').split(',')) {
      const scope = target.trim().split(/\s+/)[0]
      if (!injections[scope]) injections[scope] = []
      injections[scope].push(g.scopeName)
    }
  }
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: s => new oniguruma.OnigString(s)
    }),
    loadGrammar: async scopeName => raw[scopeName] || null,
    getInjections: scopeName => injections[scopeName]
  })
  const loaded = {}
  return {
    name: 'vscode-textmate',
    addGrammar (g) { raw[g.scopeName] = g },
    compiles (pattern) {
      try {
        const scanner = new oniguruma.OnigScanner([pattern])
        scanner.dispose()
        return null
      } catch (e) {
        return String(e.message || e)
      }
    },
    matches (pattern, text) {
      const scanner = new oniguruma.OnigScanner([pattern])
      const subject = new oniguruma.OnigString(text)
      const found = scanner.findNextMatchSync(subject, 0) !== null
      subject.dispose()
      scanner.dispose()
      return found
    },
    async tokenize (scopeName, text) {
      if (!loaded[scopeName]) loaded[scopeName] = await registry.loadGrammar(scopeName)
      const grammar = loaded[scopeName]
      if (!grammar) throw new Error('no grammar for ' + scopeName)
      let stack = vsctm.INITIAL
      const lines = []
      for (const line of text.split('\n')) {
        const r = grammar.tokenizeLine(line, stack)
        lines.push(r.tokens.map(t => ({ value: line.slice(t.startIndex, t.endIndex), scopes: t.scopes })))
        stack = r.ruleStack
      }
      return { lines, depth: stack.depth }
    }
  }
}

function firstMate () {
  const { GrammarRegistry } = require('first-mate')
  const { OnigRegExp } = require(require.resolve('oniguruma', { paths: [require.resolve('first-mate')] }))
  // the limits Atom gives its registry; a grammar may lift them for itself
  const registry = new GrammarRegistry({ maxTokensPerLine: 100, maxLineLength: 1000 })
  for (const file of grammarFiles()) registry.loadGrammarSync(file)
  return {
    name: 'first-mate',
    registry,
    addGrammar (g) { registry.addGrammar(registry.createGrammar('<test>', g)) },
    compiles (pattern) {
      try {
        new OnigRegExp(pattern).testSync('')
        return null
      } catch (e) {
        return String(e.message || e)
      }
    },
    matches (pattern, text) { return new OnigRegExp(pattern).testSync(text) },
    async tokenize (scopeName, text) {
      const grammar = registry.grammarForScopeName(scopeName)
      if (!grammar) throw new Error('no grammar for ' + scopeName)
      let stack = null
      const lines = []
      const source = text.split('\n')
      for (let i = 0; i < source.length; i++) {
        const r = grammar.tokenizeLine(source[i], stack, i === 0)
        lines.push(r.tokens.map(t => ({ value: t.value, scopes: t.scopes })))
        stack = r.ruleStack
      }
      return { lines, depth: stack.length }
    }
  }
}

async function load (name) {
  if (name === 'first-mate') return firstMate()
  if (name === 'vscode-textmate') return vscodeTextmate()
  throw new Error('unknown engine ' + name + ' (vscode-textmate, first-mate)')
}

function available (name) {
  try {
    require.resolve(name)
    return true
  } catch (e) {
    return false
  }
}

module.exports = { load, available, grammarFiles, readCson, root }
