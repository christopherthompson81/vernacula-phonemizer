# Local patch to regress 0.12.0

This is regress 0.12.0 from crates.io, copied verbatim (`src/`, `tests/`, `Cargo.toml`, the licences and the
README) apart from one change in `src/classicalbacktrack.rs`. `rust/Cargo.toml` wires it in through
`[patch.crates-io]`. Delete this directory and that patch entry once an upstream release carries an
equivalent fix.

## The defect

`JsRegex` follows V8: under `u`, a failed attempt advances one code unit, so a match attempt can start
between the two halves of a surrogate pair (`search`'s mid-pair scan, and `with_full_scan` in
`tools/regex-diff`). When a greedy one-character loop (`x?`, `x*`, `x{0,n}`) begins at such a position and
then has to back off, `BacktrackInsn::GreedyLoop1Char` steps by a whole code point and can jump over the loop's
start. It only stops when `max == min`, and that never holds:

- **Backward** (inside a lookbehind): it loops forever. `(?<=j[^.]?):` with flag `u` on `"😀"`, starting at
  index 1, never returns.
- **Forward**: stepping left runs off the start of the input and reaches `rs_unreachable!`, which is
  `unreachable_unchecked` in a release build. `.?x` with `u` on `"😀x"` from index 1 segfaults.

The fix clamps the stepped position to `min`, so the loop's zero-iteration position is still tried. Then
`max == min` ends the backtracking. `NonGreedyLoop1Char` needs no change: it steps in the same direction the
loop scanned, so it can't overshoot. Removing the clamp there left the regression test green.

The regression test is `core::js_regex::tests::loop_backtracking_from_inside_a_surrogate_pair_terminates`.
Its expected ranges come from Node. It hangs with the unpatched backward arm and segfaults with the unpatched
forward arm.

## The diff

```diff
--- a/src/classicalbacktrack.rs
+++ b/src/classicalbacktrack.rs
@@ -580,7 +580,14 @@
                     } else {
                         input.next_right_pos(*max)
                     };
-                    if let Some(newmax) = newmax {
+                    if let Some(mut newmax) = newmax {
+                        // vernacula patch: a match attempt that starts inside a surrogate pair puts `min`
+                        // between the two halves, so stepping back by a code point can jump over it and
+                        // `max == min` never holds (an endless loop, then `unreachable_unchecked`).
+                        // Clamp to `min`, so the zero-iteration position is still tried.
+                        if (Dir::FORWARD && newmax < *min) || (!Dir::FORWARD && newmax > *min) {
+                            newmax = *min;
+                        }
                         *pos = newmax;
                         *max = newmax;
                     } else {
```
