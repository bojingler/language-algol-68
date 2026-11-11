'use strict'
// The spec of the package for Atom and Pulsar (run with `atom --test spec` or `pulsar --test spec`,
// or from the editor: View > Developer > Run Package Specs).  The scope assertions are those of
// test/cases.js, which the Node.js runner of the package checks as well.

const { checkCase } = require('../test/lib/check')
const cases = require('../test/cases')

describe('language-algol-68', () => {
  beforeEach(() => {
    waitsForPromise(() => atom.packages.activatePackage('language-algol-68'))
    // the Markdown grammar of the editor, into which the fenced blocks are injected
    waitsForPromise(() => atom.packages.activatePackage('language-gfm').catch(() => null))
  })

  it('provides the grammars', () => {
    const algol68 = atom.grammars.grammarForScopeName('source.algol68')
    expect(algol68).toBeTruthy()
    expect(algol68.name).toBe('ALGOL 68')
    const markdown = atom.grammars.grammarForScopeName('text.markdown.algol68')
    expect(markdown).toBeTruthy()
    expect(markdown.name).toBe('ALGOL 68 (Markdown)')
    expect(atom.grammars.grammarForScopeName('source.gfm.algol68')).toBeTruthy()
  })

  it('selects a grammar by the name of the file', () => {
    expect(atom.grammars.selectGrammar('program.a68', '').scopeName).toBe('source.algol68')
    expect(atom.grammars.selectGrammar('program.a68.md', '').scopeName).toBe('text.markdown.algol68')
  })

  it('selects the Markdown source form by the first line', () => {
    expect(atom.grammars.selectGrammar('program', '```markdown\n# Title\n').scopeName).toBe('text.markdown.algol68')
  })

  describe('the scopes', () => {
    for (const c of cases) {
      it('hold where ' + c.name, () => {
        const grammar = atom.grammars.grammarForScopeName(c.grammar || 'source.algol68')
        if (!grammar) return   // the Markdown grammar of the editor is not installed
        expect(checkCase(c, grammar.tokenizeLines(c.text))).toEqual([])
      })
    }
  })
})
