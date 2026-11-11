# language-algol-68

ALGOL 68 in Atom and Pulsar: syntax highlighting, snippets and editor settings for the language
of the Revised Report, for the module facility and for the deterministic parallel extensions of
PA/68. Sources with bold words in capitals (`BEGIN`, `INT`: Algol 68 Genie, PA/68) and sources
with reserved words in small letters (`begin`, `int`: GNU Algol 68's default) are both read; the
grammar decides for every file which it is. The grammar is a TextMate grammar (scope
`source.algol68`, files `*.a68`), the kind GitHub's Linguist takes from `language-*` packages for
highlighting on github.com.

| Path | Contents |
|---|---|
| `grammars/algol68.cson` | the grammar `source.algol68` for `*.a68`: it decides between the two rule sets below |
| `grammars/algol68-upper.cson` | `source.algol68.upper`: bold words in capitals |
| `grammars/algol68-supper.cson` | `source.algol68.supper`: reserved words in small letters |
| `grammars/algol68-markdown.cson` | the grammar `text.markdown.algol68` for the Markdown source form of PA/68 (`*.a68.md`) |
| `grammars/algol68-gfm.cson` | ALGOL 68 in the fenced code blocks of Markdown documents (an injection into `source.gfm`) |
| `settings/` | comment symbols, indentation, folding, bracket pairs |
| `snippets/` | 40 snippets: clauses in full and brief form, declarations, modules, parallel clauses |
| `samples/` | programs for Linguist and for the tests |
| `spec/`, `test/` | the Atom spec and the tests that run under Node.js |
| `.github/workflows/` | the tests on GitHub Actions |

## Capitals or small letters

The Report distinguishes bold words (`begin`, `int`, a mode `node`) from identifiers by typeface
and leaves it to an implementation how a source that has one typeface does it (RR 9.4: the
representations). Two ways are in use, and a source file is written in one of them:

* **capitals**: a bold word is written in capitals or begins with one, `BEGIN INT n := 1; Node p`,
  and every small-letter word is an identifier: `in`, `to`, `mode`, `op`, `file` are ordinary
  names there, and programs use them (3,552 times in 106 source files of the PA/68 compiler). This is
  UPPER stropping: Algol 68 Genie, PA/68, GNU Algol 68 with `-fstropping=upper`.
* **small letters**: the reserved words are written `begin int n := 1`, a mode or operator the
  program declares begins with a capital (`Node`, `MAX`), and an identifier may not be spelled
  like a reserved word. This is GNU Algol 68's default (it calls it SUPPER stropping).

Colouring reserved words whatever their case would be wrong in the first kind (every `in` and
`to` a keyword) and colouring only capitals leaves the second kind without its reserved words.
So the grammar has two rule sets and **decides for each file**:

1. Only the **beginning of a line** is looked at, outside comments and strings. A grammar of
   regular expressions sees one line at a time and cannot know whether a word in the middle of a
   line stands in a comment or a string, and prose is full of `to`, `in`, `if`, `for`.
2. The first line that begins with a **reserved word in capitals** makes the rest of the file
   capitals.
3. The first line that begins **the way only a small-letter source does**, and has no reserved
   word in capitals on it, makes the rest small letters: `begin`; `if`, `for`, `while`, `case`
   before a word; a declaration (`int n := 3`, `ref Node p`, `long int k`, `proc f =`, `mode Node`,
   `op MAX`, `prio MAX`, `struct (`, `module Shapes`, `access Units`), also after an opening
   parenthesis (`(int n = 3; …`); `goto label`; `pr include`; GNU's pragmat `[[include "x"]]`.
4. Until one of the two happens, and in a file where neither does, lines are read as capitals.
5. A decision holds to the end of the file. Inside a Markdown document it holds to the end of
   the fenced block, and every block decides for itself.

Every token after the decision has the scope `meta.stropping.upper.algol68` or
`meta.stropping.supper.algol68`, so a theme, a snippet or a setting can tell the two apart; the
editor settings of this package do (brace comments and small-letter indentation rules in a
small-letter source).

### Where the decision goes wrong

Measured with `test/regime.js` on sources whose stropping is known: GCC's ALGOL 68 test suite
(804 files, 500 in capitals and 304 in small letters by their options), the 84 files of MCTS, 203 files of the
PA/68 compiler and its tests. Of these 1,091 files four are read the wrong way, all in GCC's test
suite: three tests that declare a mode named `BEGIN` on purpose, and a test of an error whose
text is in capitals although its options say small letters. Four small-letter files, programs of
one line, stay undecided. On what it decides, the small-letter rule set agrees token for token
with the lexer of the PA/68 compiler in its small-letter regime, except for constructs of GNU
Algol 68 that lexer does not know.

The cases, by kind:

* **A small-letter source read as capitals.** Its first line that begins with a reserved word
  begins with one in capitals: a mode or operator named like a reserved word (`mode BEGIN = int`),
  or a first line such as `INT` used as an indication. Everything after is then coloured by the
  capitals rules: small-letter reserved words are plain, capital words are keywords.
* **A capitals source read as small letters.** Before any line begins with a reserved word in
  capitals, a line begins with an identifier that looks like a small-letter declaration: a tag
  `mode` or `op` followed by a capital word that is not reserved (`op MAX b` as an expression), a
  tag with blanks such as `int count = 3` at the start of a line. Then identifiers like `in` and
  `to` are keywords for the rest of the file and capital words are mode indications. Programs
  begin with `BEGIN`, a declaration, a comment or a pragmat, so this takes an unusual first line;
  none of the 784 capitals files measured has one.
* **No decision.** A file that never begins a line with a reserved word (a program of one line in
  parentheses, a fragment for inclusion, a source in point or quote stropping): it is read as
  capitals. A capitals source loses nothing; a small-letter source keeps its comments, strings,
  denotations and operators and has no reserved word coloured.
* **Lines before the decision** are read as capitals. In a small-letter source a reserved word on
  such a line (in a line that begins with a comment, say) is not coloured.
* **A file in both.** A decision is never taken back. A source that includes text of the other
  kind, or a small-letter source with a section in capitals, is read by the first.
* **`co … co` in small letters.** GNU Algol 68 has brace comments only in this stropping; other
  compilers' small-letter sources write `co … co` and `comment … comment`. The words open a
  comment only where a blank and a letter, digit or quote follow, or the line ends: a tag named
  `co` before a bold operator (`co OVER 2`) or at the end of a line is taken for the comment
  symbol and swallows the text up to the next `co`.
* **`pr` in small letters.** GNU writes a pragmat `[[ … ]]` there and `pr`, `pragmat` are tags;
  other sources write `pr … pr`. `pr` opens a pragmat only before a blank and a letter or a quote.
* **Markdown fences.** The decision ends at a line that begins with three backquotes or tildes,
  which is no ALGOL 68; such a line inside a file would end it too.
* **On GitHub** nothing can be done about a wrong decision. **In the editor** the two rule sets
  are grammars of their own, *ALGOL 68 (capitals)* and *ALGOL 68 (small letters)*: choose one by
  hand for a file that is read the wrong way.

## What is recognised

The grammar was written from the Revised Report (section 9.4 for the representations, section
10 for the standard prelude) and from the lexer of the PA/68 compiler and its specification.

**Bold words and tags.** A bold word is a capital letter followed by letters of either case,
digits and underscores: `BEGIN`, `INT`, `Node`, `LexResult`. A tag is a small letter followed by
small letters, digits and underscores, and it goes on over blanks, as the Report allows:
`max_value`, `x2`, `max int`. Reserved words, standard modes and standard operators are known in
capitals; any other bold word is an indication. PA/68's convention writes the modes a program
declares with a capital and small letters (`Node`), which this reading keeps whole.

**Comments.** `# … #`, `CO … CO`, `COMMENT … COMMENT` and `¢ … ¢` end at the next occurrence
of the symbol that opened them and do not nest. `CO` inside a tag (`co`) or a longer bold word
(`COMPL`, `DISCO`) is no comment symbol. Brace comments `{ … }` (PA/68, GNU Algol 68) nest, and
a string denotation inside one is passed over. `NOTE … ETON` (GNU Algol 68) nests; see the
differences below.

**Pragmats.** `PR … PR` and `PRAGMAT … PRAGMAT`.

**Denotations.** Integral denotations; real denotations with a point, an exponent (`e`, `E`, `\`,
`⏨`) or both; bits denotations with the radices 2, 4, 8 and 16 (`2r1010`, `8r17`, `16rff`);
blanks between the digits (`1 000 000`, `16r dead beef`). String and character denotations: a
quote doubled inside a denotation is one quote, a denotation of one item is a character
denotation, a denotation ends with its line. The string breaks of the Standard Hardware
Representation are escapes (`'n`, `'t`, `'r`, `'f`, `''`, `'(u00e9, U0001F600)`).

**Format texts.** `$ … $` with frames, insertions, replicators and collections; the units of a
dynamic replicator `n (…)`, a general pattern `g (…)` and a format pattern `f (…)` are program
text again.

**Symbols.** The becomes symbol `:=`, the identity relators `:=:` and `:/=:`, the equals symbol
`=`, the operators of one or two marks (`+ - * / % ** %* +* < <= > >= /= & ~ ^`), the operators
that end in `:=` or `=:` (`+:=`, `%*:=`, `+=:`), the bars of brief choice clauses (`|`, `|:`), `@`,
and the marks of the reference language (`≤ ≥ ≠ × ÷ ∧ ∨ ¬ ↑ ↓ ⌊ ⌈ ⊥`).

**Declarations.** `MODE`, `PROC`, `OP`, `PRIO` and `MODULE` with the first name they declare;
labels and the labels of `GOTO` and `GO TO`.

**Standard prelude.** The identifiers of RR 10: `print`, `read`, `whole`, `fixed`, `float`,
`newline`, `sqrt`, `max int`, `pi`, `stand out`, `on logical file end` and the others, with
`long` and `short` before those that have lengths, and with blanks or underscores between their
words (`max int`, `max_int`, `maxint`). A routine with parameters is taken only where it is
called; inside a longer tag (`print line`, `sqrt2`) the letters are that tag.

**PA/68.** `DPAR`, `ASYNC`, `AWAIT`, `SNAPSHOT`, `FUT`, `PURE`; `MODULE`, `DEF`, `POSTLUDE`,
`FED`, `PUB`, `ACCESS` with the module indicants of its list, `NEST` with its language; the
fixed-width modes (`INT32`, `BITS64`, `REAL80`).

**The Markdown source form of PA/68.** In a file `*.a68.md` (or one whose first line is three
backquotes and `markdown`) the fenced code blocks without a language or with `a68`, `algol68` or
`pa68` are the program, the prose is given to the editor's Markdown grammar, and a word between
two pairs of asterisks is a bold word: `**begin**` is `BEGIN`.

**Markdown documents.** In Atom, a fenced block that names `algol68`, `a68` or `pa68` in a
Markdown document is highlighted as ALGOL 68.

### Scopes

| Construct | Scope |
|---|---|
| `BEGIN END`; `IF THEN ELIF ELSE FI`; `CASE IN OUSE OUT ESAC` | `keyword.control.block`, `.conditional`, `.case` |
| `FOR FROM BY TO WHILE DO OD`; `EXIT GOTO GO`; `PAR DPAR ASYNC` | `keyword.control.loop`, `.flow`, `.parallel` |
| `DEF FED POSTLUDE`; `ACCESS` | `keyword.control.module`, `keyword.control.import` |
| `INT REAL BOOL CHAR FORMAT VOID COMPL BITS BYTES STRING SEMA FILE CHANNEL` | `storage.type.standard` |
| `STRUCT UNION PROC MODE OP PRIO MODULE` | `storage.type.struct`, `.union`, `.proc`, `.mode`, `.operator`, `.priority`, `.module` |
| `LONG SHORT`; `REF`; `FLEX`; `HEAP LOC`; `PUB`; `PURE`; `FUT` | `storage.modifier.size`, `.reference`, `.flex`, `.generator`, `.pub`, `.pure`, `.future` |
| `TRUE FALSE`, `NIL`, `EMPTY`, `SKIP` | `constant.language.boolean`, `.nil`, `.empty`, `.skip` |
| `OF AT IS ISNT`, `ABS AND MOD OVER UPB LWB ELEM …`, `AWAIT SNAPSHOT` | `keyword.operator.word` |
| `:=`; `+:=` and its kin; `:=:` `:/=:`; `=` | `keyword.operator.assignment`, `.assignment.compound`, `.identity`, `.equals` |
| other operators | `keyword.operator.arithmetic`, `.comparison`, `.logical`, `.other` |
| `\|`, `\|:` | `keyword.control.choice.brief` |
| the name a `MODE`, `PROC`, `OP`/`PRIO`, `MODULE` declares | `entity.name.type.mode`, `entity.name.function`, `entity.name.function.operator`, `entity.name.module` |
| another bold word | `entity.name.type`; directly after an operand `keyword.operator.word` |
| a label and the label of a jump | `entity.name.label` |
| prelude identifiers | `support.function.transput`, `.math`, `.conversion`; `support.constant`; `support.variable` |
| denotations | `constant.numeric.integer`, `.real`, `.bits`; `string.quoted.double`, `string.quoted.double.character` |
| escapes in a string | `constant.character.escape.quote`, `constant.character.escape.break` |
| a format text; its items | `string.other.format`; `constant.other.placeholder.format`, `constant.numeric.replicator`; the units `meta.embedded.unit` with `source.algol68.embedded` |
| comments | `comment.block.hash`, `.cent`, `.bold`, `.bold.note`, `.brace` |
| a pragmat and its symbols | `meta.preprocessor.pragmat`, `keyword.control.directive.pragmat` |
| a tag | no scope |
| every token after the decision on capitals or small letters | `meta.stropping.upper`, `meta.stropping.supper` (around the scopes above) |

Every scope ends in `.algol68`.

### Where the grammar and a compiler differ

A grammar of regular expressions reads a line at a time and knows no declarations. It decides
as follows where a compiler knows more.

* **Stropping.** Capitals (UPPER) and reserved small letters (GNU's SUPPER), decided for each
  file as "Capitals or small letters" says, with the failures listed there. POINT and quote
  stropping are not recognised. The rest of this list is about sources in capitals unless it
  says otherwise.
* **Capitals.** Reserved words, standard operators and the comment and pragmat symbols are
  recognised in capitals. PA/68 folds the letters of a bold word (`Begin` is `BEGIN` there);
  the grammar takes `Begin` for an indication, and inside a `CO` or `COMMENT` comment the words
  `Co` and `Comment` of a sentence close nothing (in PA/68 they do).
* **The end of a bold word.** A bold word ends before the first character that is no letter,
  digit or underscore, as in PA/68: `UPBa` and the `I5` of `4I5` are single bold words.
  Compilers that end a bold word at a small letter or a digit read `UPB a` and `4 I 5`; write
  the blanks.
* **Indications.** A bold word the grammar does not know is an operator directly after an
  operand (`a MAX b`, `2 MAX n`, `"x" JOIN "y"`; a tag, a denotation, at most two blanks) and a
  mode indication everywhere else. An operator a program declares is therefore scoped as a mode
  indication when it has one operand (`NORM v`) or follows a bracket (`(a + b) MAX c`).
* **Lists of declarations.** `MODE`, `PROC`, `OP` and `PRIO` name the first thing they declare;
  the names after the commas of the same declaration are scoped as the text around them. An
  operator written without a blank before the `=` of its declaration (`+=`) is told apart only
  directly after `OP` or `PRIO` on the same line.
* **`NOTE … ETON`.** `NOTE` is an ordinary bold word in the Report's language and in PA/68. It
  opens a comment only where the line shows that it is one: an `ETON` follows on the same line,
  or `NOTE` is the last word of its line. A `NOTE` comment that begins with words on the line of
  `NOTE` and ends on a later line is not seen.
* **String breaks.** In a dialect without string breaks (Algol 68 Genie) an apostrophe before
  `n`, `t`, `r`, `f`, `'` or `(` inside a string is shown as an escape and is none (`"don't"`).
* **Labels.** A label is recognised at the beginning of a line and after `;` or `EXIT`. A tag
  that begins a continuation line and is followed by a colon (the lower bound of a trimmer, say)
  is taken for one.
* **Tags over line ends.** A tag may go on in the next line; the grammar reads each line's part
  by itself.
* **Profiles.** The extension words `DPAR`, `ASYNC`, `AWAIT`, `SNAPSHOT`, `FUT`, `PURE` and the
  module words are always reserved; in the Report profile of PA/68 and in other dialects a
  program may use them as indications.
* **Prelude identifiers** are recognised by their spelling; a program that declares its own
  `space` or `pi` sees it scoped as the prelude's.
* **Small letters.** A tag has no blanks there. A bold word directly after a reserved word is a
  mode indication (`ref Node`), after a tag or a denotation an operator. The apostrophe between
  two tags is GNU's selection (`re'z`). GNU's `word`, `andth`, `orel`, `andf`, `orf`, `thef`,
  `elsf` are reserved. `NOTE … ETON` is not known.
* **Not recognised:** the apostrophe as a brief `OF` in a capitals source; a line end inside a
  string denotation after a backslash (GNU Algol 68).

The tool `test/lexer-diff.js` compares the grammar with the PA/68 lexer token by token; the
differences it finds in the PA/68 sources are of the kinds above.

## Installing in Atom or Pulsar from a checkout

The package needs no build. Link the directory into the editor's packages and reload the window:

```
cd language-algol-68
apm link            # Atom; links into ~/.atom/packages
ppm link            # Pulsar (also `pulsar -p link`); links into ~/.pulsar/packages
```

or copy the directory to `~/.atom/packages/language-algol-68` (`~/.pulsar/packages/…`). Files
`*.a68` then open as *ALGOL 68* and files `*.a68.md` as *ALGOL 68 (Markdown)*. *ALGOL 68
(capitals)* and *ALGOL 68 (small letters)* are the two rule sets, for choosing by hand. `npm
install` is needed for the tests only.

Line comments are toggled with `# … #` in a capitals source and with `{ … }` in a small-letter
one. For PA/68 sources the brace comment is the safer choice too, since it nests; select it in
the editor's `config.cson`:

```cson
'.source.algol68':
  editor:
    commentStart: '{ '
    commentEnd: ' }'
```

The fenced blocks of Markdown documents are highlighted through the TextMate grammar
`source.gfm` of the editor; where the editor reads Markdown with a tree-sitter grammar, the
injection has no effect.

## Highlighting on GitHub

github.com highlights a file when [Linguist](https://github.com/github-linguist/linguist) knows
its language and has a grammar for it. Linguist as of 2026-11-11 has the language `ALGOL`
(extension `.alg`, grammar `source.algol60`) and nothing for ALGOL 68; `.a68` belongs to no
language there. Until Linguist has the language, `.a68` files are shown as plain text and do not
count in a repository's language statistics, whatever a repository does:

* `.gitattributes` can only name a language Linguist knows (`*.a68 linguist-language=…`), and
  the file is then highlighted with that language's grammar and counted as that language. No
  language there fits ALGOL 68; the entry `ALGOL` is ALGOL 60.
* A fenced block ` ```algol68 ` in a Markdown file on github.com is plain for the same reason.
* What a repository builds itself (documentation on GitHub Pages, say) can be highlighted with
  this grammar by any highlighter that reads TextMate grammars; `test/lib/engines.js` shows the
  few lines it takes with `vscode-textmate`.

What Linguist needs, by its `CONTRIBUTING.md`:

1. **A public repository for this package** under a licence Linguist accepts (MIT is one).
   Linguist adds the repository as a submodule, follows it with each of its releases, and takes
   every `.cson` file of its `grammars` directory: the three grammars here, of which
   `source.algol68` is the one a language uses.
2. **An entry in `lib/linguist/languages.yml`**, in alphabetical order (after `ALGOL`):

   ```yaml
   ALGOL 68:
     type: programming
     color: "#rrggbb"        # to be chosen, with a reason; optional, but strongly recommended
     aliases:
     - algol68
     - a68
     extensions:
     - ".a68"
     tm_scope: source.algol68
     ace_mode: text
   ```

   `language_id` is not written by hand: `script/update-ids` adds it. The aliases are what a
   fenced code block may name.
3. **The grammar:** `script/add-grammar https://github.com/bojingler/language-algol-68`. The script
   compiles the grammar and reports regular expressions that PCRE does not accept, unknown keys
   and includes of unknown grammars.
4. **Samples** in `samples/ALGOL 68/`, with their licence stated in the pull request. Linguist
   asks for real code and accepts no "hello world"; the files of `samples/` here are meant for
   that (`literate.a68.md` excepted, which is Markdown for Linguist).
5. **A pull request with Linguist's template**, including a search that shows the extension in
   use: `https://github.com/search?type=code&q=NOT+is%3Afork+path%3A*.a68+KEYWORDS`, with
   keywords of the language (`ESAC`, say) in place of `KEYWORDS`.

Linguist accepts a new extension only with wide use: at least 2000 files with it indexed on
GitHub in the last year, forks excluded, spread over many repositories and owners; it does not
accept "very new or hobby languages". Whether `.a68` reaches that is to be seen from the search
at the time of the proposal. A merged change shows on github.com with the next release of
Linguist that GitHub deploys.

The regular expressions keep to what Oniguruma and PCRE share, and the tests compile each of
them in both (PCRE through `grep -P`). The file names `*.a68.md` stay Markdown on GitHub.

## Samples

| File | Origin |
|---|---|
| `fractions.a68` | written for this package: the classic style of the Report (capitals, spaces inside tags); runs under Algol 68 Genie |
| `sieve.a68`, `wordcount.a68` | written for this package: reserved words in small letters; they compile and run with GNU Algol 68 |
| `texts.a68`, `kernels.a68`, `parallel.a68` | the PA/68 library (`rt/lib`): modules, `PURE PROC`, `DPAR FOR`, brace comments |
| `prog.a68`, `shapes.a68`, `units.a68` | the PA/68 tests of modules found by their names (`tests/mod`) |
| `extensions.a68` | PA/68's `tests/run/ext1.a68`: `DPAR`, `DPAR FOR`, `ASYNC`, `AWAIT`, `FUT`, a pragmat |
| `pingpong.a68` | PA/68's `tests/run/par_pingpong.a68`: the parallel clause and the semaphores of the Report |
| `formats.a68` | PA/68's `tests/transput/formats.a68`: format texts |
| `literate.a68.md` | PA/68's `tests/run/literate.a68.md`: the Markdown source form |

All are under the licence of this package.

## Tests

```
npm install        # vscode-textmate, vscode-oniguruma, cson-parser
npm test
```

`test/run.js` checks that the grammar files are well formed and that every regular expression
compiles in Oniguruma and, where `grep -P` is at hand, in PCRE; it runs the scope assertions of
`test/cases.js` (a `#` comment that ends at the next `#`, `CO` inside other words, doubled
quotes, brief clauses, bold operators against tags, bits denotations, `:=` against `=`, format
texts, nested brace comments and the rest); it tokenizes every sample and compares what the
grammar takes for comment, string, pragmat, format text and program text, character by
character, with a scanner written by hand (`test/lib/reference.js`); and it checks the
indentation patterns and the snippets.

Two tokenizers run the same tests: `vscode-textmate` (the default; Oniguruma as WebAssembly) and
`first-mate`, the tokenizer of Atom itself (`node test/run.js --engine first-mate`; first-mate
has a native part that builds with Node.js 22 or older and is no dependency of the package).

`spec/algol68-spec.js` is the spec for the editor (`atom --test spec`, `pulsar --test spec`); it
runs the same scope assertions. `node test/atom-spec.js` runs it outside the editor on
first-mate.

`node test/lexer-diff.js --lexer PATH/pa68lex FILE.a68 …` compares the grammar with the lexer of
the PA/68 compiler, token by token (`--option --supper --option --gnu` for sources in small
letters); it is for use in the PA/68 repository, where the lexer is built.

`node test/regime.js [--expect upper|supper] [--upper-if TEXT] [--list] FILE.a68 …` says which
rule set the grammar chooses for each file and counts the files read otherwise than they are.

`.github/workflows/test.yml` runs `npm test` on GitHub Actions.

## Licence

MIT, see `LICENSE.md`.
