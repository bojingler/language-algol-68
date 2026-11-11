'use strict'
// The grammar against the lexer of the PA/68 compiler.
//
//   node test/lexer-diff.js --lexer PATH/pa68lex [--engine NAME] [--option OPT]... [--verbose] FILE.a68 ...
//
// --option gives the lexer an option for every file (--gnu for the GNU conveniences); the lexer's
// options in a file NAME.flags beside NAME.a68 (the convention of the PA/68 tests) are added for that
// file.  A file in another stropping regime (--point, --supper) and a file in which the lexer finds
// errors are passed over.
//
// pa68lex writes one line per token: "line:column kind |source slice| =symbol"; comments and
// blanks are no tokens.  For every file the grammar's tokens must agree with the lexer's:
//   * no token of the grammar reaches over the beginning or the end of a token of the lexer;
//   * the scopes say what the lexer's kind says (a reserved word is reserved, a tag is a tag, a
//     denotation is that denotation, a symbol is that symbol);
//   * what the lexer passes over and is not blank is comment (or the prose of a Markdown source),
//     and nothing else is.
// This is a tool for the PA/68 repository, where the lexer can be built; `npm test` does not need it.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const engines = require('./lib/engines')
const { hasScope, spans } = require('./lib/check')

// the reserved words of the lexer's table, with the scope the grammar gives each
const reserved = {
  BEGIN: 'keyword.control.block', END: 'keyword.control.block',
  IF: 'keyword.control.conditional', THEN: 'keyword.control.conditional', ELIF: 'keyword.control.conditional',
  ELSE: 'keyword.control.conditional', FI: 'keyword.control.conditional',
  CASE: 'keyword.control.case', IN: 'keyword.control.case', OUSE: 'keyword.control.case',
  OUT: 'keyword.control.case', ESAC: 'keyword.control.case',
  FOR: 'keyword.control.loop', FROM: 'keyword.control.loop', BY: 'keyword.control.loop', TO: 'keyword.control',
  WHILE: 'keyword.control.loop', DO: 'keyword.control.loop', OD: 'keyword.control.loop',
  PAR: 'keyword.control.parallel', GO: 'keyword.control.flow', GOTO: 'keyword.control.flow', EXIT: 'keyword.control.flow',
  SKIP: 'constant.language.skip', NIL: 'constant.language.nil', EMPTY: 'constant.language.empty',
  TRUE: 'constant.language.boolean', FALSE: 'constant.language.boolean',
  MODE: 'storage.type.mode', PROC: 'storage.type.proc', OP: 'storage.type.operator', PRIO: 'storage.type.priority',
  REF: 'storage.modifier.reference', STRUCT: 'storage.type.struct', UNION: 'storage.type.union',
  FLEX: 'storage.modifier.flex', LONG: 'storage.modifier.size', SHORT: 'storage.modifier.size',
  HEAP: 'storage.modifier.generator', LOC: 'storage.modifier.generator',
  INT: 'storage.type.standard', REAL: 'storage.type.standard', BOOL: 'storage.type.standard',
  CHAR: 'storage.type.standard', VOID: 'storage.type.standard',
  OF: 'keyword.operator.word', AT: 'keyword.operator.word', IS: 'keyword.operator.word', ISNT: 'keyword.operator.word',
  MODULE: 'storage.type.module', DEF: 'keyword.control.module', FED: 'keyword.control.module',
  POSTLUDE: 'keyword.control.module', PUB: 'storage.modifier.pub', ACCESS: 'keyword.control.import',
  NEST: 'keyword.other.nest',
  DPAR: 'keyword.control.parallel', ASYNC: 'keyword.control.parallel', AWAIT: 'keyword.operator.word',
  SNAPSHOT: 'keyword.operator.word', FUT: 'storage.modifier.future', PURE: 'storage.modifier.pure'
}

// what a bold word that the lexer does not reserve may be for the grammar
const indication = ['entity.name.type', 'entity.name.function.operator', 'entity.name.module',
  'keyword.operator.word', 'storage.type.standard', 'support.type', 'constant.other.language', 'keyword.control.as']
// what a tag may be
const tag = ['support.function', 'support.constant', 'support.variable', 'entity.name.function', 'entity.name.label']

