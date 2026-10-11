# Rust port: Greek (el)

Modern Greek is a rule-based, context-sensitive left-to-right scan with a synizesis lexicon
(`greek-synizesis.tsv`) and no neural model (`neuralRegistry.ts` does not list it), so `phonemize_best` is
`phonemize`. The import closure is `greek/{greek,manifest,normalize,numbers}.ts`, plus core `clauses`,
`loadTsv`, `loadManifest`, `numbers` (`digitIndex`), `normalizeSymbols` and `provenance`. Every one of those
core modules is already ported, so this port adds no core module.

## Run 1 — 2026-10-10 19:50 (baseline before any change)

**Question.** Is the tree green before Greek is registered, so that any parity change afterwards is Greek's?

**Command.** `cd rust && cargo build --release -p parity -p fn-diff && ./target/release/parity`.

**Raw finding.** `en en-GB ja it es pt pt-BR hi cmn fr`: each `200/200 identical, 0 differ`.

Haystack for the foreign-run dispatch change. Registering `el` makes a Greek run, and a lone Greek letter in
another script, read through the el engine instead of being dropped as port-pending.
`cut -f1 csharp/goldens/<l>.tsv | grep -cP '\p{Greek}'` is **0 for all ten** ported goldens. So the parity
gate cannot see the dispatch change for the other languages at all; it can only show that nothing else moved.
The el golden itself has 0 lines with Cyrillic/Han/Arabic/Hangul and 31 with Latin (English foreign runs).
FLEURS el_gr has 18 distinct lines with Cyrillic/Han/Arabic/Hebrew, which route to unported engines (ru, …).

**Implication.** Port the four modules, then gate.

## Run 2 — 2026-10-10 19:58 (per-module differentials and the golden, first build)

