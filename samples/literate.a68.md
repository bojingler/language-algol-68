```markdown
# Literate PA/68: a small program as a Markdown document (D25)

The first line marks the file as Markdown even without the `.a68.md` suffix. This block
declares a type and an operator:

```a68
**begin**
  **mode** Point = **struct** (**real** x, y);
  **op** + = (Point a, b) Point: (x **of** a + x **of** b, y **of** a + y **of** b);
  **op** NORM = (Point p) **real**: sqrt (x **of** p ** 2 + y **of** p ** 2);
```

Prose in the middle of a clause is fine, since every fence is a comment to the compiler.

```
  Point p = (3.0, 4.0), q = (1.0, 2.0);
  print ((fixed (NORM p, 0, 2), " ", fixed (NORM (p + q), 0, 2), new_line));
  **int** twice_x = 2 * **round** (x **of** p);
  print ((twice_x, new_line))
**end**
```
