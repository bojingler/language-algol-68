#!/usr/bin/env node
'use strict'
// The tests of language-algol-68.
//
//   node test/run.js [--engine vscode-textmate|first-mate|all] [--verbose]
//
// 1. grammars   every grammar file is well formed: rules, scope names, includes, and every
//               regular expression compiles in Oniguruma (the engine of TextMate and Atom) and,
//               where `grep -P` is at hand, in PCRE (the engine of GitHub's highlighter)
// 2. cases      the scope assertions of test/cases.js
// 3. samples    every file of samples/ is tokenized; what the grammar takes for comment, string,
//               pragmat, format text and program text is compared, character by character, with
//               a scanner written by hand (test/lib/reference.js), no construct is left open, and
//               the grammar decides on capitals or small letters as the scanner's own rule does
// 4. settings   the indentation patterns compile and decide a table of lines as intended
// 5. snippets   every snippet is well formed and its expansion is tokenized as program text
//
// The default engine is vscode-textmate (Oniguruma as WebAssembly: `npm install` is enough);
// first-mate is the tokenizer of Atom itself and is used when it is installed.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const engines = require('./lib/engines')
const { checkCase, spans } = require('./lib/check')
const reference = require('./lib/reference')
const cases = require('./cases')
const gfmStub = require('./lib/gfm-stub')

const root = engines.root
let failures = 0
let verbose = false

function fail (section, message) {
  failures++
  console.log('FAIL ' + section + ': ' + message)
}

// ---------------------------------------------------------------- 1. grammars ----

const ruleKeys = ['name', 'contentName', 'match', 'begin', 'end', 'captures', 'beginCaptures', 'endCaptures',
  'patterns', 'include', 'comment']
const grammarKeys = ['scopeName', 'name', 'fileTypes', 'firstLineMatch', 'injectionSelector', 'maxTokensPerLine',
  'limitLineLength', 'patterns', 'repository', 'comment']
const externalScopes = ['source.gfm']          // grammars of other packages that may be included
const scopeName = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

// the regular expression as it is compiled alone: a back-reference of an end pattern to its begin
// pattern has nothing to refer to
const alone = pattern => pattern.replace(/\\[1-9]/g, '(?:x)')

// a character outside ASCII inside a character class is not portable to a byte-oriented PCRE
function classWithNonAscii (pattern) {
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') { i++; continue }
    if (!inClass && c === '[') inClass = true
    else if (inClass && c === ']') inClass = false
    else if (inClass && c.charCodeAt(0) > 127) return true
  }
  return false
}

function pcreAvailable () {
  const probe = spawnSync('grep', ['-P', '-e', 'a(?=b)(?<![a-z]|[a-z] )', '/dev/null'], { encoding: 'utf8' })
  return !probe.error && probe.status === 1
}

function pcreError (pattern) {
  const r = spawnSync('grep', ['-P', '-e', alone(pattern), '/dev/null'], { encoding: 'utf8' })
  return r.status === 1 || r.status === 0 ? null : (r.stderr || 'does not compile').trim().split('\n')[0]
}

