#!/usr/bin/env node
'use strict'
// Which rule set the grammar chooses for each file: capitals, small letters, or none (read as
// capitals without a decision).  README, "Capitals or small letters".
//
//   node test/regime.js [--engine NAME] [--expect upper|supper] [--upper-if TEXT] [--list] FILE.a68 ...
//
// --expect names what every file is; --upper-if TEXT says that a file whose text holds TEXT is in
// capitals and every other file in small letters (GCC's test suite: -fstropping=upper).  With either,
// the files the grammar reads otherwise are counted and, with --list, named.  The decision of the
// reference scanner (test/lib/reference.js), which applies the same rule by other means, is compared
// for every file.

const fs = require('fs')
const engines = require('./lib/engines')
const reference = require('./lib/reference')

async function main () {
  const args = process.argv.slice(2)
  let engineName = 'vscode-textmate'; let expect = null; let upperIf = null; let list = false
  const files = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--engine') engineName = args[++i]
    else if (args[i] === '--expect') expect = args[++i]
    else if (args[i] === '--upper-if') upperIf = args[++i]
    else if (args[i] === '--list') list = true
    else files.push(args[i])
  }
  if (files.length === 0) { console.error('usage: node test/regime.js [--engine NAME] [--expect upper|supper] [--upper-if TEXT] [--list] FILE ...'); process.exit(2) }
  const engine = await engines.load(engineName)
  const count = { upper: 0, supper: 0, none: 0 }
  let wrong = 0; let undecided = 0; let differs = 0; let known = 0
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
    const { lines } = await engine.tokenize('source.algol68', text)
    const all = lines.flat()
    const scopes = all.length ? all[all.length - 1].scopes : []
    const got = scopes.some(s => s.startsWith('meta.stropping.supper')) ? 'supper' : scopes.some(s => s.startsWith('meta.stropping.upper')) ? 'upper' : 'none'
    count[got]++
    if (reference.decide(text).regime !== got) { differs++; if (list) console.log('DIFFERS from the reference rule: ' + file) }
    const is = expect || (upperIf !== null ? (text.includes(upperIf) ? 'upper' : 'supper') : null)
    if (is) {
      known++
      // an undecided file is read as capitals: right for a capitals source, a loss of colour for a small-letter one
      if (got === 'none') { if (is === 'supper') { undecided++; if (list) console.log('undecided, in small letters: ' + file) } } else if (got !== is) { wrong++; if (list) console.log('read as ' + got + ', is ' + is + ': ' + file) }
    }
  }
  console.log(engine.name + ': ' + files.length + ' files: capitals ' + count.upper + ', small letters ' + count.supper + ', no decision ' + count.none +
    (known ? '; of ' + known + ' files whose stropping is known: ' + wrong + ' read the wrong way, ' + undecided + ' in small letters left undecided' : '') +
    '; ' + differs + ' differ from the reference rule')
  process.exit(wrong || differs ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(2) })
