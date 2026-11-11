'use strict'
// Scope assertions for the grammars (the format is described in lib/check.js).  The cases are
// the places where a grammar for ALGOL 68 goes wrong easily; each says in its name what holds.

const many = 'x := 1; '.repeat(60)

// the number of the occurrence of fragment that begins where context stands in text
function at (text, fragment, context) {
  const pos = text.indexOf(context)
  let n = 0
  for (let i = text.indexOf(fragment); i >= 0 && i <= pos; i = text.indexOf(fragment, i + 1)) n++
  return n
}

// The event routines of RR 10.3.1.3 in a program of this package: a jump out of a routine text to a
// label that follows it, and a "$" as a character before a format text.
const events = [
  'BEGIN FILE notes; INT lines := 0; CHAR sign = "$";',
  '   open (notes, "notes.txt", stand in channel);',
  '   on logical file end (notes, (REF FILE ended) BOOL: GOTO counted);',
  '   DO get (notes, (LOC STRING, new line)); lines +:= 1 OD;',
  '   counted: close (notes);',
  '   on char error (stand out, (REF FILE out, REF CHAR instead) BOOL:',
  '      IF instead = "$" THEN instead := "*"; TRUE ELSE FALSE FI);',
  '   printf (($ a, 3z "." dd l $, sign, 100 * lines + 50))',
  'END'
].join('\n')

const literate = [
  '```markdown',
  '# A title with BEGIN in it',
  '',
  '```a68',
  '**begin**',
  '  **mode** Point = **struct** (**real** x, y);',
  '  **op** NORM = (Point p) **real**: sqrt (x **of** p ** 2 + y **of** p ** 2);',
  '  **proc** twice = (**int** n) **int**: 2 * n;',
  '```',
  '',
  'Prose again: IF and "quotes and # signs mean nothing here.',
  '',
  '```',
  '  Point p = (3.0, 4.0);   **co** a comment **co** INT k = twice (2);',
  '  print ((**round** NORM p, k**2, new_line))  # another #',
  '**end**',
  '```',
  '',
  '```text',
  'BEGIN output END',
  '```',
  '',
  '``` pa68',
  '**skip**',
  '```'
].join('\n')

// capitals or small letters: the decision (README, "Capitals or small letters")
const proseFirst = [
  '# a program to do things in small steps, if at all #',
  '{ for the mode of use see below }',
  'BEGIN INT to := 1, in := 2; print ((to + in, new line)) END'
].join('\n')

const blocks = [
  'Prose with begin and END.',
  '',
  '```algol68',
  'begin int n := 1; skip end',
  '```',
  '',
  'More prose: if and FI.',
  '',
  '```a68',
  'BEGIN INT n := 1; SKIP END',
  '```',
  '',
  '~~~algol68',
  'begin int m := 2 end',
  '~~~',
  '',
  'The end.'
].join('\n')

