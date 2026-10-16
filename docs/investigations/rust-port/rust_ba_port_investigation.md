# Rust port: Bashkir (`ba`)

Branch `worktree-agent-a123e70f02c70c7cd`, on main 36a68ef6 (62 languages ported). Part of #1463, the first of the
second Turkic group (ba, crh, kaa, nog, chv, tg). Method as in rust_tt_port_investigation.md.

## Run 1 — 2026-10-15 00:12 (the import closure)

**Question.** What does `src/languages/bashkir/` need, and does it share a module with a ported language?

**Command.** Read bashkir.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `loadManifest`, `normalizeSymbols`, `ipa`, `initialisms`, `boundaries`, `provenance`.
  All ported. No neural entry; `ROMAN_POLICIES` names `ba: romanBa` (its ordinal is normalize.ts's `ordinalOf`).
- ⚠ One cross-language import: `phonemizeWord` from `russian/russian.ts`, the loan route. Reused from
  `languages::russian::russian::phonemize_word` (crate-private, panicking on unloaded dictionaries), so
  `create_bashkir` loads the Russian manifest and dictionaries first. No kk/tt/ky module is imported.
- numbers.ts holds its tables in code; `LETTER_NAME` (40 entries) GENERATED from the TS object with `literal.mts`.
  ⚠ My first hand-typed copy had two empty padding rows to reach a count I had guessed (42), the same slip the tt
  log records; the generated table replaced it.
- `SYMBOL_DATA` is the recorded TS literal (symdata.mts through the fn-diff hook), compared byte for byte with the
  Rust constant: identical.
- No FLEURS for ba. The golden (200 distinct texts), probes/ba.txt and generated shapes carry it.

## Run 2 — 2026-10-15 00:15 (the golden gate)

**Command.** `cd rust && ./target/release/parity ba` and `--sync ba`.

**Raw finding.** `ba: 200/200 identical, 0 differ` both modes, first build.

## Run 3 — 2026-10-15 00:18 (differentials)

**Command.** `run.sh <worktree> ba ba-normalize ba-g2p ba-numbers ba-roman` (each dump through the TS, replayed by
fn-diff; plus phonemize-sync, phonemize-best and trace with `LANGS=ba`, and symbols with `SYMBOLS_LANGS=ba`).

**Raw finding.**
```
ba-normalize: 23372 identical, 0 DIFFER  (probe 465, synthetic 18860, words 3047; ops normalize, initialisms on
              raw and normalized, symbols, engine, unreadable)
ba-g2p:       212112 identical, 0 DIFFER (phonemizeWord, phonemizeWordNative, isRussianLoan, foldLegacyCodepage)
ba-numbers:   58260 identical, 0 DIFFER
ba-roman:     433 identical, 0 DIFFER   (golden 200, probe 93, synthetic 140)
phonemize-sync / phonemize-best / trace: 293 identical, 0 DIFFER each
symbols:      3272 identical, 0 DIFFER  (probe 3072, bashkir 200)
```
**Haystack.** normalize changed 49 of 200 golden rows, 61 of 93 probe and 2,384 of 3,772 synthetic; the
initialism pass changed 56 golden rows; the symbol tier 32. Of 53,028 g2p words, 5,079 route to the Russian g2p.

**Is the replay sensitive?** The Russian `-е`/`-й` refusal in step 5 disabled → `ba-normalize: 146 DIFFER`; the
loan route disabled → `ba-g2p: 5031 DIFFER`. Both restored byte for byte from a copy (`cmp`), not by `sed`, so the
kk/tt slip of deleting the `if` cannot recur; identical again after the restore.

## Run 4 — 2026-10-15 00:21 (the TS suite as a Rust test; the regex audit)

**Command.** `npx tsx pins.mts test/bashkir.test.ts` (the north group's recorder: the suite runs under a vitest
shim that records every call the TEST makes into src/ with the TS result, and evaluates every matcher), then
`append_pins.py`. Then `audit_regex.py` over the Rust module against the TS sources.

**Raw finding.**
- 89 calls pinned, 1 skipped (`getPhonemizer("ba")` itself, an object); 86 matchers evaluated, 0 failures. The
  Rust test passes; with the loan route disabled it FAILS (`phonemizeWord["республика"]`: `ɾɪspubɫiˈkɑ` for
  `rʲɪspˈublʲɪkə`).
- ⚠ Regex audit: the editing tool had again written the `\u00a0\u202f\u2009` escapes of step 0 (three
  literals) as LITERAL characters. Every differential above was still identical, because a literal NBSP in a
  class matches what the escape does; only the code-point audit sees it. Rewritten with `escape_ws.py`;
  the audit is then 26 raw patterns, all verbatim except three false positives (a multi-line match across
  `r"…"` boundaries, the SYMBOL_DATA JSON, and the `format!` year pattern, checked by hand against its
  `new RegExp` template, as were the clock, suffix and degree templates; the `[CСcс]` class compared byte for
  byte: `43 d0a1 63 d181` in both).

## Run 5 — 2026-10-15 00:25 (reading for correctness: TS findings)

**Command.** `npx tsx try.mts ba …` on synthetic inputs. Rust reproduces each; the inputs are in probes/ba.txt.

**Raw finding.**
1. **No scale above milliard** (numbers.ts): `1000000000000` → *ˈmɪŋ miɫɫiˈɑɾd* ("thousand milliard"), while the
   symbol tier's own magnitude list has *триллион*. The same gap as tt's.
2. **A range spaced on one side only reads as a subtraction**: `1990 -1995 йылдар` → *… tuqˈhɑn miˈnus ˈmɪŋ …*.
   Step 8's sign rule `(^|[\s(])[-−–](\d)` claims any hyphen after a space before step 9's range rule can see it;
   Tatar's twin rule guards the space with `(?<!\d)`, Bashkir's does not.
3. **A case suffix on the gram is stranded**: `5 г-ға` → *ˈbiʃ ɡˈɾɑmm ˈʁɑ* (step 7 claims `г` before a hyphen; the
   suffix becomes its own word).

**Implication.** Reported in the PR, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 00:27 (after `cargo fmt` and three more probes)

**Command.** `run.sh … ba ba-normalize ba-g2p ba-numbers ba-roman`; `parity ba`.

**Raw finding.** ba-normalize 23,387, ba-g2p 212,112, ba-numbers 58,260, ba-roman 436, phonemize-sync /
phonemize-best / trace 296 each, symbols 3,272: 0 DIFFER. parity 200/200.

## Run 7 — 2026-10-15 02:01 (every gate, on the tree rebased onto origin/main 8f7cf14f)

**Command.** `git rebase origin/main` (the germanic group da/nb/af/lb/bar and #1579 had merged meanwhile). Every
commit conflicted on the registry's `LANGUAGES` list; ba also on `build`, `languages/mod.rs` and dump.mts's dump table,
nog on `languages/mod.rs`, tg on dump.mts's `FLEURS_DIR`. Resolved as a union by `resolve.py`: the `LANGUAGES` codes merged and the array length recounted, and at
a block boundary the shared closing lines (`.map_err(…),`, `    },`) copied between the two halves so neither entry
loses its closure; dump.mts parse-checked with `npx esbuild` after each step. Then `cargo run --release -p parity`
(ALL languages), `cargo test --workspace --release`, `cargo run --release -p regex-diff`, `cargo fmt --check`,
`cargo clippy --workspace --release`, and `all.sh` (every dump of this group regenerated from the TS on this tree
and replayed).

**Raw finding.**
- parity: all 73 language lines identical except mag 199/200 and tt 199/200 (their known Arabic rows, port-pending
  on `ar`). hil 112/112, ilo 94/94 and nog 68/68 are the sizes of their goldens.
- cargo test: 267 + 1 passed, 0 failed. regex-diff: 146,326 identical, 0 DIFFER, 0 refused. fmt: clean.
- clippy: the only new warnings are `module_inception` on the six new `mod.rs` files. (One other, `if_same_then_else`
  on tajik.rs's two glide arms, was fixed by joining the conditions; the tg dumps and pins re-replayed identical.)
- ba: ba-normalize 23,387, ba-g2p 212,112, ba-numbers 58,260, ba-roman 436, phonemize-sync / phonemize-best / trace 296 each, symbols 3,272: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 8 — 2026-10-15 20:35 (#1581 fixes, TS-first, mirrored to C# and Rust)

**Question.** Do the #1581 ba defects reproduce? Also, does ba have the medial-cluster stress walk that tk/tt
had (#1576)?

**Found.**
- No sonority walk: ba took one onset consonant only, so the medial case (*kitɑpˈɫɑɾ*) was already right. The
  word-INITIAL cluster was wrong instead: спорт → *sˈpʊɾt*.
- 10¹² read *ˈmɪŋ miɫɫiˈɑɾd*.
- `1990 -1995` read *минус*: the sign rule (step 8) ran before the range rule.
- `5 г-ға` stranded *ʁɑ*.

**Done.**
- A word-initial cluster is the whole onset, the tt rule.
- триллион, attested ×2 in the mined artifact as 10¹² (a GDP figure).
- The sign rule refuses a hyphen after a number and a space.
- The gram rule glues a written case suffix, as the degree rule does.

**Goldens.** ba moved 19 rows, all initial-cluster stress (*sˈpʊɾt* → *ˈspʊɾt*, *ɡˈɾɑf* → *ˈɡɾɑf*, …).