function checkGrammars (engine, withPcre) {
  const files = engines.grammarFiles()
  const grammars = files.map(f => ({ file: path.basename(f), g: engines.readCson(f) }))
  const scopes = grammars.map(x => x.g.scopeName)
  let rules = 0
  let patterns = 0
  for (const { file, g } of grammars) {
    const where = 'grammars/' + file
    for (const k of Object.keys(g)) if (!grammarKeys.includes(k)) fail(where, 'unknown key ' + k)
    if (!g.scopeName) fail(where, 'no scopeName')
    if (g.name && !Array.isArray(g.fileTypes)) fail(where, 'a named grammar lists its file types')
    const repository = g.repository || {}
    const used = new Set()
    const regex = (pattern, what) => {
      patterns++
      const onig = engine.compiles(alone(pattern))
      if (onig) fail(where, what + ' does not compile in Oniguruma (' + onig + '): ' + pattern)
      if (classWithNonAscii(pattern)) fail(where, what + ' has a character outside ASCII in a character class: ' + pattern)
      if (withPcre) {
        const pcre = pcreError(pattern)
        if (pcre) fail(where, what + ' does not compile in PCRE (' + pcre + '): ' + pattern)
      }
    }
    const captures = (c, what) => {
      for (const [k, v] of Object.entries(c)) {
        if (!/^[0-9]+$/.test(k)) fail(where, what + ' has the key ' + k)
        if (!v.name || !scopeName.test(v.name)) fail(where, what + '.' + k + ' has no scope name')
        else name(v.name)
      }
    }
    const name = n => {
      if (!scopeName.test(n)) fail(where, 'not a scope name: ' + n)
      else if (!/\balgol68\b/.test(n) && !n.endsWith('.gfm')) fail(where, 'a scope name of another language: ' + n)
    }
    const rule = (r, what) => {
      rules++
      for (const k of Object.keys(r)) if (!ruleKeys.includes(k)) fail(where, what + ' has the key ' + k + ' (Atom does not know it)')
      const kinds = ['match', 'begin', 'include'].filter(k => k in r)
      if (kinds.length > 1) fail(where, what + ' is of several kinds: ' + kinds.join(', '))
      if (kinds.length === 0 && !r.patterns) fail(where, what + ' has no match, begin, include or patterns')
      if (('begin' in r) !== ('end' in r)) fail(where, what + ' needs both begin and end')
      if (r.name) name(r.name)
      if (r.contentName) name(r.contentName)
      if (r.match !== undefined) regex(r.match, what + '.match')
      if (r.begin !== undefined) regex(r.begin, what + '.begin')
      if (r.end !== undefined) regex(r.end, what + '.end')
      for (const k of ['captures', 'beginCaptures', 'endCaptures']) if (r[k]) captures(r[k], what + '.' + k)
      if (r.include !== undefined) {
        const inc = r.include
        if (inc.startsWith('#')) {
          if (!(inc.slice(1) in repository)) fail(where, what + ' includes ' + inc + ', which the repository lacks')
          used.add(inc.slice(1))
        } else if (inc !== '$self' && inc !== '$base' && !scopes.includes(inc) && !externalScopes.includes(inc)) {
          fail(where, what + ' includes the unknown grammar ' + inc)
        }
      }
      if (r.patterns) r.patterns.forEach((p, k) => rule(p, what + '.patterns[' + k + ']'))
    }
    if (g.firstLineMatch) regex(g.firstLineMatch, 'firstLineMatch')
    ;(g.patterns || []).forEach((p, k) => rule(p, 'patterns[' + k + ']'))
    for (const [key, r] of Object.entries(repository)) rule(r, '#' + key)
    for (const key of Object.keys(repository)) if (!used.has(key)) fail(where, 'the repository entry ' + key + ' is not used')
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (pkg.name !== 'language-algol-68') fail('package.json', 'name is ' + pkg.name)
  if (!pkg.engines || !pkg.engines.atom) fail('package.json', 'no engines.atom')
  if (pkg.license !== 'MIT') fail('package.json', 'licence is ' + pkg.license)
  console.log('grammars: ' + grammars.length + ' files, ' + rules + ' rules, ' + patterns + ' regular expressions compile in Oniguruma' +
    (withPcre ? ' and in PCRE (grep -P)' : '; PCRE not checked (no grep -P)'))
}

// ------------------------------------------------------------------- 2. cases ----

async function checkCases (engine) {
  let assertions = 0
  let failed = 0
  for (const c of cases) {
    const { lines } = await engine.tokenize(c.grammar || 'source.algol68', c.text)
    const problems = checkCase(c, lines)
    assertions += c.expect.length
    failed += problems.length
    for (const p of problems) fail('case "' + c.name + '"', p)
  }
  console.log('cases: ' + cases.length + ' cases, ' + assertions + ' assertions, ' + failed + ' failed')
}

// ----------------------------------------------------------------- 3. samples ----

// Whether a text leaves nothing open: a semicolon on a line after it is plain punctuation of the
// program.  (The rule that holds the decision on capitals or small letters stays open to the end of
// a file, so the depth of the rule stack does not tell.)
async function closedAtEnd (engine, scope, text) {
  const { lines } = await engine.tokenize(scope, text + '\n;')
  const last = lines[lines.length - 1]
  return last.length === 1 && last[0].value === ';' &&
    last[0].scopes.every(s => /^(source\.algol68$|meta\.stropping\.|punctuation\.separator\.semicolon\.)/.test(s)) &&
    last[0].scopes.some(s => s.startsWith('punctuation.separator.semicolon'))
}

// the rule set the grammar chose for a file: the stropping scope of its last token
function chosen (lines) {
  const all = lines.flat()
  const scopes = all.length ? all[all.length - 1].scopes : []
  return scopes.some(s => s.startsWith('meta.stropping.supper')) ? 'supper' : scopes.some(s => s.startsWith('meta.stropping.upper')) ? 'upper' : 'none'
}

// the difference between the classes the grammar gives and those of the reference scanner
function compareClasses (text, lines, markdown) {
  const want = reference.classify(text, markdown)
  const problems = []
  let offset = 0
  let compared = 0
  lines.forEach((tokens, n) => {
    for (const t of spans(tokens)) {
      const got = reference.classOf(t.scopes)
      for (let k = t.start; k < t.end; k++) {
        compared++
        if (want[offset + k] !== got && problems.length < 5) {
          problems.push('line ' + (n + 1) + ', column ' + (k + 1) + ': ' + reference.names[got] + ' for the grammar, ' +
            reference.names[want[offset + k]] + ' for the reference scanner (' + JSON.stringify(t.value.slice(0, 30)) + ')')
          break
        }
      }
    }
    offset += tokens.reduce((sum, t) => sum + t.value.length, 0) + 1
  })
  return { compared, problems }
}

// the samples written with reserved words in small letters; every other sample is in capitals
const smallLetterSamples = ['sieve.a68', 'wordcount.a68']

async function checkSamples (engine) {
  const decisions = {}
  const dir = path.join(root, 'samples')
  const files = fs.readdirSync(dir).filter(f => /\.a68(\.md)?$/.test(f)).sort()
  let lineCount = 0
  let tokenCount = 0
  let charCount = 0
  const seen = new Set()
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8')
    const markdown = f.endsWith('.md')
    const { lines, depth } = await engine.tokenize(markdown ? 'text.markdown.algol68' : 'source.algol68', text)
    lineCount += lines.length
    tokenCount += lines.reduce((sum, l) => sum + l.length, 0)
    for (const l of lines) for (const t of l) seen.add(reference.classOf(t.scopes))
    if (markdown ? depth !== 1 : !(await closedAtEnd(engine, 'source.algol68', text))) fail('samples/' + f, 'a construct is open at the end of the file')
    if (!markdown) {
      const want = reference.decide(text).regime
      const got = chosen(lines)
      decisions[got] = (decisions[got] || 0) + 1
      if (got !== want) fail('samples/' + f, 'the grammar reads it as ' + got + ', the reference rule as ' + want)
      if (got !== (smallLetterSamples.includes(f) ? 'supper' : 'upper')) fail('samples/' + f, 'read as ' + got)
    }
    const r = compareClasses(text, lines, markdown)
    charCount += r.compared
    for (const p of r.problems) fail('samples/' + f, p)
    // the last word of a program is END or FED (end, fed), of a Markdown source **end**: program text and a keyword
    const all = lines.flat().filter(t => t.value.trim() !== '' && !t.value.startsWith('```'))
    const last = all[all.length - 1]
    if (!last || !/^(END|FED|end|fed|\*\*end\*\*)$/.test(last.value) || !last.scopes.some(s => s.startsWith('keyword.control'))) {
      fail('samples/' + f, 'the last word is not a closing keyword: ' + (last ? JSON.stringify(last.value) + ' ' + last.scopes.join(' ') : 'nothing'))
    }
    if (verbose) console.log('  samples/' + f + ': ' + lines.length + ' lines')
  }
  for (const c of [reference.CODE, reference.COMMENT, reference.STRING, reference.PRAGMAT, reference.FORMAT, reference.PROSE]) {
    if (!seen.has(c)) fail('samples', 'no sample has any ' + reference.names[c])
  }
  console.log('samples: ' + files.length + ' files, ' + lineCount + ' lines, ' + tokenCount + ' tokens, ' + charCount +
    ' characters agree with the reference scanner; read as capitals ' + (decisions.upper || 0) + ', as small letters ' + (decisions.supper || 0))
}