const symbol = {
  '(': ['punctuation.section.parens.begin'], ')': ['punctuation.section.parens.end'],
  '[': ['punctuation.section.brackets.begin'], ']': ['punctuation.section.brackets.end'],
  ',': ['punctuation.separator.comma'], ';': ['punctuation.separator.semicolon'],
  ':': ['punctuation.separator.colon', 'punctuation.separator.label'],
  ':=': ['keyword.operator.assignment'], '=': ['keyword.operator.equals', 'entity.name.function.operator'],
  ':=:': ['keyword.operator.identity'], ':/=:': ['keyword.operator.identity'],
  '@': ['keyword.operator.at'], '|': ['keyword.control.choice.brief'], '|:': ['keyword.control.choice.brief'],
  operator: ['keyword.operator', 'entity.name.function.operator'],
  '$open': ['punctuation.definition.string.begin'], '$close': ['punctuation.definition.string.end'],
  '$letter': ['constant.other.placeholder.format'], '$digits': ['constant.numeric.replicator'],
  '$sign': ['constant.other.placeholder.format'], '$point': ['constant.other.placeholder.format'],
  '$comma': ['punctuation.separator.comma'],
  '$(': ['punctuation.section.group.begin'], '$)': ['punctuation.section.group.end'],
  '$unit(': ['punctuation.section.embedded.begin'], '$unit)': ['punctuation.section.embedded.end']
}
const denotation = {
  int: 'constant.numeric.integer', real: 'constant.numeric.real', bits: 'constant.numeric.bits',
  char: 'string.quoted.double.character', string: 'string.quoted.double', '$string': 'string.quoted.double',
  pragmat: 'meta.preprocessor.pragmat'
}

