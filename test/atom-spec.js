#!/usr/bin/env node
'use strict'
// Runs spec/*-spec.js outside the editor: first-mate, the tokenizer of Atom, stands in for the
// grammar registry of the editor, and a few lines stand in for Jasmine 1.3 (describe, it,
// beforeEach, waitsForPromise, expect).  This shows that the spec file does what it says with
// Atom's own tokenizer; it does not replace a run in Atom or Pulsar, which also loads the
// package through its package.json, the settings and the snippets.  The choice of a grammar
// for a file is the editor's and not first-mate's: selectGrammar below is a stand-in that
// follows the editor's rule as this package understands it (the longest file type that ends
// the file name, component by component; then the first line).
//
//   node test/atom-spec.js        (needs first-mate, which builds with Node.js 22 or older)

const fs = require('fs')
const path = require('path')
const util = require('util')
const engines = require('./lib/engines')

const { GrammarRegistry } = require('first-mate')
const registry = new GrammarRegistry({ maxTokensPerLine: 100, maxLineLength: 1000 })

global.atom = {
  packages: {
    activatePackage (name) {
      if (name === 'language-algol-68') {
        for (const file of engines.grammarFiles()) {
          if (!registry.grammarForScopeName(engines.readCson(file).scopeName)) registry.loadGrammarSync(file)
        }
        return Promise.resolve()
      }
      if (name === 'language-gfm') {
        if (!registry.grammarForScopeName('source.gfm')) registry.addGrammar(registry.createGrammar('<stand-in>', require('./lib/gfm-stub')))
        return Promise.resolve()
      }
      return Promise.reject(new Error('no package ' + name))
    }
  },
  grammars: {
    grammarForScopeName: scope => registry.grammarForScopeName(scope),
    selectGrammar
  }
}

function selectGrammar (filePath, contents) {
  const components = (filePath || '').toLowerCase().split(/[/.]/)
  let best = registry.nullGrammar
  let bestScore = 0
  for (const grammar of registry.getGrammars()) {
    let score = 0
    for (const type of grammar.fileTypes || []) {
      const wanted = type.toLowerCase().split(/[/.]/)
      if (components.slice(-wanted.length).join('.') === wanted.join('.')) score = Math.max(score, type.length)
    }
    if (contents && grammar.firstLineRegex && grammar.firstLineRegex.testSync(contents.split('\n')[0])) score += 0.25
    if (score > bestScore) { best = grammar; bestScore = score }
  }
  return best
}

const suites = []      // the open describe blocks, innermost last
const specs = []       // { name, before: [fn], run: fn }
let pending = []       // the promises of the spec that is running

global.describe = (name, body) => {
  suites.push({ name, before: [] })
  body()
  suites.pop()
}
global.beforeEach = fn => suites[suites.length - 1].before.push(fn)
global.it = (name, run) => specs.push({ name: suites.map(s => s.name).concat([name]).join(' '), before: suites.flatMap(s => s.before), run })
global.waitsForPromise = fn => pending.push(fn())

let problems = []
global.expect = actual => {
  const check = (ok, what) => { if (!ok) problems.push('expected ' + util.inspect(actual, { depth: 3, breakLength: 200 }) + ' ' + what) }
  return {
    toBe: wanted => check(actual === wanted, 'to be ' + util.inspect(wanted)),
    toEqual: wanted => check(util.isDeepStrictEqual(actual, wanted), 'to equal ' + util.inspect(wanted)),
    toBeTruthy: () => check(Boolean(actual), 'to be truthy'),
    toBeDefined: () => check(actual !== undefined, 'to be defined')
  }
}

async function main () {
  const dir = path.join(engines.root, 'spec')
  for (const f of fs.readdirSync(dir).filter(f => /-spec\.js$/.test(f)).sort()) require(path.join(dir, f))
  let failed = 0
  for (const spec of specs) {
    problems = []
    try {
      for (const fn of spec.before.concat([spec.run])) {
        pending = []
        fn()
        await Promise.all(pending)
      }
    } catch (e) {
      problems.push(String(e && e.stack ? e.stack : e))
    }
    if (problems.length) {
      failed++
      console.log('FAIL ' + spec.name)
      for (const p of problems) console.log('   ' + p)
    }
  }
  console.log('spec on first-mate: ' + specs.length + ' specs, ' + failed + ' failed')
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(2) })