// ---------------------------------------------------------------- 4. settings ----

// [line, indents the next line, is itself moved back]
const indentation = [
  ['BEGIN', true, false],
  ['  BEGIN INT n := 0;', true, false],
  ['END', false, true],
  ['  END;', false, true],
  ['IF a > b THEN', true, false],
  ['IF a > b', true, false],
  ['THEN x := 1', true, true],
  ['ELSE', true, true],
  ['ELIF c THEN', true, true],
  ['FI;', false, true],
  ['IF a THEN b ELSE c FI;', false, false],
  ['x := (a > b | a | b);', false, false],
  ['CASE k IN', true, false],
  ['IN a, b', true, true],
  ['OUT c', true, true],
  ['ESAC', false, true],
  ['FOR i TO n DO', true, false],
  ['FOR i FROM 1 TO n', true, false],
  ['DO s +:= i OD;', false, true],
  ['FOR i TO n DO s +:= i OD;', false, false],
  ['WHILE more DO', true, false],
  ['OD', false, true],
  ['MODULE SHAPES =', false, false],
  ['DEF', true, false],
  ['POSTLUDE', true, true],
  ['FED', false, true],
  ['print ((a, b, c));', false, false],
  ['print ((', true, false],
  ['));', false, true],
  ['PROC p = (INT a) INT: a + 1;', false, false],
  ['indent := endless + done;', false, false],
  ['INTEGER i; DOT d; ENDING e;', false, false]
]