**Question.** Do `normalize.rs`, the scan and the three word entries in `greek.rs`, and `numbers.rs` match
their TS twins, and is the golden byte-identical?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts el-normalize|el-g2p > .probe/el/<name>.jsonl`, then
`LANGS=el … phonemize-sync|phonemize-best`, each replayed with `./target/release/fn-diff <name> …`.
Then `./target/release/parity el`. The inputs are the golden (102 distinct texts across 200 rows), FLEURS el_gr
(columns 3 and 4, 3,836 texts) and `probes/el.txt` (63 synthetic lines): 4,001 texts in all.
- `el-normalize`: `normalizeGreek` per text.
- `el-g2p`: `phonemizeWord`, `phonemizeWordRules` and `phonemizeWordForced` over every letter run of the
  texts, every `greek-synizesis.tsv` key, every 1–3 letter string over the 36-letter inventory (tonos and
  diaeresis vowels included), every 4-letter string over `αειουγκμπντσλχάίόύ`, and corners: an astral letter
  before a tonos (`𝔞ά`, `ά𝔞ια`, `κ𝔞ιά`), a lone surrogate, uppercase words with a final sigma, `İα`, and
  polytonic letters. Then `numberToWords` over 0..20000, 10^e±, 2^53±, 1.5, −3, 1e12−1 and five raw digit
  strings (the digit-by-digit fallback). 522,546 rows.

**Raw finding.** `el-normalize: 4001 identical, 0 DIFFER` (golden 102 / fleurs 3836 / probe 63),
`el-g2p: 522546 identical, 0 DIFFER`, `phonemize-sync: 4001 identical, 0 DIFFER`,
`phonemize-best: 4001 identical, 0 DIFFER`, `parity el: 200/200 identical, 0 differ`. All on the first build.

**Correction to Run 1.** The "18 FLEURS lines with Cyrillic/Han/Arabic/Hebrew" were a false count.
`grep -oP` shows that the only matched character is U+00B7 MIDDLE DOT, which PCRE's script extensions place
in those scripts. FLEURS el_gr has **no** non-Greek, non-Latin script at all. So no row is port-pending,
and the 602 FLEURS lines with Latin are read through the English foreign path. All of them are identical.

**JS semantics reproduced on purpose** (each is a comment in the Rust):
- `stressed` is built per CODE POINT (`[...raw]`) but indexed by UTF-16 position (`stressed[p]`, with `p` an
  index into `w`). Past an astral character the two are out of step. The `𝔞ά` corners pin it, and they agree.
- `w[i]`, `w.slice(i, i+2)` and every table lookup are by code unit, so a lone surrogate is an unknown
  letter that is skipped.
- `numberToWords` stays in f64, and the fallback spells `raw ?? String(Math.abs(n))` code point by code point.

**Object.prototype audit.** No lookup can reach the prototype. `C`/`V`/`TONOS`/`SYN_PAL`/`HOMOGLYPH`/
`LETTER_NAME`/`CLAUSE_MARK`/`GREEK_NUMERAL[run[i]]` are keyed by one character (no prototype member has a
one-character name). `VD`/`GREEK_NUMERAL[two]` take two characters (none has two). `WORD_ACRONYM` takes
`[A-Z]{2,}`, and every prototype member starts lowercase or with `_`. `DOTTED`/`ORD_ENDING` are keyed by a
match of their own keys' alternation. `FEMININE` is keyed by the number words.

## Run 3 — 2026-10-10 20:00 (per-arm coverage)

**Question.** Which normalize.ts arms does the differential actually exercise, per source?

**Command.** `npx tsx .probe/el/coverage.mts`. Each arm's TS pattern is copied and tested against the RAW
text, so an earlier arm that consumes a later arm's match is not modelled.

**Raw finding** (texts matched, golden / FLEURS / probe):
```
0 ano teleia 0/0/1        1 homoglyph touch 0/17/3   1 bare o 0/10/1         1 initial H/O 1/2/1
2 alpha numeral 0/6/3     3 dotted 1/44/6            4 βλ. 0/2/1             5 km/h 0/10/2
5 mi/h 0/2/1              5 mph 0/2/1                5 m/s 0/2/1             6 χλμ. 0/1/1
6 χλμ 0/17/2              7 de-group 3/77/1          8 ordinal 2/94/3        9 clock 1/27/1
10 °C 0/2/1               10 °F 0/0/1                10 ° 0/2/2              11 ± 0/0/1
11 + 0/2/2                11 ½¼¾ 0/2/1               11b = < > ÷ 0/0/1       11c dash 0/13/2
11d minus 0/1/1           12 % € $ £ 1/23/2          13 decimal 1/19/4       14 pH 0/2/1
14 caps run 6/61/6        14 single letter 2/63/15
normalize changed 16/421/46
```

**Implication.** Every arm is reached at least once. Only the probes reach U+0387, `°F`, `±` and the four
relational/division signs. The golden reaches 10 arms, so here too it is the weakest of the three gates.

## Run 4 — 2026-10-10 20:02 (foreign dispatch: Greek inside every other host)

**Question.** Registering `el` changes foreign-run dispatch. A Greek run inside another host now reads
through the el engine, and so does a lone Greek letter (core/scripts.rs spells it as its Greek name, `α` →
«άλφα»). Before this, the run was dropped as port-pending. No ported golden contains Greek (Run 1), so does
the dispatch match the TS anywhere?

**Command.** `npx tsx .probe/el/cross.mts sync|best`: 14 synthetic frames (lone `α β π Δ Ω ξ² ϐ ή`, `λόγος`,
`γ-ray`, `μ-`, polytonic `Ἡ ἀρχή`, all-caps `ΕΕ ΟΗΕ`, `Σ` in a formula) × the 10 other hosts, in the
phonemize-sync/best dump format, replayed with `fn-diff`. Then the guard was proved by reverting the fix: I
renamed the `"el"` build arm, rebuilt and replayed, then restored it.

**Raw finding.** `phonemize-sync: 140 identical, 0 DIFFER`, `phonemize-best: 140 identical, 0 DIFFER`. With the
el arm removed, `phonemize-sync: 30 identical, 110 DIFFER` (e.g. `Ω`: ts `omeɣa`, rust empty). Restored:
140/140 again. The full parity run stays at 200/200 for en en-GB ja it es pt pt-BR hi cmn fr.

**Implication.** The dispatch change is real (110 of 140 probe rows move) and faithful. The goldens cannot see
it, because none of them contains Greek.

## Run 5 — 2026-10-10 20:04 (TS findings from reading; reported, not fixed)

**Question.** Reading each file for correctness, not only for fidelity: what is wrong in the TS?

**Command.** `npx tsx .probe/el/check.mts` and `npx tsx .probe/el/teens.mts` (FLEURS column 3, 1,969 texts).

**Raw finding.**
1. **The cardinal teens are composed, not lexical.** `below100` builds 11–19 as `tens[1] + units[u]`:
   `numberToWords(11)` → «δέκα ένα» and `12` → «δέκα δύο». Greek says έντεκα and δώδεκα. 13–19 come out
   as two words («δέκα τρία», where the word is δεκατρία). `11000` → «δέκα μία χιλιάδες», `2011` → «… δέκα
   ένα». The clock's own `minuteTeens` table (greek.jsonc) already holds the right words. `Ήρθαν 11 άτομα.` →
   `iɾθan ðeka ena atoma .`. **59 of 1,969 FLEURS texts** reach a teen on the cardinal path (11 ×10, 15 ×10,
   16 ×6, 2016 ×4, 12 ×3, 2011 ×3 …; «δέκα χιλιάδες» for 10000, which is right, is excluded from the count).
2. **100 + n has no -ν.** `101` → «εκατό ένα», `111` → «εκατό δέκα ένα». Greek says εκατόν ένα. 20 FLEURS texts.
3. **U+037E GREEK QUESTION MARK is swallowed.** It lies inside TOKEN's letter range `Ͱ-Ͽ`, which is the same
   defect step 0 fixes for U+0387. `Τι κάνεις` + U+037E + ` Καλά.` → `ti kanis kala .`, and with ASCII `;` it is
   `ti kanis ? kala .`. There are 0 instances in FLEURS, so this is robustness only.
4. **NFD input breaks words.** The combining acute U+0301 is not in TOKEN's class, so a decomposed tonos
   splits the word, and the tonos-driven hiatus and synizesis are lost: `τσάι` NFC `t͡sai`, NFD `t͡sa i`.
   `κοιλιά` gives `ciʎa` and `cilia`, `ρολόι` gives `ɾoloi` and `ɾolo i`. Nothing on the Greek path composes
   to NFC. FLEURS has 0 combining marks.
5. **Polytonic letters are claimed and then dropped.** TOKEN includes Greek Extended `ἀ-῿`, but no table knows
   those letters, so the scan skips them: `ἀρχή` → `ɾçi`, `ὕδωρ` → `ðoɾ`, `Ἡ ἀρχή τοῦ λόγου.` → `ɾçi to loɣu .`
   (the article vanishes). FLEURS has 0 such letters. A fold of breathings/iota subscript to the monotonic
   letter would fix it.
6. **Manifest data that nothing reads** (question 2 of csharp/PORTING.md). These are `consonantDigraphs`,
   `palatal.γκ`/`palatal.γγ`, `numbers.hundred` and `numbers.and`. The scan HARD-CODES the digraph readings
   that `consonantDigraphs` also declares, so the table is a second home that can drift. It already
   disagrees: `γχ` is `ŋx` there, while the scan palatalises it to `ŋç` before a front vowel.
7. (Latent, unreachable from `text()`.) The code-point/code-unit mismatch of `stressed` (Run 2). TOKEN is BMP
   only, so only a direct `phonemizeWord` caller with an astral character can hit it.

**Implication.** Each one is reported in the PR, not fixed here. Rust reproduces the TS, and all seven are
pinned by the differential (the probes carry 3, 5 and 7 as well).

## Run 6 — 2026-10-10 20:04 (every gate)

**Command.** `cargo fmt`, `cargo build --release -p parity -p fn-diff`, all four el dumps replayed,
`./target/release/parity`, `./target/release/parity --sync el`, `cargo run --release -p regex-diff`,
`cargo test --workspace --release`, `cargo clippy --workspace --all-targets --release`.

**Raw finding.**
- fn-diff: `el-normalize 4001/4001`, `el-g2p 522546/522546`, `phonemize-sync 4001/4001`,
  `phonemize-best 4001/4001`, all 0 DIFFER.
- parity: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr and el each `200/200 identical, 0 differ`. `--sync el`
  200/200.
- regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns refused`. No TS regex was added, so the
  corpus is not regenerated. The three runtime-built Greek patterns (DOTTED_ALT, ORD_ALT, the `pH` pattern)
  are covered by `el-normalize`.
