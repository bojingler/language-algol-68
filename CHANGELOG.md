# Changelog

## 0.1.0

The first version.

* `source.algol68`: ALGOL 68 as the Revised Report defines it, in UPPER stropping: bold words
  and tags, the comment forms (`# … #`, `CO … CO`, `COMMENT … COMMENT`, `¢ … ¢`, nesting
  `{ … }`, `NOTE … ETON`), pragmats, integral, real, bits, character and string denotations,
  format texts with their units, the symbols and operators, brief choice clauses, labels and
  jumps, the names that `MODE`, `PROC`, `OP` and `PRIO` declare, the identifiers of the standard
  prelude.
* The module facility (`MODULE`, `DEF`, `POSTLUDE`, `FED`, `PUB`, `ACCESS`, `NEST`) and the
  deterministic parallel extensions of PA/68 (`DPAR`, `ASYNC`, `AWAIT`, `SNAPSHOT`, `FUT`,
  `PURE`).
* `text.markdown.algol68`: the Markdown source form of PA/68 (`*.a68.md`).
* Fenced `algol68` blocks in Markdown documents.
* Settings for comments, indentation, folding and bracket pairs; 40 snippets.
* Samples, a spec for the editor, and tests that run under Node.js on two tokenizers.
* A repository of its own (it began as a directory of the PA/68 compiler's repository).
