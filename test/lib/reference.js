'use strict'
// What every character of a source is, found by a scanner written by hand from the rules of the
// lexical level (README, "What is recognised"): program text, comment, string denotation, pragmat,
// format text or the prose of a Markdown source.  The samples are tokenized with the grammar and
// compared with this character by character, so that a slip in a regular expression which lets a
// comment or a string run on (or end early) shows as a difference.

const CODE = 0
const COMMENT = 1
const STRING = 2
const PRAGMAT = 3
const FORMAT = 4
const PROSE = 5
const names = ['program text', 'comment', 'string', 'pragmat', 'format text', 'prose']

const isUpper = c => c >= 'A' && c <= 'Z'
const isLower = c => c >= 'a' && c <= 'z'
const isDigit = c => c >= '0' && c <= '9'
const isWord = c => c !== undefined && (isUpper(c) || isLower(c) || isDigit(c) || c === '_')

function classify (text, markdown) {
  const n = text.length
  const cls = new Uint8Array(n)
  const mark = (from, to, what) => cls.fill(what, from, Math.min(to, n))

  const wordEnd = i => { while (isWord(text[i])) i++; return i }
  // a bold word that may open or close a comment or pragmat: capitals not preceded by a word character
  const boldAt = i => isUpper(text[i]) && !isWord(text[i - 1])
  // in a Markdown source: **word** after no letter, digit or closing bracket; yields the index after it, or 0
  const starAt = i => {
    if (!markdown || text[i] !== '*' || text[i + 1] !== '*') return 0
    const c = text[i + 2]
    const before = text[i - 1]
    if (c === undefined || !(isUpper(c) || isLower(c))) return 0
    if (before !== undefined && (isUpper(before) || isLower(before) || isDigit(before) || before === ')' || before === ']')) return 0
    const e = wordEnd(i + 2)
    return text[e] === '*' && text[e + 1] === '*' ? e + 2 : 0
  }
  // the next occurrence of one of the words (in capitals, or in asterisks in any case) from i:
  // { start, end, word } or null
  const findWord = (i, words) => {
    while (i < n) {
      const s = starAt(i)
      if (s) {
        const w = text.slice(i + 2, s - 2).toUpperCase()
        if (words.includes(w)) return { start: i, end: s, word: w }
        i = s
      } else if (boldAt(i)) {
        const e = wordEnd(i)
        const w = text.slice(i, e)
        if (words.includes(w)) return { start: i, end: e, word: w }
        i = e
      } else i++
    }
    return null
  }
  const lineEnd = i => { const e = text.indexOf('\n', i); return e < 0 ? n : e }

  // a string denotation from the quote at i; yields the index after it
  const string = i => {
    let j = i + 1
    const stop = lineEnd(i)
    while (j < stop) {
      if (text[j] === '"') {
        if (text[j + 1] === '"') j += 2
        else { j++; break }
      } else j++
    }
    mark(i, j, STRING)
    return j
  }
  const delimited = (i, closer, what) => {
    const e = text.indexOf(closer, i + 1)
    const j = e < 0 ? n : e + 1
    mark(i, j, what)
    return j
  }
  // a brace comment nests; a string denotation inside it is passed over, even over line ends
  const brace = i => {
    let depth = 1
    let j = i + 1
    while (depth > 0 && j < n) {
      const c = text[j]
      if (c === '{') { depth++; j++ } else if (c === '}') { depth--; j++ } else if (c === '"') {
        j++
        while (j < n && (text[j] !== '"' || text[j + 1] === '"')) j += text[j] === '"' ? 2 : 1
        j++
      } else j++
    }
    mark(i, j, COMMENT)
    return j
  }
  // a comment or pragmat in bold from the word at [i, e)
  const bold = (i, e, word, what) => {
    const close = findWord(e, [word])
    const j = close ? close.end : n
    mark(i, j, what)
    return j
  }
  const note = (i, e) => {
    let depth = 1
    let j = e
    while (depth > 0) {
      const w = findWord(j, ['NOTE', 'ETON'])
      if (!w) { j = n; break }
      depth += w.word === 'NOTE' ? 1 : -1
      j = w.end
    }
    mark(i, j, COMMENT)
    return j
  }
  // NOTE is a comment symbol where its line shows it: nothing follows it, or an ETON does
  const noteOpens = e => {
    const rest = text.slice(e, lineEnd(e))
    if (/^[ \t]*$/.test(rest)) return true
    const w = findWord(e, ['ETON'])
    return w !== null && w.start < lineEnd(e)
  }

  // a format text from the $ at i; yields the index after its closing $
  const format = i => {
    let j = i + 1
    mark(i, j, FORMAT)
    while (j < n) {
      const c = text[j]
      if (c === '$') { mark(j, j + 1, FORMAT); return j + 1 }
      if (c === '"') j = string(j)
      else if (c === '#') j = delimited(j, '#', COMMENT)
      else if ((c === 'n' || c === 'f' || c === 'g') && /^[ \t]*\(/.test(text.slice(j + 1, lineEnd(j)))) {
        const open = text.indexOf('(', j)
        mark(j, open + 1, FORMAT)
        j = code(open + 1, true)        // the unit; stops at its closing parenthesis
        mark(j, j + 1, FORMAT)
        j++
      } else {
        mark(j, j + 1, FORMAT)
        j++
      }
    }
    return j
  }

  // a line of up to three blanks and three backquotes; yields the index after the backquotes, or -1
  const fenceAt = i => {
    let k = i
    while (k < i + 3 && text[k] === ' ') k++
    return text.startsWith('```', k) ? k + 3 : -1
  }
  const codeFence = f => {
    const m = /^[ \t]*([A-Za-z0-9]*)/.exec(text.slice(f, lineEnd(f)))
    return ['', 'a68', 'algol68', 'pa68'].includes(m[1])
  }
  // prose from the line start i up to the line after the next fence that opens program text; the
  // line at i is the marker line of the document (first), the fence that closed a block, or prose
  const prose = (i, first) => {
    let j = i
    if (first) {
      if (fenceAt(0) >= 0 && /^[ \t]*markdown[ \t]*$/.test(text.slice(fenceAt(0), lineEnd(0)))) j = lineEnd(0) + 1
    } else j = lineEnd(i) + 1
    while (j < n) {
      const f = fenceAt(j)
      if (f < 0) j = lineEnd(j) + 1
      else if (codeFence(f)) { j = lineEnd(j) + 1; break } else {
        j = lineEnd(j) + 1
        while (j < n && fenceAt(j) < 0) j = lineEnd(j) + 1
        j = lineEnd(j) + 1
      }
    }
    mark(i, j, PROSE)
    return Math.min(j, n)
  }

  // program text from i; inside the unit of a format text it stops at the closing parenthesis
  function code (i, unit) {
    let depth = 0
    while (i < n) {
      const c = text[i]
      const star = starAt(i)
      if (c === '\n') {
        i++
        if (markdown && !unit && fenceAt(i) >= 0) i = prose(i, false)
      } else if (c === '#') i = delimited(i, '#', COMMENT)
      else if (c === '¢') i = delimited(i, '¢', COMMENT)
      else if (c === '{') i = brace(i)
      else if (c === '"') i = string(i)
      else if (c === '$') i = format(i)
      else if (star || isUpper(c)) {
        const e = star || wordEnd(i)
        const w = star ? text.slice(i + 2, e - 2).toUpperCase() : text.slice(i, e)
        const opens = star || boldAt(i)
        if (opens && (w === 'CO' || w === 'COMMENT')) i = bold(i, e, w, COMMENT)
        else if (opens && (w === 'PR' || w === 'PRAGMAT')) i = bold(i, e, w, PRAGMAT)
        else if (opens && !star && w === 'NOTE' && noteOpens(e)) i = note(i, e)
        else i = e
      } else if (unit && c === '(') { depth++; i++ } else if (unit && c === ')') {
        if (depth === 0) return i
        depth--
        i++
      } else i++
    }
    return i
  }

  if (markdown) code(prose(0, true), false)
  else code(0, false)
  return cls
}

// the class the grammar gives a token: its innermost scope that names one
function classOf (scopes) {
  for (let k = scopes.length - 1; k >= 0; k--) {
    const s = scopes[k]
    if (s.startsWith('comment')) return COMMENT
    if (s.startsWith('string.quoted')) return STRING
    if (s.startsWith('meta.preprocessor')) return PRAGMAT
    if (s.startsWith('source.algol68')) return CODE
    if (s.startsWith('string.other.format')) return FORMAT
    if (s.startsWith('text.markdown')) return PROSE
  }
  return CODE
}

module.exports = { classify, classOf, names, CODE, COMMENT, STRING, PRAGMAT, FORMAT, PROSE }