- tests: 104 + 1 passed, 0 failed (3 new: the manifest loads, hiatus/synizesis, both ano teleia code points).
- clippy: the Greek files add only `module_inception` (`greek/greek.rs`), which the mirror-the-tree rule
  gives every language (`italian/italian.rs` …). I collapsed the four `collapsible_if` it raised in greek.rs.
  The other warnings in the workspace predate this branch.

**Port-pending.** None. No el golden, FLEURS or probe text carries a script other than Greek, Latin and Common.

**Implication.** Greek is done by the checklist.

## Run 7 — 2026-10-11 14:19 (#1510: baseline of the seven Run-5 findings, before any fix)

**Question.** Do the seven findings of Run 5 still reproduce on main, and what do the digraph cases read
as today? These are the outputs that item 6's rewiring must not move.

**Command.** `npx tsx .probe/el/fix1510.mts` (synthetic numbers, phrases and words only).

**Raw finding.**
- Teens: `11` «δέκα ένα» … `19` «δέκα εννέα»; `11000` «δέκα μία χιλιάδες»; `13000` «δέκα τρεις χιλιάδες»;
  `2016` «δύο χιλιάδες δέκα έξι»; `13000000` «δέκα τρία εκατομμύρια».
- 100 + n: `101` «εκατό ένα», `111` «εκατό δέκα ένα», `101000` «εκατό μία χιλιάδες».
- U+037E: `Τι κάνεις`+U+037E+` Καλά.` → `ti kanis kala .`; with ASCII `;` → `ti kanis ? kala .`.
- NFD: `τσάι` → `t͡sa i`, `κοιλιά` → `cilia`, `ρολόι` → `ɾolo i` (NFC: `t͡sai`, `ciʎa`, `ɾoloi`).
- Polytonic: `ἀρχή` → `ɾçi`, `ὕδωρ` → `ðoɾ`, `Ἡ ἀρχή τοῦ λόγου.` → `ɾçi to loɣu .`, `ᾠδή` → `ði`,
  `ῥήτωρ` → `itoɾ`, `Ἀθῆναι` → `θne`.