// the lexer's dump as tokens { line, column, offset, kind, slice } (lines and columns from 0); the slice
// is found in the text itself, since a slice may hold the "|" that ends it in the dump
function lexerTokens (lexer, options, file, text, lineStart) {
  const run = spawnSync(lexer, options.concat([file]), { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (run.error) throw run.error
  if (run.status !== 0 || run.stderr !== '') return null
  const out = run.stdout
  const tokens = []
  const head = /^(\d+):(\d+) (\S+)(?: \|)?/
  const rows = out.split('\n')
  for (let i = 0; i < rows.length; i++) {
    const m = head.exec(rows[i])
    if (!m) continue
    if (m[3] === 'eof') break
    const line = Number(m[1]) - 1
    const column = Number(m[2]) - 1
    const offset = lineStart[line] + column
    let rest = rows[i].slice(m[0].length)
    let length = -1
    for (;;) {
      for (let k = rest.lastIndexOf('|'); k >= 0 && length < 0; k = rest.lastIndexOf('|', k - 1)) {
        const after = rest.slice(k + 1)
        if ((after === '' || after.startsWith(' =')) && text.startsWith(rest.slice(0, k), offset)) length = k
        if (k === 0) break
      }
      if (length >= 0 || i + 1 >= rows.length) break
      rest += '\n' + rows[++i]   // a slice over a line end goes on in the next row of the dump
    }
    tokens.push({ line, column, offset, kind: m[3], slice: length < 0 ? null : rest.slice(0, length) })
  }
  return tokens
}

// the scopes a token has of its own: those after the innermost program text (the unit of a format
// text is program text inside a string)
function own (scopes) {
  let last = 0
  scopes.forEach((x, k) => { if (/^(source|text)\./.test(x)) last = k })
  return scopes.slice(last + 1)
}

function expectation (t) {
  if (t.kind in denotation) return { all: [denotation[t.kind]] }
  if (t.kind === 'tag') return { one: tag, plain: true }
  if (t.kind === 'boldtag') return { one: indication, whole: true }
  if (t.kind in symbol) return { one: symbol[t.kind], whole: true }
  if (t.slice in symbol) return { one: symbol[t.slice], whole: true }   // IS and ISNT written as symbols
  const starred = /^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*$/.exec(t.slice)   // a bold word of a Markdown source
  const word = starred ? starred[1].toUpperCase() : t.slice
  if (word in reserved) return { one: [reserved[word]], whole: true }
  return null
}

async function compare (engine, lexer, options, file, verbose) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
  const source = text.split('\n')
  const lineStart = []
  source.reduce((at, l) => { lineStart.push(at); return at + l.length + 1 }, 0)
  const scope = /\.a68\.md$/.test(file) || /^```markdown\s*$/.test(source[0]) ? 'text.markdown.algol68' : 'source.algol68'
  const stream = lexerTokens(lexer, options, file, text, lineStart)
  if (stream === null) return null
  const { lines, depth } = await engine.tokenize(scope, text)
  const rows = lines.map(spans)
  const problems = []
  const at = (line, column) => path.basename(file) + ':' + (line + 1) + ':' + (column + 1) + ': '
  const note = (t, what) => problems.push(at(t.line, t.column) + t.kind + ' |' + (t.slice || '').split('\n')[0] + '| ' + what)
  const covered = new Uint8Array(text.length + 1)   // the characters that belong to a token of the lexer
  let compared = 0
  for (const t of stream) {
    if (t.slice === null) { note(t, 'is not where the lexer says'); continue }
    covered.fill(1, t.offset, t.offset + t.slice.length)
    if (t.slice.includes('\n')) continue   // a tag or a pragmat over a line end: nothing to compare with
    const from = t.column
    const to = t.column + t.slice.length
    const want = expectation(t)
    if (!want) { note(t, 'is ' + t.kind + ' for the lexer; the grammar knows no such spelling of it'); continue }
    compared++
    const over = rows[t.line].filter(s => s.end > from && s.start < to).map(s => Object.assign({}, s, { scopes: own(s.scopes) }))
    const shown = over.map(s => JSON.stringify(s.value) + ' ' + s.scopes.join(' ')).join(' | ')
    if (over.length === 0 || over[0].start < from || over[over.length - 1].end > to) {
      note(t, 'is not bounded by the grammar: ' + shown)
    } else if (over.some(s => hasScope(s.scopes, 'comment'))) {
      note(t, 'is comment for the grammar')
    } else if (want.whole && over.length !== 1) {
      note(t, 'is cut by the grammar: ' + shown)
    } else if (want.all && !over.every(s => want.all.every(w => hasScope(s.scopes, w)))) {
      note(t, 'lacks ' + want.all.join(' ') + ': ' + shown)
    } else if (want.one) {
      const named = over.every(s => want.one.some(w => hasScope(s.scopes, w)))
      const plain = want.plain && over.every(s => s.scopes.every(x => x.startsWith('meta.')))
      if (!named && !plain) note(t, 'is none of ' + want.one.join(', ') + ': ' + shown)
    }
  }
  // the rest is blank or comment, and no comment lies on a token
  let comment = 0
  rows.forEach((row, n) => {
    for (const s of row) {
      // comment, or the prose and the fences of a Markdown source
      const isComment = hasScope(own(s.scopes), 'comment') || !s.scopes.some(x => x.startsWith('source.'))
      for (let k = s.start; k < s.end; k++) {
        const inToken = covered[lineStart[n] + k] === 1
        if (isComment) comment++
        if (isComment && inToken) {
          problems.push(at(n, k) + 'a token of the lexer is comment for the grammar')
          break
        }
        if (!isComment && !inToken && !/\s/.test(source[n][k])) {
          problems.push(at(n, k) + '|' + s.value + '| is passed over by the lexer and is no comment for the grammar')
          break
        }
      }
    }
  })
  if (depth !== 1) problems.push(path.basename(file) + ': the grammar ends inside a construct (depth ' + depth + ')')
  if (verbose) for (const p of problems.slice(0, 12)) console.log('  ' + p)
  return { compared, comment, problems }
}

const lexerOptions = ['--gnu', '--extended', '--point', '--supper']

async function main () {
  const args = process.argv.slice(2)
  let lexer = process.env.PA68LEX
  let engineName = 'vscode-textmate'
  let verbose = false
  const options = ['--extended']
  const files = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lexer') lexer = args[++i]
    else if (args[i] === '--engine') engineName = args[++i]
    else if (args[i] === '--option') options.push(args[++i])
    else if (args[i] === '--verbose') verbose = true
    else files.push(args[i])
  }
  if (!lexer || files.length === 0) {
    console.error('usage: node test/lexer-diff.js --lexer PATH/pa68lex [--engine vscode-textmate|first-mate] [--option OPT]... [--verbose] FILE ...')
    process.exit(2)
  }
  const engine = await engines.load(engineName)
  let compared = 0
  let comment = 0
  let differing = 0
  let failed = 0
  let other = 0
  for (const file of files) {
    const flagFile = file.replace(/\.a68(\.md)?$/, '') + '.flags'
    const flags = fs.existsSync(flagFile) ? fs.readFileSync(flagFile, 'utf8').split(/\s+/).filter(f => lexerOptions.includes(f)) : []
    const all = options.concat(flags.filter(f => !options.includes(f)))
    if (all.includes('--point') || all.includes('--supper')) {
      if (verbose) console.log('SKIP ' + file + ': another stropping regime')
      other++
      continue
    }
    const r = await compare(engine, lexer, all, file, verbose)
    if (r === null) {
      if (verbose) console.log('SKIP ' + file + ': the lexer finds errors')
      failed++
      continue
    }
    compared += r.compared
    comment += r.comment
    if (r.problems.length) {
      differing++
      console.log('DIFF ' + file + ': ' + r.problems.length + (verbose ? '' : ' (first: ' + r.problems[0] + ')'))
    }
  }
  console.log(engine.name + ': ' + files.length + ' files, ' + compared + ' tokens of the lexer compared, ' + comment +
    ' characters of comment, ' + differing + ' files differ, ' + failed + ' files with lexical errors and ' + other +
    ' files in another stropping regime passed over')
  process.exit(differing ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(2) })