module.exports = [
  // ------------------------------------------------------------------ comments ----
  {
    name: 'a # comment ends at the next #',
    text: 'x := 1; # one # y := 2 # two # z',
    expect: [
      ['# one #', 'comment.block.hash'],
      ['#', 1, '=punctuation.definition.comment.begin'],
      ['#', 2, '=punctuation.definition.comment.end'],
      ['y', '!comment', 'plain'],
      [':=', 2, '=keyword.operator.assignment'],
      ['# two #', 'comment.block.hash'],
      ['z', '!comment']
    ]
  },
  {
    name: 'a # comment runs over lines until its #',
    text: 'a # first\n second # x\ny',
    expect: [
      ['first', 'comment.block.hash'],
      ['second', 'comment.block.hash'],
      ['x', '!comment'],
      ['y', '!comment']
    ]
  },
  {
    name: 'CO inside a tag or a longer bold word opens no comment',
    text: 'COMPL z; INT co := 1; ACCO x; Co y; CO a real comment CO w',
    expect: [
      ['COMPL', '=storage.type.standard', '!comment'],
      ['co', '!comment', 'plain'],
      ['ACCO', '!comment', '=entity.name.type'],
      ['x', '!comment'],
      ['Co', '!comment', '=entity.name.type'],
      ['y', '!comment'],
      ['CO a real comment CO', 'comment.block.bold'],
      ['w', '!comment']
    ]
  },
  {
    name: 'a CO comment ends at the next bold CO only',
    text: 'CO the co of COMMENT and DISCO and CO2 and Co CO after',
    expect: [
      ['the co of COMMENT and DISCO and CO2 and Co', 'comment.block.bold'],
      ['after', '!comment']
    ]
  },
  {
    name: 'a COMMENT comment ends at the next COMMENT, not at CO',
    text: 'COMMENT a CO b # c\n d COMMENT e',
    expect: [
      ['a CO b # c', 'comment.block.bold'],
      ['d', 'comment.block.bold'],
      ['e', '!comment']
    ]
  },
  {
    name: 'brace comments nest',
    text: 'a { one { two } three } b',
    expect: [
      ['one', 'comment.block.brace'],
      ['two', 'comment.block.brace'],
      ['three', 'comment.block.brace'],
      ['b', '!comment']
    ]
  },
  {
    name: 'a string denotation inside a brace comment is passed over',
    text: '{ a "}" b "x""}" c } d; { e "" } f',
    expect: [
      ['b', 'comment.block.brace'],
      ['c', 'comment.block.brace'],
      ['d', '!comment'],
      ['e', 'comment.block.brace'],
      ['f', '!comment']
    ]
  },
  {
    name: 'the comment symbols of one form mean nothing inside another',
    text: '{ a # b } c # d { # e CO f # g CO h',
    expect: [
      ['a # b', 'comment.block.brace'],
      ['c', '!comment'],
      ['d {', 'comment.block.hash'],
      ['e', '!comment'],
      ['f # g', 'comment.block.bold'],
      ['h', '!comment']
    ]
  },
  {
    name: 'the cent sign opens and closes a comment',
    text: 'a ¢ b ¢ c',
    expect: [
      ['¢ b ¢', 'comment.block.cent'],
      ['c', '!comment']
    ]
  },
  {
    name: 'NOTE ... ETON nests when the ETON stands on the same line',
    text: 'a NOTE b NOTE c ETON d ETON e',
    expect: [
      ['b', 'comment.block.bold.note'],
      ['c', 'comment.block.bold.note'],
      ['d', 'comment.block.bold.note'],
      ['e', '!comment']
    ]
  },
  {
    name: 'NOTE at the end of a line opens a comment up to ETON',
    text: 'a; NOTE\n  b NOTE c ETON d\nETON e',
    expect: [
      ['b', 'comment.block.bold.note'],
      ['d', 'comment.block.bold.note'],
      ['e', '!comment']
    ]
  },
  {
    name: 'NOTE as an indication of the Report language opens no comment',
    text: 'MODE NOTE = STRUCT (INT pitch, duration);\nNOTE n := (60, 4);\nREF NOTE r = n',
    expect: [
      ['NOTE', 1, '=entity.name.type.mode'],
      ['pitch', '!comment'],
      ['NOTE', 2, '=entity.name.type'],
      ['n := (60, 4)', '!comment'],
      ['NOTE', 3, '=entity.name.type'],
      ['r = n', '!comment']
    ]
  },
  {
    name: 'a comment symbol inside a string denotation is a character',
    text: 's := "# no comment { CO"; x',
    expect: [
      ['# no comment { CO', 'string.quoted.double', '!comment'],
      ['x', '!string', '!comment']
    ]
  },
  {
    name: 'a quote inside a comment opens no string',
    text: 'a # an "open quote # b CO it\'s "so CO c',
    expect: [
      ['an "open quote', 'comment.block.hash', '!string'],
      ['b', '!comment', '!string'],
      ['c', '!comment', '!string']
    ]
  },

  // ------------------------------------------------------------------ pragmats ----
  {
    name: 'a pragmat runs from PR to PR',
    text: 'PR profile extended PR\nBEGIN SKIP END',
    expect: [
      ['PR', 1, '=keyword.control.directive.pragmat'],
      ['profile extended', 'meta.preprocessor.pragmat'],
      ['PR', 2, '=keyword.control.directive.pragmat'],
      ['BEGIN', '=keyword.control.block', '!meta.preprocessor'],
      ['SKIP', '=constant.language.skip']
    ]
  },
  {
    name: 'PRAGMAT closes with PRAGMAT; PROC and PRIO open no pragmat',
    text: 'PRAGMAT a PR b PRAGMAT PROC p = VOID: SKIP; PRIO MAX = 7; c',
    expect: [
      ['a PR b', 'meta.preprocessor.pragmat'],
      ['PROC', '=storage.type.proc', '!meta.preprocessor'],
      ['PRIO', '=storage.type.priority', '!meta.preprocessor'],
      ['c', '!meta.preprocessor']
    ]
  },

  // --------------------------------------------------------------- denotations ----
  {
    name: 'a quote doubled inside a string is one quote, not an end',
    text: 's := "a""b"; t := """"""; u',
    expect: [
      ['"a""b"', 'string.quoted.double'],
      ['""', 1, '=constant.character.escape.quote'],
      ['; t', '!string'],
      ['""""""', 'string.quoted.double'],
      ['u', '!string']
    ]
  },
  {
    name: 'a denotation of one item is a character denotation, also the quote itself',
    text: 'CHAR a = "a", q = """", e = "\'n"; STRING two = "xy", none = ""; z',
    expect: [
      ['"a"', 'string.quoted.double.character'],
      ['""""', 'string.quoted.double.character'],
      ['"\'n"', 'string.quoted.double.character'],
      ['\'n', '=constant.character.escape.break'],
      ['"xy"', 'string.quoted.double', '!string.quoted.double.character'],
      ['""', 4, 'string.quoted.double', '!string.quoted.double.character'],
      ['z', '!string']
    ]
  },
  {
    name: 'an empty string before another string is two strings',
    text: 'x := "" + "y"; z',
    expect: [
      ['+', '=keyword.operator.arithmetic', '!string'],
      ['"y"', 'string.quoted.double'],
      ['z', '!string']
    ]
  },
  {
    name: 'a string denotation ends with its line',
    text: 's := "not closed\nx := 1',
    expect: [
      ['"not closed', 'string.quoted.double'],
      ['x := 1', '!string'],
      [':=', 2, '=keyword.operator.assignment']
    ]
  },
  {
    name: 'string breaks are escapes inside a string',
    text: 'puts ("line\'n" + "it\'\'s" + "caf\'(u00e9, U0001F600)" + "5\' 6"); x',
    expect: [
      ['\'n', '=constant.character.escape.break'],
      ['\'\'', '=constant.character.escape.break'],
      ['\'(u00e9, U0001F600)', '=constant.character.escape.break'],
      ['5\' 6', 'string.quoted.double', '!constant.character.escape'],
      ['x', '!string']
    ]
  },
  {
    name: 'bits denotations with the radices 2, 4, 8 and 16',
    text: 'BITS a = 2r1010, b = 4r123, c = 8r17, d = 16rff, e = 16r dead beef, f = 2r 0000 1111; g',
    expect: [
      ['2r1010', '=constant.numeric.bits'],
      ['4r123', '=constant.numeric.bits'],
      ['8r17', '=constant.numeric.bits'],
      ['16rff', '=constant.numeric.bits'],
      ['16r dead beef', '=constant.numeric.bits'],
      ['2r 0000 1111', '=constant.numeric.bits'],
      ['g', '!constant']
    ]
  },
  {
    name: 'real denotations: point, exponent, both, blanks inside',
    text: 'r := 3.14 + .5 + 1e5 + 1.5e-3 + 2\\5 + 6.02e+23 + 1 e 5 + 1 000.5 + 7E2; n := 1 000 000',
    expect: [
      ['3.14', '=constant.numeric.real'],
      ['.5', '=constant.numeric.real'],
      ['1e5', '=constant.numeric.real'],
      ['1.5e-3', '=constant.numeric.real'],
      ['2\\5', '=constant.numeric.real'],
      ['6.02e+23', '=constant.numeric.real'],
      ['1 e 5', '=constant.numeric.real'],
      ['1 000.5', '=constant.numeric.real'],
      ['7E2', '=constant.numeric.real'],
      ['1 000 000', '=constant.numeric.integer']
    ]
  },
  {
    name: 'a digit inside a tag is no denotation; a tag is no radix',
    text: 'x2 := a1b + 3; r2 := 2r11 + e5 + 1e5',
    expect: [
      ['x2', 'plain'],
      ['a1b', 'plain'],
      ['3', '=constant.numeric.integer'],
      ['r2', 'plain'],
      ['2r11', '=constant.numeric.bits'],
      ['e5', 'plain'],
      ['1e5', '=constant.numeric.real']
    ]
  },
  {
    name: 'an operator after a denotation is not an exponent',
    text: 'a := 2 ELEM b; c := 1 EQ 1; d := 3 - 1; e := 10 MOD 3',
    expect: [
      ['2', '=constant.numeric.integer'],
      ['ELEM', '=keyword.operator.word'],
      ['1', 1, '=constant.numeric.integer'],
      ['EQ', '=keyword.operator.word'],
      ['3', 1, '=constant.numeric.integer'],
      ['-', '=keyword.operator.arithmetic'],
      ['10', '=constant.numeric.integer'],
      ['MOD', '=keyword.operator.word']
    ]
  },
  {
    name: 'LONG and SHORT stand before a denotation as symbols of their own',
    text: 'LONG REAL x = LONG 1.5; SHORT INT i = SHORT 3',
    expect: [
      ['LONG', 2, '=storage.modifier.size'],
      ['1.5', '=constant.numeric.real'],
      ['SHORT', 2, '=storage.modifier.size'],
      ['3', '=constant.numeric.integer']
    ]
  },

  // -------------------------------------------------------------- format texts ----
  {
    name: 'a format text holds frames, replicators and insertions',
    text: 'printf (($ 3z "." dd l $, cents)); x',
    expect: [
      ['$', 1, '=punctuation.definition.string.begin', 'string.other.format'],
      ['3', '=constant.numeric.replicator', 'string.other.format'],
      ['z', '=constant.other.placeholder.format'],
      ['"."', 'string.quoted.double', '!string.quoted.double.character'],
      ['d', 1, '=constant.other.placeholder.format'],
      ['l', '=constant.other.placeholder.format'],
      ['$', 2, '=punctuation.definition.string.end'],
      ['cents', '!string', 'plain'],
      ['x', '!string']
    ]
  },
  {
    name: 'the unit of a replicator, a general pattern or a format pattern is program text',
    text: 'printf (($ g(0), n (k + 1) d, f (fmt), 2(d, "x") $, a, b)); y := 1',
    expect: [
      ['g', '=constant.other.placeholder.format'],
      ['0', '=constant.numeric.integer', 'source.algol68.embedded'],
      ['k + 1', 'source.algol68.embedded', 'meta.embedded.unit'],
      ['+', '=keyword.operator.arithmetic'],
      ['d', 1, '=constant.other.placeholder.format', '!source.algol68.embedded'],
      ['fmt', 'source.algol68.embedded'],
      ['2', '=constant.numeric.replicator'],
      ['"x"', 'string.quoted.double', '!source.algol68.embedded'],
      ['a, b', '!string'],
      ['y := 1', '!string']
    ]
  },
  {
    name: 'parentheses inside the unit of a format are balanced',
    text: 'f := $ n ((a + b) * (c - 1)) d, l $; z',
    expect: [
      ['(a + b) * (c - 1)', 'source.algol68.embedded'],
      ['d', '=constant.other.placeholder.format', '!source.algol68.embedded'],
      ['l', '=constant.other.placeholder.format'],
      ['z', '!string']
    ]
  },
  {
    name: 'a format text runs over lines, a # comment inside it is one',
    text: 'f := $ l "total: " # the sum #\n       6zd.dd $;\nw',
    expect: [
      ['"total: "', 'string.quoted.double', 'string.other.format'],
      ['# the sum #', 'comment.block.hash'],
      ['6', '=constant.numeric.replicator'],
      ['zd.dd', 'constant.other.placeholder.format'],
      ['w', '!string']
    ]
  },

  // ----------------------------------------------------------------- operators ----
  {
    name: 'the becomes symbol is not the equals symbol',
    text: 'INT a = 1; b := a = 1; c:=d',
    expect: [
      ['=', 1, '=keyword.operator.equals'],
      [':=', 1, '=keyword.operator.assignment'],
      ['=', 3, '=keyword.operator.equals'],
      [':=', 2, '=keyword.operator.assignment']
    ]
  },
  {
    name: 'the identity relators are symbols of their own',
    text: 'a :=: b; c :/=: NIL; d := e',
    expect: [
      [':=:', '=keyword.operator.identity'],
      [':/=:', '=keyword.operator.identity'],
      ['NIL', '=constant.language.nil'],
      [':=', 2, '=keyword.operator.assignment']
    ]
  },
  {
    name: 'operators that end in the becomes or the assigns-to symbol',
    text: 'a +:= 1; b -:= 1; c *:= 2; d /:= 2; e %:= 2; f %*:= 2; s +=: t; g **:= 2',
    expect: [
      ['+:=', '=keyword.operator.assignment.compound'],
      ['-:=', '=keyword.operator.assignment.compound'],
      ['*:=', '=keyword.operator.assignment.compound'],
      ['/:=', '=keyword.operator.assignment.compound'],
      ['%:=', '=keyword.operator.assignment.compound'],
      ['%*:=', '=keyword.operator.assignment.compound'],
      ['+=:', '=keyword.operator.assignment.compound'],
      ['**:=', '=keyword.operator.assignment.compound']
    ]
  },
  {
    name: 'comparison and arithmetic operators of one and two marks',
    text: 'a /= b; c <= d; e >= f; g < h; i > j; k ** 2; m % n; o %* p; q +* r; s >= -1; t = -u; v<>w',
    expect: [
      ['/=', '=keyword.operator.comparison'],
      ['<=', '=keyword.operator.comparison'],
      ['>=', 1, '=keyword.operator.comparison'],
      ['<', 2, '=keyword.operator.comparison'],
      ['>', 2, '=keyword.operator.comparison'],
      ['**', '=keyword.operator.arithmetic'],
      ['%', 1, '=keyword.operator.arithmetic'],
      ['%*', '=keyword.operator.arithmetic'],
      ['+*', '=keyword.operator.arithmetic'],
      ['>=', 2, '=keyword.operator.comparison'],
      ['-', 1, '=keyword.operator.arithmetic'],
      ['=', 5, '=keyword.operator.equals'],
      ['-', 2, '=keyword.operator.arithmetic'],
      ['<>', '=keyword.operator.other']
    ]
  },
  {
    name: 'bold operators are operators, the same letters in lower case are tags',
    text: 'a AND b OR NOT c MOD d OVER e; and := or + not - mod; f := ABS g + UPB h - LWB h; i ELEM j',
    expect: [
      ['AND', '=keyword.operator.word'],
      ['OR', '=keyword.operator.word'],
      ['NOT', '=keyword.operator.word'],
      ['MOD', '=keyword.operator.word'],
      ['OVER', '=keyword.operator.word'],
      ['and', 'plain'],
      ['or', 'plain'],
      ['not', 'plain'],
      ['mod', 'plain'],
      ['ABS', '=keyword.operator.word'],
      ['UPB', '=keyword.operator.word'],
      ['LWB', '=keyword.operator.word'],
      ['ELEM', '=keyword.operator.word']
    ]
  },
  {
    name: 'the longer standard operator wins over its beginning',
    text: 'a OVERAB b; c MODAB d; e LEVEL f; g UPB h; i IM j; k REPR l; m ISNT n; o ORF p',
    expect: [
      ['OVERAB', '=keyword.operator.word'],
      ['MODAB', '=keyword.operator.word'],
      ['LEVEL', '=keyword.operator.word'],
      ['UPB', '=keyword.operator.word'],
      ['IM', '=keyword.operator.word'],
      ['REPR', '=keyword.operator.word'],
      ['ISNT', '=keyword.operator.word'],
      ['ORF', '=keyword.operator.word']
    ]
  },
  {
    name: 'an unknown bold word after an operand is an operator, elsewhere a mode indication',
    text: 'm := a MAX b; n := 3 MIN c; Vec v; VEC w; REF Node p = HEAP Node; x := "a" JOIN "b"',
    expect: [
      ['MAX', '=keyword.operator.word'],
      ['MIN', '=keyword.operator.word'],
      ['Vec', '=entity.name.type'],
      ['VEC', '=entity.name.type'],
      ['Node', 1, '=entity.name.type'],
      ['Node', 2, '=entity.name.type'],
      ['JOIN', '=keyword.operator.word']
    ]
  },
  {
    name: 'selection, identity and the at symbol in bold',
    text: 'IF next OF node IS NIL THEN a[AT 1] ELSE b[@0] FI; c ISNT d',
    expect: [
      ['OF', '=keyword.operator.word'],
      ['IS', '=keyword.operator.word'],
      ['NIL', '=constant.language.nil'],
      ['AT', '=keyword.operator.word'],
      ['@', '=keyword.operator.at'],
      ['ISNT', '=keyword.operator.word']
    ]
  },
  {
    name: 'the marks of the reference language',
    text: 'a ≤ b ∧ c ≠ d ∨ ¬ e; f × g ÷ h; i :≠: j; r := 2⏨3',
    expect: [
      ['≤', '=keyword.operator.comparison'],
      ['∧', '=keyword.operator.logical'],
      ['≠', 1, '=keyword.operator.comparison'],
      ['∨', '=keyword.operator.logical'],
      ['¬', '=keyword.operator.logical'],
      ['×', '=keyword.operator.arithmetic'],
      ['÷', '=keyword.operator.arithmetic'],
      [':≠:', '=keyword.operator.identity'],
      ['2⏨3', '=constant.numeric.real']
    ]
  },

  // -------------------------------------------------------------- brief clauses ----
  {
    name: 'the bars of a brief choice clause',
    text: 'm := (a > b | a | b); k := (i | 1, 2, 3 | 4); s := (c1 | x |: c2 | y | z)',
    expect: [
      ['(', 1, '=punctuation.section.parens.begin'],
      ['|', 1, '=keyword.control.choice.brief'],
      ['|', 2, '=keyword.control.choice.brief'],
      [')', 1, '=punctuation.section.parens.end'],
      ['|', 3, '=keyword.control.choice.brief'],
      ['|:', '=keyword.control.choice.brief'],
      ['>', '=keyword.operator.comparison']
    ]
  },

  // ------------------------------------------------------- reserved words, labels ----
  {
    name: 'the bold words of the choice and loop clauses',
    text: 'IF a THEN b ELIF c THEN d ELSE e FI; CASE i IN f, g OUSE j IN h OUT k ESAC; FOR i FROM 1 BY 2 TO 9 WHILE l DO m OD',
    expect: [
      ['IF', '=keyword.control.conditional'],
      ['THEN', '=keyword.control.conditional'],
      ['ELIF', '=keyword.control.conditional'],
      ['ELSE', '=keyword.control.conditional'],
      ['FI', '=keyword.control.conditional'],
      ['CASE', '=keyword.control.case'],
      ['IN', '=keyword.control.case'],
      ['OUSE', '=keyword.control.case'],
      ['OUT', '=keyword.control.case'],
      ['ESAC', '=keyword.control.case'],
      ['FOR', '=keyword.control.loop'],
      ['FROM', '=keyword.control.loop'],
      ['BY', '=keyword.control.loop'],
      ['TO', '=keyword.control.loop'],
      ['WHILE', '=keyword.control.loop'],
      ['DO', '=keyword.control.loop'],
      ['OD', '=keyword.control.loop']
    ]
  },
  {
    name: 'a reserved word inside a longer bold word or in lower case is not reserved',
    text: 'INTEGER i; ENDING e; Begin b; DOT d; begin := end + if; FOR k FROM 1TO n DO SKIP OD',
    expect: [
      ['INTEGER', '=entity.name.type'],
      ['ENDING', '=entity.name.type'],
      ['Begin', '=entity.name.type'],
      ['DOT', '=entity.name.type'],
      ['begin', 'plain'],
      ['end', 'plain'],
      ['if', 'plain'],
      ['1', '=constant.numeric.integer'],
      ['TO', '=keyword.control.loop']
    ]
  },
  {
    name: 'declarers, generators and the standard modes',
    text: 'REF FLEX [] STRUCT (LONG INT a, UNION (REAL, VOID) b, PROC (BOOL) CHAR c) x = HEAP [1 : 0] Rec; LOC COMPL z; BITS w; BYTES y; STRING s; SEMA m; FILE f; CHANNEL ch; FORMAT fmt',
    expect: [
      ['REF', '=storage.modifier.reference'],
      ['FLEX', '=storage.modifier.flex'],
      ['STRUCT', '=storage.type.struct'],
      ['LONG', '=storage.modifier.size'],
      ['INT', '=storage.type.standard'],
      ['UNION', '=storage.type.union'],
      ['REAL', '=storage.type.standard'],
      ['VOID', '=storage.type.standard'],
      ['PROC', '=storage.type.proc'],
      ['BOOL', '=storage.type.standard'],
      ['CHAR', '=storage.type.standard'],
      ['HEAP', '=storage.modifier.generator'],
      ['LOC', '=storage.modifier.generator'],
      ['COMPL', '=storage.type.standard'],
      ['BITS', '=storage.type.standard'],
      ['BYTES', '=storage.type.standard'],
      ['STRING', '=storage.type.standard'],
      ['SEMA', '=storage.type.standard'],
      ['FILE', '=storage.type.standard'],
      ['CHANNEL', '=storage.type.standard'],
      ['FORMAT', '=storage.type.standard'],
      ['Rec', '=entity.name.type']
    ]
  },
  {
    name: 'the constants in bold',
    text: 'a := TRUE; b := FALSE; c := NIL; d := EMPTY; SKIP',
    expect: [
      ['TRUE', '=constant.language.boolean'],
      ['FALSE', '=constant.language.boolean'],
      ['NIL', '=constant.language.nil'],
      ['EMPTY', '=constant.language.empty'],
      ['SKIP', '=constant.language.skip']
    ]
  },
  {
    name: 'labels and jumps',
    text: 'BEGIN\n  again: x +:= 1;\n  IF x < 9 THEN GOTO again ELSE GO TO done FI; y := 0 EXIT\n  done: print (x); last one: SKIP; z := 1 EXIT finish: SKIP\nEND',
    expect: [
      ['again', 1, '=entity.name.label'],
      [':', 1, '=punctuation.separator.label'],
      ['GOTO', '=keyword.control.flow'],
      ['again', 2, '=entity.name.label'],
      ['GO', 2, '=keyword.control.flow'],
      ['TO', 2, '=keyword.control.flow'],
      ['done', 1, '=entity.name.label'],
      ['EXIT', '=keyword.control.flow'],
      ['done', 2, '=entity.name.label'],
      ['last one', '=entity.name.label'],
      ['finish', '=entity.name.label']
    ]
  },
  {
    name: 'the colon of a routine text, a bound or a specifier makes no label',
    text: 'PROC p = (INT a) INT: a;\n[1 : n] INT row;\nx := y;\nz :=: w;\nv :/=: u;\nCASE q IN\n  (INT i): i\nESAC',
    expect: [
      ['p', '!entity.name.label'],
      ['INT:', '!entity.name.label'],
      ['n', '!entity.name.label'],
      ['x', '!entity.name.label'],
      ['z', '!entity.name.label'],
      ['v', '!entity.name.label'],
      ['i', 2, '!entity.name.label'],
      [':', 1, '=punctuation.separator.colon'],
      [':', 2, '=punctuation.separator.colon']
    ]
  },

  // -------------------------------------------------------------- declarations ----
  {
    name: 'a mode declaration names its mode; an applied indication is not a declaration',
    text: 'MODE Node = STRUCT (INT value, REF Node next);\nMODE VEC = [1 : 3] REAL;\nNode n; LexResult r',
    expect: [
      ['MODE', 1, '=storage.type.mode'],
      ['Node', 1, '=entity.name.type.mode'],
      ['Node', 2, '=entity.name.type', '!entity.name.type.mode'],
      ['VEC', '=entity.name.type.mode'],
      ['Node', 3, '=entity.name.type', '!entity.name.type.mode'],
      ['LexResult', '=entity.name.type']
    ]
  },
  {
    name: 'a procedure declaration names its procedure',
    text: 'PROC is digit = (CHAR c) BOOL: c >= "0" AND c <= "9";\nPROC counter := VOID: SKIP;\nPROC (INT) INT fn = sq;\nPROC VOID halt = stop it',
    expect: [
      ['PROC', 1, '=storage.type.proc'],
      ['is digit', '=entity.name.function'],
      ['counter', '=entity.name.function'],
      ['fn', '!entity.name.function', 'plain'],
      ['halt', '!entity.name.function', 'plain'],
      ['BOOL', '=storage.type.standard']
    ]
  },
  {
    name: 'operator and priority declarations name their operators',
    text: 'OP MAX = (INT a, b) INT: (a > b | a | b);\nOP + = (Vec a, b) Vec: a;\nOP +:= = (REF Vec a, Vec b) REF Vec: a;\nOP = = (Vec a, b) BOOL: TRUE;\nOP /= = (Vec a, b) BOOL: FALSE;\nPRIO MAX = 9, MIN = 9;\nPRIO +:= = 1',
    expect: [
      ['OP', 1, '=storage.type.operator'],
      ['MAX', 1, '=entity.name.function.operator'],
      ['+', 1, '=entity.name.function.operator'],
      ['+:=', 1, '=entity.name.function.operator'],
      ['=', 5, '=entity.name.function.operator'],
      ['=', 6, '=keyword.operator.equals'],
      ['/=', '=entity.name.function.operator'],
      ['PRIO', 1, '=storage.type.priority'],
      ['MAX', 2, '=entity.name.function.operator'],
      ['9', 1, '=constant.numeric.integer'],
      ['+:=', 2, '=entity.name.function.operator']
    ]
  },

  // ----------------------------------------------------------- standard prelude ----
  {
    name: 'identifiers of the standard prelude',
    text: 'print ((whole (i, 0), fixed (x, 8, 3), float (x, 12, 4, 2), newline));\ny := sqrt (2.0) + max int + long pi + long sqrt (LONG 2.0) + random + small real;\nput (stand out, (blank, flip, new page)); read ((a, b))',
    expect: [
      ['print', '=support.function.transput'],
      ['whole', '=support.function.conversion'],
      ['fixed', '=support.function.conversion'],
      ['float', '=support.function.conversion'],
      ['newline', '=support.function.transput'],
      ['sqrt', 1, '=support.function.math'],
      ['max int', '=support.constant'],
      ['long pi', '=support.constant'],
      ['long sqrt', '=support.function.math'],
      ['random', '=support.function.math'],
      ['small real', '=support.constant'],
      ['put', '=support.function.transput'],
      ['stand out', '=support.variable'],
      ['blank', '=support.constant'],
      ['flip', '=support.constant'],
      ['new page', '=support.function.transput'],
      ['read', '=support.function.transput']
    ]
  },
  {
    name: 'blanks and underscores inside a prelude identifier stand for nothing',
    text: 'a := max_int + maxint + int_width; print ((new_line, char_in_string ("x", NIL, s))); on logical file end (f, p); stand_in_channel',
    expect: [
      ['max_int', '=support.constant'],
      ['maxint', '=support.constant'],
      ['int_width', '=support.constant'],
      ['new_line', '=support.function.transput'],
      ['char_in_string', '=support.function.conversion'],
      ['on logical file end', '=support.function.transput'],
      ['stand_in_channel', '=support.constant']
    ]
  },
  {
    name: 'a prelude identifier inside a longer tag is that tag',
    text: 'my print (x); print line (y); set := 1; sqrt2 := 1; whole part := 2; pi2 := 6.28; max int value := 3; exp := 1; space count := 0; stand in for := 1',
    expect: [
      ['my print', '!support', 'plain'],
      ['print line', '!support', 'plain'],
      ['set', '!support'],
      ['sqrt2', '!support'],
      ['whole part', '!support'],
      ['pi2', '!support'],
      ['max int value', '!support'],
      ['exp', '!support'],
      ['space count', '!support'],
      ['stand in for', '!support']
    ]
  },

  {
    name: 'event routines: a jump out of a routine text to a label after it, a "$" as a character before a format text',
    text: events,
    expect: [
      ['open', '=support.function.transput'],
      ['stand in channel', '=support.constant'],
      ['on logical file end', '=support.function.transput'],
      ['notes', 4, 'plain'],
      ['FILE', 2, '=storage.type.standard'],
      ['ended', 'plain'],
      ['GOTO', '=keyword.control.flow'],
      ['counted', 1, '=entity.name.label'],
      ['get', '=support.function.transput'],
      ['LOC', '=storage.modifier.generator'],
      ['new line', '=support.function.transput'],
      ['counted', 2, '=entity.name.label'],
      ['close', '=support.function.transput'],
      ['on char error', '=support.function.transput'],
      ['stand out', '=support.variable'],
      ['instead', 1, 'plain'],
      ['"$"', 1, 'string.quoted.double.character', '!string.other.format'],
      ['"*"', 'string.quoted.double.character'],
      ['TRUE ELSE FALSE', '!string'],
      ['FI', at(events, 'FI', 'FI);'), '=keyword.control.conditional', '!string'],
      ['"$"', 2, 'string.quoted.double.character', '!string.other.format'],
      ['; TRUE', '!string'],
      ['printf', '=support.function.transput'],
      ['a, 3z "." dd l', 'string.other.format'],
      ['3', at(events, '3', '3z'), '=constant.numeric.replicator'],
      ['sign, 100 * lines + 50', '!string'],
      ['sign', 2, 'plain'],
      ['100', '=constant.numeric.integer'],
      ['END', '=keyword.control.block', '!string']
    ]
  },

  // ---------------------------------------------------- modules and extensions ----
  {
    name: 'a module definition and its access prefix',
    text: 'MODULE SHAPES =\nACCESS UNITS, PUB BASE\nDEF\n  PUB PROC area = (REAL r) REAL: scale * r * r;\n  SKIP\nPOSTLUDE\n  SKIP\nFED',
    expect: [
      ['MODULE', '=storage.type.module'],
      ['SHAPES', '=entity.name.module'],
      ['ACCESS', '=keyword.control.import'],
      ['UNITS', '=entity.name.module'],
      ['PUB', 1, '=storage.modifier.pub'],
      ['BASE', '=entity.name.module'],
      ['DEF', '=keyword.control.module', '!meta.access'],
      ['PUB', 2, '=storage.modifier.pub'],
      ['area', '=entity.name.function', '!meta.access'],
      ['POSTLUDE', '=keyword.control.module'],
      ['FED', '=keyword.control.module']
    ]
  },
  {
    name: 'an access clause ends where its enclosed clause begins',
    text: 'ACCESS SHAPES, PARALLEL\nBEGIN\n  ACCESS UNITS (print ((scale, new_line)));\n  ACCESS JSON [x, OLD AS NEW] IF x THEN SKIP FI;\n  ACCESS ROWS { the rows } WHILE k < 9 DO SKIP OD;\n  ACCESS TEXTS, CO the library CO KERNELS # two # FOR i TO 3 DO SKIP OD\nEND',
    expect: [
      ['SHAPES', '=entity.name.module'],
      ['PARALLEL', '=entity.name.module'],
      ['BEGIN', '=keyword.control.block', '!meta.access'],
      ['UNITS', '=entity.name.module'],
      ['print', '=support.function.transput', '!meta.access'],
      ['JSON', '=entity.name.module'],
      ['OLD', '=entity.name.type', 'meta.import-list'],
      ['AS NEW', 'meta.import-list'],
      ['AS', '=keyword.control.as'],
      ['IF', '=keyword.control.conditional', '!meta.access'],
      ['ROWS', '=entity.name.module'],
      ['{ the rows }', 'comment.block.brace'],
      ['WHILE', '=keyword.control.loop', '!meta.access'],
      ['CO the library CO', 'comment.block.bold'],
      ['KERNELS', '=entity.name.module'],
      ['# two #', 'comment.block.hash'],
      ['FOR', '=keyword.control.loop', '!meta.access'],
      ['END', '=keyword.control.block']
    ]
  },
  {
    name: 'the words of the deterministic parallel extensions',
    text: 'PURE PROC (INT) INT sq = (INT x) INT: x * x;\n[] INT squares = DPAR FOR i TO n DO sq (i) OD;\nFUT INT total = ASYNC (SUM squares);\n[] INT pair = DPAR (AWAIT total, n);\nx := SNAPSHOT y',
    expect: [
      ['PURE', '=storage.modifier.pure'],
      ['PROC', '=storage.type.proc'],
      ['DPAR', 1, '=keyword.control.parallel'],
      ['FOR', '=keyword.control.loop'],
      ['FUT', '=storage.modifier.future'],
      ['ASYNC', '=keyword.control.parallel'],
      ['SUM', '=entity.name.type'],
      ['AWAIT', '=keyword.operator.word'],
      ['SNAPSHOT', '=keyword.operator.word']
    ]
  },
  {
    name: 'the parallel clause and the semaphores of the Report',
    text: 'SEMA s = LEVEL 1; PAR (BEGIN DOWN s; n +:= 1; UP s END, (DOWN s; UP s))',
    expect: [
      ['SEMA', '=storage.type.standard'],
      ['LEVEL', '=keyword.operator.word'],
      ['PAR', '=keyword.control.parallel'],
      ['DOWN', 1, '=keyword.operator.word'],
      ['UP', 1, '=keyword.operator.word']
    ]
  },
  {
    name: 'a formal hole names its language',
    text: 'PUB INT max_int = NEST PA68 "max int"; PROC getpid = INT: NEST C "getpid"',
    expect: [
      ['NEST', 1, '=keyword.other.nest'],
      ['PA68', '=constant.other.language'],
      ['"max int"', 'string.quoted.double'],
      ['C "', '!entity.name.type'],
      ['"getpid"', 'string.quoted.double']
    ]
  },
  {
    name: 'the fixed-width modes of PA/68',
    text: 'INT32 a; BITS64 b; REAL80 c; INT7 d',
    expect: [
      ['INT32', '=support.type'],
      ['BITS64', '=support.type'],
      ['REAL80', '=support.type'],
      ['INT7', '=entity.name.type']
    ]
  },

  // ------------------------------------------------- the Markdown source form ----
  {
    name: 'in a Markdown source the fenced blocks are the program and bold words stand in asterisks',
    grammar: 'text.markdown.algol68',
    text: literate,
    expect: [
      ['```markdown', 'meta.marker.markdown'],
      ['BEGIN in it', '!keyword', '!source.algol68'],
      ['```a68', 'markup.code', '!source.algol68'],
      ['**begin**', '=keyword.control.block', 'source.algol68'],
      ['**mode**', '=storage.type.mode'],
      ['Point', 1, '=entity.name.type.mode'],
      ['**struct**', '=storage.type.struct'],
      ['**real**', 1, '=storage.type.standard'],
      ['**op**', '=storage.type.operator'],
      ['NORM', 1, '=entity.name.function.operator'],
      ['Point', 2, '=entity.name.type', '!entity.name.type.mode'],
      ['sqrt', '=support.function.math'],
      ['**of**', 1, '=keyword.operator.word'],
      ['**', at(literate, '**', '** 2 + y'), '=keyword.operator.arithmetic'],
      ['2', 1, '=constant.numeric.integer'],
      ['**proc**', '=storage.type.proc'],
      ['twice', 1, '=entity.name.function'],
      ['**int**', 1, '=storage.type.standard'],
      ['IF and "quotes and # signs', '!keyword', '!string', '!comment', '!source.algol68'],
      ['Point p', 'source.algol68'],
      ['**co** a comment **co**', 'comment.block.bold'],
      ['INT k', 'source.algol68', '!comment'],
      ['**round**', '=keyword.operator.word'],
      ['**', at(literate, '**', '**2, new_line'), '=keyword.operator.arithmetic'],
      ['# another #', 'comment.block.hash'],
      ['**end**', '=keyword.control.block'],
      ['BEGIN output END', 'markup.raw.block', '!keyword', '!source.algol68'],
      ['**skip**', '=constant.language.skip', 'source.algol68']
    ]
  },
  {
    name: 'a fenced algol68 block of a Markdown document is program text',
    grammar: 'source.gfm',
    text: 'Prose with BEGIN.\n\n```algol68\nBEGIN print (("x", newline)) END\n```\n\n```text\nEND of text\n```\n\n~~~A68\nINT n = 2r101\n~~~\n',
    expect: [
      ['BEGIN', 1, '!keyword'],
      ['BEGIN', 2, '=keyword.control.block', 'source.embedded.algol68'],
      ['print', '=support.function.transput'],
      ['END', 1, '=keyword.control.block'],
      ['END', 2, '!keyword', '!source.embedded.algol68'],
      ['INT', '=storage.type.standard'],
      ['2r101', '=constant.numeric.bits']
    ]
  },

  {
    name: 'a fence inside another fenced block of a Markdown document opens no program text',
    grammar: 'source.gfm',
    text: '~~~text\n```algol68\nBEGIN\n```\n~~~\n\n```a68\nEND\n```\n',
    expect: [
      ['BEGIN', '!keyword', '!source.embedded.algol68', 'markup.raw'],
      ['END', '=keyword.control.block', 'source.embedded.algol68']
    ]
  },

  // ------------------------------------------------- capitals or small letters ----
  {
    name: 'prose in a comment decides nothing; the first line that begins with a reserved word in capitals does',
    text: proseFirst,
    expect: [
      ['a program to do things in small steps', 'comment.block.hash', '!meta.stropping'],
      ['for the mode of use', 'comment.block.brace', '!meta.stropping'],
      ['BEGIN', '=keyword.control.block', 'meta.stropping.upper'],
      ['to', at(proseFirst, 'to', 'to := 1'), 'plain', 'meta.stropping.upper'],
      ['in', at(proseFirst, 'in', 'in := 2'), 'plain'],
      ['END', '=keyword.control.block']
    ]
  },
  {
    name: 'a file whose first line with a reserved word at its beginning has it in small letters is read in small letters',
    text: '{ a program to count in small letters }\nbegin\n  int n := 3; ref int r = n;\n  for i to n do skip od;\n  if n > 2 then n := 0 else n := 1 fi\nend',
    expect: [
      ['a program to count in small letters', 'comment.block.brace', '!meta.stropping'],
      ['begin', '=keyword.control.block', 'meta.stropping.supper'],
      ['int', 1, '=storage.type.standard'],
      ['ref', '=storage.modifier.reference'],
      ['for', '=keyword.control.loop'],
      ['to', 2, '=keyword.control.loop'],
      ['do', '=keyword.control.loop'],
      ['skip', '=constant.language.skip'],
      ['od', '=keyword.control.loop'],
      ['if', '=keyword.control.conditional'],
      ['then', '=keyword.control.conditional'],
      ['else', '=keyword.control.conditional'],
      ['fi', '=keyword.control.conditional'],
      ['end', '=keyword.control.block', 'meta.stropping.supper']
    ]
  },
  {
    name: 'a tag that spells a reserved word and begins a line decides nothing where it is not followed as a reserved word is',
    text: 'mode := 3;\nop := mode + 1;\nprint ((op, new line));\nINT k = op',
    expect: [
      ['mode', 1, 'plain', '!meta.stropping'],
      ['op', 1, 'plain', '!meta.stropping'],
      ['print', '=support.function.transput', '!meta.stropping'],
      ['INT', '=storage.type.standard', 'meta.stropping.upper'],
      ['op', 3, 'plain']
    ]
  },
  {
    name: 'a reserved word in small letters does not decide on a line that has one in capitals',
    text: 'op OF in := 1;\nIF op OF in = 1 THEN SKIP FI',
    expect: [
      ['op', 1, 'plain', '!meta.stropping'],
      ['OF', 1, '=keyword.operator.word', '!meta.stropping'],
      ['IF', '=keyword.control.conditional', 'meta.stropping.upper'],
      ['op', 2, 'plain']
    ]
  },
  {
    name: 'a file in which no line begins with a reserved word is read as capitals, undecided',
    text: '(print (("x", new line)); x := (a > b | a | b);\n to := x)',
    expect: [
      ['print', '=support.function.transput', '!meta.stropping'],
      ['new line', '=support.function.transput'],
      ['to', 'plain', '!meta.stropping']
    ]
  },
  {
    name: 'in small letters a tag that holds a reserved word is a tag',
    text: 'begin\n  int end_of_file := 1, format_width := 2, in_x := 3, begin2 := 4;\n  modes := end_of_file\nend',
    expect: [
      ['end_of_file', 1, 'plain'],
      ['format_width', 'plain'],
      ['in_x', 'plain'],
      ['begin2', 'plain'],
      ['modes', 'plain'],
      ['end_of_file', 2, 'plain']
    ]
  },
  {
    name: 'in small letters an indication begins with a capital and the bold operators are in capitals',
    text: 'mode Node = struct (int value, ref Node next);\nop MAX = (int a, b) int: (a > b | a | b);\nprio MAX = 9;\nNode n := (1 MAX 2, nil); int k = ABS value of n + UPB row',
    expect: [
      ['mode', '=storage.type.mode', 'meta.stropping.supper'],
      ['Node', 1, '=entity.name.type.mode'],
      ['struct', '=storage.type.struct'],
      ['Node', 2, '=entity.name.type', '!entity.name.type.mode'],
      ['op', '=storage.type.operator'],
      ['MAX', 1, '=entity.name.function.operator'],
      ['prio', '=storage.type.priority'],
      ['MAX', 2, '=entity.name.function.operator'],
      ['MAX', 3, '=keyword.operator.word'],
      ['nil', '=constant.language.nil'],
      ['ABS', '=keyword.operator.word'],
      ['of', '=keyword.operator.word'],
      ['UPB', '=keyword.operator.word']
    ]
  },
  {
    name: 'in small letters a procedure names itself, a label is one, and a reserved word before a colon is none',
    text: 'proc twice = (int a)\n  int: 2 * a;\nbegin\n  again: n +:= 1;\n  if n < 3 then goto again fi; go to done;\n  done: skip\nend',
    expect: [
      ['proc', '=storage.type.proc'],
      ['twice', '=entity.name.function'],
      ['int', 2, '=storage.type.standard', '!entity.name.label'],
      ['again', 1, '=entity.name.label'],
      ['goto', '=keyword.control.flow'],
      ['again', 2, '=entity.name.label'],
      ['go', 2, '=keyword.control.flow'],
      ['done', 1, '=entity.name.label'],
      ['done', 2, '=entity.name.label']
    ]
  },
  {
    name: 'in small letters brace comments nest, # ... # is kept, and co opens a comment only before a word',
    text: 'begin\n  { one { two } three } x := 1; # hash # y := 2;\n  co a comment co z := 3;\n  int co := 4; co +:= 1;\n  comment a long\n    comment w := 5\nend',
    expect: [
      ['one', 'comment.block.brace'],
      ['two', 'comment.block.brace'],
      ['three', 'comment.block.brace'],
      ['x := 1', '!comment'],
      ['# hash #', 'comment.block.hash'],
      ['y := 2', '!comment'],
      ['co a comment co', 'comment.block.bold'],
      ['z := 3', '!comment'],
      ['co := 4', '!comment'],
      ['co +:= 1', '!comment'],
      ['a long', 'comment.block.bold'],
      ['w := 5', '!comment'],
      ['end', '=keyword.control.block']
    ]
  },
  {
    name: 'in small letters: a pragmat, a module and its access clause',
    text: 'pr include "x.a68" pr\nmodule Shapes =\naccess Units, pub Base\ndef\n  pub proc area = (real r) real: scale * r * r;\n  skip\nfed',
    expect: [
      ['pr', 1, '=keyword.control.directive.pragmat', 'meta.stropping.supper'],
      ['include "x.a68"', 'meta.preprocessor.pragmat'],
      ['module', '=storage.type.module', '!meta.preprocessor'],
      ['Shapes', '=entity.name.module'],
      ['access', '=keyword.control.import'],
      ['Units', '=entity.name.module'],
      ['pub', 1, '=storage.modifier.pub'],
      ['Base', '=entity.name.module'],
      ['def', '=keyword.control.module', '!meta.access'],
      ['pub', 2, '=storage.modifier.pub'],
      ['area', '=entity.name.function'],
      ['real', 1, '=storage.type.standard'],
      ['fed', '=keyword.control.module']
    ]
  },
  {
    name: 'in small letters GNU writes a pragmat between double brackets; pr and pragmat are tags, word is a size, andth and orel are reserved',
    text: '[[include "hello.a68"]]\nbegin int pr = 10, pragmat = 20;\n      word bits address = word 16rff;\n      if pr > 5 andth pragmat > 5 orel pr = 0 then skip fi\nend',
    expect: [
      ['[[', '=keyword.control.directive.pragmat', 'meta.stropping.supper'],
      ['include "hello.a68"', 'meta.preprocessor.pragmat'],
      [']]', '=keyword.control.directive.pragmat'],
      ['begin', '=keyword.control.block', '!meta.preprocessor'],
      ['pr', 1, 'plain'],
      ['pragmat', 1, 'plain'],
      ['word', 1, '=storage.modifier.size'],
      ['bits', '=storage.type.standard'],
      ['word', 2, '=storage.modifier.size'],
      ['16rff', '=constant.numeric.bits'],
      ['pr', 3, 'plain'],
      ['andth', '=keyword.operator.word'],
      ['orel', '=keyword.operator.word'],
      ['fi', '=keyword.control.conditional']
    ]
  },
  {
    name: 'a declaration in small letters after an opening parenthesis decides for small letters',
    text: '(bits a = 2r01; int n := 3;\n while n > 0 do n -:= 1 od; skip)',
    expect: [
      ['bits', '=storage.type.standard', 'meta.stropping.supper'],
      ['int', '=storage.type.standard'],
      ['while', '=keyword.control.loop'],
      ['do', '=keyword.control.loop'],
      ['od', '=keyword.control.loop'],
      ['skip', '=constant.language.skip']
    ]
  },
  {
    name: 'in capitals a tag with blanks after an opening parenthesis decides nothing',
    text: '(int width OF x := 3;\n real width + 1;\n INT k = bits width)',
    expect: [
      ['int width', '!storage', '!meta.stropping'],
      ['real width', '!storage', '!meta.stropping'],
      ['INT', '=storage.type.standard', 'meta.stropping.upper'],
      ['bits width', '=support.constant']
    ]
  },
  {
    name: 'in a Markdown document every fenced block decides for itself, and the decision ends with the block',
    grammar: 'source.gfm',
    text: blocks,
    expect: [
      ['Prose with begin and END', '!keyword', '!meta.stropping'],
      ['begin', 2, '=keyword.control.block', 'meta.stropping.supper'],
      ['int', 1, '=storage.type.standard'],
      ['More prose: if and FI', '!keyword', '!meta.stropping', '!source.embedded.algol68'],
      ['BEGIN', '=keyword.control.block', 'meta.stropping.upper'],
      ['INT', '=storage.type.standard'],
      ['begin', 3, '=keyword.control.block', 'meta.stropping.supper'],
      ['The end', '!keyword', '!meta.stropping', '!source.embedded.algol68']
    ]
  },

  // ------------------------------------------------------------------ long lines ----
  {
    name: 'a line of several hundred tokens is tokenized to its end',
    text: many + '# a comment # y := "s"; z',
    expect: [
      ['# a comment #', 'comment.block.hash'],
      ['y', '!comment', 'plain'],
      ['"s"', 'string.quoted.double'],
      ['z', '!comment', '!string', 'plain']
    ]
  }
]