// the same table for a source in small letters
const indentationSmall = [
  ['begin', true, false],
  ['  begin int n := 0;', true, false],
  ['end', false, true],
  ['if a > b then', true, false],
  ['then x := 1', true, true],
  ['else', true, true],
  ['elif c then', true, true],
  ['fi;', false, true],
  ['if a then b else c fi;', false, false],
  ['case k in', true, false],
  ['out c', true, true],
  ['esac', false, true],
  ['for i to n do', true, false],
  ['do s +:= i od;', false, true],
  ['for i to n do s +:= i od;', false, false],
  ['od', false, true],
  ['module Shapes =', false, false],
  ['def', true, false],
  ['fed', false, true],
  ['puts ((', true, false],
  ['));', false, true],
  ['proc p = (int a) int: a + 1;', false, false],
  ['indent := endless + done_now;', false, false],
  ['end_of_file := if_any;', false, false],
  ['Integer i; Dot d; Ending e;', false, false]
]

function checkSettings (engine) {
  const file = path.join(root, 'settings', 'language-algol68.cson')
  const settings = engines.readCson(file)
  checkEditor(engine, (settings['.source.algol68'] || {}).editor, '.source.algol68', indentation)
  checkEditor(engine, (settings['.source.algol68 .meta.stropping.supper.algol68'] || {}).editor, 'small letters', indentationSmall)
}

