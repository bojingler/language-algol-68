'use strict'
// A stand-in for the Markdown grammar of Atom and Pulsar (language-gfm, scope source.gfm), which is
// not part of this package: enough of it to test the injection of fenced ALGOL 68 blocks.  Its
// one rule for fenced blocks is the generic one that the injected rule has to win against.
module.exports = {
  scopeName: 'source.gfm',
  name: 'GitHub Markdown (stand-in for tests)',
  fileTypes: [],
  patterns: [
    {
      name: 'markup.raw.gfm',
      begin: '^\\s*(`{3,}|~{3,}).*$',
      beginCaptures: { 0: { name: 'support.gfm' } },
      end: '^\\s*\\1\\s*$',
      endCaptures: { 0: { name: 'support.gfm' } }
    },
    { name: 'markup.bold.gfm', match: '\\*\\*[^*]+\\*\\*' }
  ]
}
