'use strict'
// Scope assertions over tokenized lines; used by the Node.js runner and by the Atom spec.
//
// A case is { name, text, expect, grammar } with text the program (lines joined by "\n") and
// expect a list of [fragment, occurrence?, expectation, ...]:
//   fragment     a piece of one line of the text; occurrence (a number, 1 by default) selects
//                which of its occurrences in the text is meant
//   'a.b'        every character of the fragment lies in a token with the scope a.b or a.b.*
//   '!a.b'       no character of the fragment lies in such a token
//   '=a.b'       the fragment is exactly one token, and it has the scope a.b or a.b.*
//   'plain'      the fragment has no scope but the grammar's own (and those of the text around
//                a whole construct, such as source.algol68.embedded)

function hasScope (scopes, wanted) {
  return scopes.some(s => s === wanted || s.startsWith(wanted + '.'))
}

function locate (text, fragment, occurrence) {
  let at = -1
  for (let k = 0; k < occurrence; k++) {
    at = text.indexOf(fragment, at + 1)
    if (at < 0) return null
  }
  const line = text.slice(0, at).split('\n').length - 1
  const column = at - (text.lastIndexOf('\n', at - 1) + 1)
  return { line, column }
}

// the tokens of a line as { start, end, value, scopes }
function spans (tokens) {
  let at = 0
  return tokens.map(t => {
    const span = { start: at, end: at + t.value.length, value: t.value, scopes: t.scopes }
    at = span.end
    return span
  })
}

const structural = /^(source\.|text\.|meta\.)/

function checkCase (c, lines) {
  const failures = []
  for (const e of c.expect) {
    const fragment = e[0]
    const occurrence = typeof e[1] === 'number' ? e[1] : 1
    const wanted = e.slice(typeof e[1] === 'number' ? 2 : 1)
    const where = '"' + fragment + '"' + (occurrence > 1 ? ' (occurrence ' + occurrence + ')' : '')
    if (fragment.includes('\n')) { failures.push(where + ': a fragment lies in one line'); continue }
    const pos = locate(c.text, fragment, occurrence)
    if (!pos) { failures.push(where + ': not in the text'); continue }
    const row = spans(lines[pos.line] || [])
    const from = pos.column
    const to = pos.column + fragment.length
    const covering = row.filter(t => t.end > from && t.start < to)
    const shown = covering.map(t => JSON.stringify(t.value) + ' ' + t.scopes.join(' ')).join(' | ')
    for (const w of wanted) {
      let ok
      if (w === 'plain') {
        ok = covering.length > 0 && covering.every(t => t.scopes.every(s => structural.test(s)))
      } else if (w.startsWith('!')) {
        ok = covering.every(t => !hasScope(t.scopes, w.slice(1)))
      } else if (w.startsWith('=')) {
        ok = covering.length === 1 && covering[0].start === from && covering[0].end === to &&
          hasScope(covering[0].scopes, w.slice(1))
      } else {
        ok = covering.length > 0 && covering.every(t => hasScope(t.scopes, w))
      }
      if (!ok) failures.push(where + ': expected ' + w + ', found ' + shown)
    }
  }
  return failures
}

module.exports = { checkCase, hasScope, spans }