- Astral: `phonemizeWord("😀τσάι")` → `t͡se` (the hiatus lost), against `t͡sai` without the emoji.
- Digraph baseline (item 6 must keep these): άγγελος aŋɟelos, αγγίζω aŋɟizo, έλεγχος eleŋxos,
  ελέγχει eleŋçi, σφίγγει sfiŋɟi, φθόγγος fθoŋɡos, γκέι ɟei, Σφίγξ sfiŋks, αγκίστρι aŋɟistɾi, μπίρα biɾa,
  άντε ande, τσέπη t͡sepi, τζάκι d͡zaci, κέικ ceik, χέρι çeɾi, γέρος ʝeɾos.

**Implication.** All seven reproduce. Fix order: numbers (1, 2), then step 0 of normalize (3, 4, 5), then the
scan (6, 7).

## Run 8 — 2026-10-11 14:25 (#1510: the TS fixes, measured)

**Question.** Does each fix move exactly what it should, and nothing else?

**Changes.** numbers: `numbers.teens` (10–19, by unit) replaces `ten`; `tens[1]` emptied; `hundred` is now
εκατόν and is read for 100 + remainder; FEMININE gains δεκατρία→δεκατρείς, δεκατέσσερα→δεκατέσσερις;
`numbers.and` deleted (Greek has no cardinal «and»). normalize step 0: `renormalize(input, "NFC")`, which
also takes U+0387→U+00B7 and U+037E→`;` (both canonical singletons, so the old U+0387 rewrite is subsumed),
then a per-letter fold of Greek Extended (NFD, drop U+0313 U+0314 U+0345, U+0300/U+0342→U+0301, NFC). The
scan reads `consonantDigraphs` (now the digraph's own sound: γχ "x", γξ "ks") and `palatal` (gains γχ "ç"),
and builds `stressed` per UTF-16 unit.

**Command.** `npx tsx .probe/el/fix1510.mts` (diffed against Run 7), `npx tsx tools/gen_parity_goldens.mts el`,
a word-level diff of the golden, and a revert script (each fix reverted in turn, the #1510 tests run).

**Raw finding.**
- Probe: every Run-7 defect line moved to the intended reading (`11` έντεκα, `101` εκατόν ένα, `13000`
  δεκατρείς χιλιάδες, U+037E → `ti kanis ? kala .`, NFD `τσάι` → `t͡sai`, `Ἡ ἀρχή τοῦ λόγου.` →
  `i aɾçi tu loɣu .`, `😀τσάι` → `t͡sai`). All 16 digraph words are byte-identical to Run 7. An NFD Latin
  `à` in the same line is untouched.
- Golden el: 7 rows of 200 move, all numbers: `ðeka efta`→`ðekaefta` ×2, `ðeka pende`→`ðekapende` ×2,
  `ðeka eksi`→`ðekaeksi` ×2 (item 1), `ekato`→`ekaton` ×1 (item 2). Nothing from items 3–7 (the golden has no
  NFD, polytonic, U+037E or astral text), as expected.
- `test/greek.test.ts`: one existing expectation moved, the apposition-dash case `kɾom , ðeka ðio` →
  `kɾom , ðoðeka` (12 is δώδεκα).
- Revert proofs: teens reverted → 2 tests fail (the teens test, and the εκατόν test, which reads 111);
  εκατόν reverted → 1; NFC reverted → 2 (U+037E and NFD); polytonic fold disabled → 1; per-code-point
  `stressed` restored → 1.
- ⚠ DEAD END in the harness, worth keeping: the revert script for the polytonic fold first failed its own
  assertion, because the file-writing tool had rewritten the `ἀ-῿` escapes in the SCRIPT into
  literal characters. The engine source was written with doubled escapes and is intact (checked by grep).
- Item 6 cannot be proved by a revert: moving the scan onto the tables is behaviour-neutral by design. Its
  test pins the digraph readings, so a drift in either table is caught.

**Implication.** Mirror into C# and Rust; the golden moves only by items 1 and 2.

## Run 9 — 2026-10-11 15:09 (#1510: the mirrors, and two goldens I did not expect)

**Question.** Do C# and Rust match the fixed TS, and does the fix reach any golden outside el?

**Command.** `npm run check:goldens` (all 189); `npx tsx tools/check-goldens.mts --show 3 gan syl`;
`npx tsx tools/gen_parity_goldens.mts gan syl`; `dotnet test csharp/Vernacula.Phonemizer.Tests` (full);
`dotnet run -c Release --project csharp/tools/parity` (all, then `-- el gan syl`), `.../regex-diff`;
`cd rust && cargo fmt --check && cargo test --release && cargo run --release -p parity && cargo run --release
-p regex-diff`; the four el fn-diff dumps re-made and replayed; a Rust revert script (each fix reverted in
turn, `greek::greek::tests` run).

**Raw finding.**
- ⚠ check:goldens: el fresh after Run 8's regeneration, but **gan and syl stale, 1 row each**. Both rows
  carry an embedded POLYTONIC Greek word that the script router hands to el. One is a person's name in a
  Chinese-script row, which used to drop its initial Ἀ (`ɾçimiðis` → now `aɾçimiðis`); the other is a name in
  a Sylheti row whose ὕ was dropped (`ea` → now `eva`). Item 5, so the goldens were wrong, not the engine.
  Regenerated both; the word-level diff is exactly those two words.
- C#: full suite 7486 passed, 0 failed. Parity 188 identical and 1 differ before the gan regeneration, the
  differ being that gan row with C# already giving `aɾçimiðis`; after it, `el gan syl` 600/600. regex-diff
  145060 identical, 0 DIFFER. The 7 new C# tests: with the Greek C# sources reverted to HEAD, 6 fail; the
  digraph pin passes, as a behaviour-neutral change must.
- Rust: fmt clean; 193 + 1 tests pass (7 new). Parity: all 51 languages identical except mag 199/200 (the
  known Arabic row). `--sync el` 200/200. regex-diff 145060 identical, 0 DIFFER, 0 refused. fn-diff:
  `el-normalize 4006/4006`, `el-g2p 522606/522606`, `phonemize-sync 4006/4006`, `phonemize-best 4006/4006`
  (probes/el.txt gains five synthetic lines: U+037E, a decomposed tonos, polytonic text, an NFD Latin grave,
  and the teens/εκατόν numbers).
- Rust reverts: teens → 2 fail; εκατόν → 1; NFC → 3 (U+037E, NFD, and the old ano-teleia test, because NFC
  now owns U+0387); polytonic → 1; per-code-point `stressed` → 1.
- The old Rust step-0 regex was written as a literal U+0387 character where the TS wrote `·`. It is gone
  with the rewrite; every new Rust pattern uses the TS's `\uXXXX` escapes.

**Implication.** All seven items fixed. Goldens moved: el 7 rows, gan 1, syl 1.