function checkEditor (engine, editor, which, indentation) {
  if (!editor) { fail('settings', 'no editor settings for ' + which); return }
  for (const key of ['commentStart', 'commentEnd', 'increaseIndentPattern', 'decreaseIndentPattern', 'foldEndPattern']) {
    if (typeof editor[key] !== 'string') fail('settings', 'no ' + key)
  }
  for (const key of ['increaseIndentPattern', 'decreaseIndentPattern', 'foldEndPattern']) {
    const error = engine.compiles(editor[key])
    if (error) { fail('settings', key + ' does not compile: ' + error); return }
  }
  let wrong = 0
  for (const [line, increase, decrease] of indentation) {
    if (engine.matches(editor.increaseIndentPattern, line) !== increase) { wrong++; fail('settings', 'increaseIndentPattern is ' + !increase + ' for ' + JSON.stringify(line)) }
    if (engine.matches(editor.decreaseIndentPattern, line) !== decrease) { wrong++; fail('settings', 'decreaseIndentPattern is ' + !decrease + ' for ' + JSON.stringify(line)) }
  }
  console.log('settings (' + which + '): 3 patterns compile, ' + indentation.length + ' lines of the indentation table, ' + wrong + ' wrong')
}

// ---------------------------------------------------------------- 5. snippets ----

// the text a snippet leaves when every tab stop keeps its placeholder; null if its syntax is wrong
function expand (body) {
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '\\' && body[i + 1] === '$') { out += '$'; i++ } else if (c === '$') {
      const stop = /^\$(?:([0-9]+)|\{([0-9]+)(?::([^{}$]*))?\})/.exec(body.slice(i))
      if (!stop) return null
      out += stop[3] || ''
      i += stop[0].length - 1
    } else out += c
  }
  return out
}

async function checkSnippets (engine) {
  const file = path.join(root, 'snippets', 'language-algol68.cson')
  const all = engines.readCson(file)
  const snippets = all['.source.algol68'] || {}
  const prefixes = new Set()
  let count = 0
  for (const [title, s] of Object.entries(snippets)) {
    count++
    const where = 'snippet "' + title + '"'
    if (typeof s.prefix !== 'string' || !/^[a-z]+$/.test(s.prefix)) { fail(where, 'no prefix of small letters'); continue }
    if (prefixes.has(s.prefix)) fail(where, 'the prefix ' + s.prefix + ' is used twice')
    prefixes.add(s.prefix)
    const text = typeof s.body === 'string' ? expand(s.body) : null
    if (text === null) { fail(where, 'the body is not a snippet'); continue }
    const { lines } = await engine.tokenize('source.algol68', text)
    if (!(await closedAtEnd(engine, 'source.algol68', text))) fail(where, 'the expansion leaves a construct open')
    const r = compareClasses(text, lines, false)
    for (const p of r.problems) fail(where, p)
    // a word in capitals that the grammar takes for an indication is one of the snippet's placeholders
    for (const t of lines.flat()) {
      if (/^[A-Z][A-Z0-9]*$/.test(t.value) && t.scopes.some(x => x.startsWith('entity.name.type')) &&
          !new RegExp('\\$\\{[0-9]+:' + t.value + '\\}').test(s.body)) {
        fail(where, t.value + ' is no reserved word for the grammar')
      }
    }
  }
  if (count === 0) fail('snippets', 'no snippets for .source.algol68')
  console.log('snippets: ' + count + ' snippets, their expansions are program text for the grammar')
}

// ------------------------------------------------------------------------ main ----

async function main () {
  const args = process.argv.slice(2)
  let wanted = process.env.ALGOL68_TEST_ENGINE || 'vscode-textmate'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine') wanted = args[++i]
    else if (args[i] === '--verbose') verbose = true
    else { console.error('usage: node test/run.js [--engine vscode-textmate|first-mate|all] [--verbose]'); process.exit(2) }
  }
  const names = wanted === 'all' ? ['vscode-textmate', 'first-mate'].filter(engines.available) : [wanted]
  if (names.length === 0) { console.error('no tokenizer is installed: run `npm install`'); process.exit(2) }
  const withPcre = pcreAvailable()
  for (const name of names) {
    const engine = await engines.load(name)
    engine.addGrammar(gfmStub)
    console.log('== ' + engine.name + ' ==')
    checkGrammars(engine, withPcre)
    await checkCases(engine)
    await checkSamples(engine)
    checkSettings(engine)
    await checkSnippets(engine)
  }
  console.log(failures === 0 ? 'all tests passed' : failures + ' failures')
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(2) })
