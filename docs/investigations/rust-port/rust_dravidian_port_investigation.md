# Rust port: the Dravidian group (kn, te, ta, ml, si)

Kannada (`src/languages/kannada/`), Telugu (`telugu/`), Tamil (`tamil/`), Malayalam (`malayalam/`) and Sinhala
(`sinhala/`). One log for the group: all five are the generic abugida G2P plus a light post-pass, a normalizer and a
number compositor, and kn, te and ml share one core composer (`dravidianNumberWords`).

## Run 0 — 2026-10-15 03:14 (import closure)

**Question.** What do the five engines reach that the Rust crate does not already have, and does any have a neural
entry or import another language's module?

**Command.** `cat src/languages/{kannada,telugu,tamil,malayalam,sinhala}/*.ts | grep "^import" | sort | uniq -c`;
`grep -n "kannada|telugu|tamil|malayalam|sinhala" src/registry.ts src/neuralRegistry.ts`; a read of each named
Rust core module; a tsx print of each manifest's top-level keys (`keys.mts`, scratchpad).

**Raw finding.**
- Core imports: `abugida`, `boundaries`, `clauses`, `hostWord` (`LATIN_RUN`), `loadManifest`, `phonology`,
  `normalizeSymbols`, `postposedSign`, `provenance` (`rewrite`), `unicode` (`foldNativeDigits`) — all ported — and
  `numbers` (`dravidianNumberWords`, `DravidianForms`, `DravidianNumbersDef`), which is NOT: `core/numbers.rs` says
  "PARTIAL: `dravidianNumberWords` is ported with its first consumer". kn is that consumer.
- No neural entry for any of the five; no cross-language import. Registry codes `kn`, `te`, `ta`, `ml`, `si`;
  kn/te/ml take `readAsEnglish` as the foreign reader, ta and si take none (and have no Latin arm in their
  tokenizer). `te` is in `FOLD_OPT_OUT`; `kn` and `te` are in `VULGAR_FOLD_OPT_OUT` (both already in the Rust
  registry's lists). None has a Roman policy.
- Goldens: 200 rows each. FLEURS: `kn_in`, `te_in`, `ta_in`, `ml_in`; nothing for si (probes carry it there).
- Test files: test/{kannada,telugu,tamil,malayalam,sinhala}.test.ts.
- Cf characters the TS writes as LITERALS (to be kept literal, audited by code point): kn's zero-width class
  (U+200B U+200C U+200D U+FEFF); te's and ta's range U+200B-U+200D plus U+FEFF, and te's ZWNJ inside its
  Fahrenheit word; si's class (U+200B-U+200D, U+2060, U+FEFF, U+00AD) and the ZWJ inside two of its expansion
  words. ml writes its joiners as `\u200d` / `\u200b…` ESCAPES, and those stay escapes.

**Implication.** Port `dravidianNumberWords` into `core/numbers.rs` (its own TS file is `core/numbers.ts`, so the
mirrored Rust file is the existing one) with kn, then kn → te → ta → ml → si.

## Run 1 — 2026-10-15 03:40 (kn, and the shared Dravidian composer)

**Question.** Does Kannada (its manifest, `numbers.ts` on the newly ported `dravidianNumberWords`, `normalize.ts`
and the engine) match the TS call for call, and did the literals survive the write?

**What was written.** `core/numbers.rs` gained `DravidianForms`, `DravidianNumbersDef` and `dravidian_number_words`
(the PARTIAL note removed). A missing table entry is the TS `undefined`, which `join(" ")` renders as "", so the
composer returns `Vec<String>` with "" in that slot. kn's zero-width class (U+200B U+200C U+200D U+FEFF) is LITERAL
in the TS; it was written as a placeholder and the four code points inserted by a byte-level edit (`ph.py`). The
`dravidian` dump (`dump.mts`, over LANGS) and its replay arm are shared by the whole group; FLEURS_DIR learned
kn/te/ta/ml.

**Command.** `audit.sh kannada` (the three code-point audits); `cargo run --release -p parity -- kn`;
`LANGS=kn dump.mts dravidian` → `fn-diff dravidian`; `e2e.sh kn` (phonemize-sync, phonemize-best, trace); two
mutations of the composer; `pins.sh kannada kn` then the Rust suite test; a TS print of two edge inputs (`p.mts`).

**Raw finding.**
- Audits: 24 raw patterns, 3 misses, all `format!` templates checked by hand against the TS template strings (the
  ordinal rule, the rate rule, the token); 95 non-ASCII runs, 0 missing; 0 TS escapes. The four Cf characters are
  present once each, as in the TS.
- `kn: 200/200 identical`.
- `dravidian (kn): 54011 identical, 0 DIFFER` (golden 244, fleurs 7028, probe 22, synthetic 8216, number 3068 text
  rows; the rest word / words / ordinal).
- Mutation 1, `h != 1` → `h != 2` in the hundreds branch: still 0 DIFFER — kn's `hundredForms` covers counts 1, 2,
  3, 5 and 9, so neither count reaches that branch in Kannada (a dead mutation, not a blind harness). Mutation 2,
  the count-1 combining form → bare: `49213 identical, 4798 DIFFER` (golden 6, fleurs 151, number 1005). Reverted.
- `phonemize-sync / phonemize-best / trace: 3647 identical, 0 DIFFER` each.
- test/kannada.test.ts: 65 calls pinned (64 matchers, all green under the shim); the Rust test passes.
- TS prints: `10 ಕಿ.ಮೀ. ದೂರ` → `hˈat̪ːu kˈiloːmiːʈaɾ . d̪ˈuːɾa` (the dotted unit's trailing dot survives as a
  clause pause; te's KM_RE consumes `\.?`, kn's does not); `½ ಭಾಗ` → `bʱˈaːɡa` (the fraction is dropped: kn is in
  `VULGAR_FOLD_OPT_OUT`, but its own step 8 needs a digit before the sign).

**Implication.** kn done. Two TS observations to report (not fixed): the kn unit abbreviation leaves its trailing
dot as a pause, and a bare vulgar fraction is dropped in kn because the opt-out pre-empts the shared fold while the
local rule only covers the digit-adjacent case.

## Run 2 — 2026-10-15 04:05 (te: an escape class written back as literal characters, and a TS ordering defect)

**Question.** Does Telugu (manifest, numbers with the century reading, normalizer with the ౦ homoglyph rule,
engine) match the TS, and did the literals survive the write?

**Command.** `audit.sh telugu`; `parity -- te kn`; `LANGS=te dump.mts dravidian` → `fn-diff dravidian`; a mutation
(`mutate.py`: the homoglyph rule's left-neighbour test dropped); `e2e.sh te`; `pins.sh telugu te` and the Rust test;
a TS print of numerals in the century band carrying a currency, a percent and a unit (`p.mts te …`).

**Raw finding.**
- The audit caught the editor damage on the first write: `TE_LETTER`, `"\\u0C00-\\u0C65\\u0C70-\\u0C7F"` in the TS
  (a regex built from ESCAPES), came back as four literal characters in the Rust (`escape_audit`: `4 TS escapes, 4
  code points short`; `nonascii_audit`: two runs `U+0C65 U+0C70` and `U+0C7F` not in the TS). Same class, different
  code points. Restored by a byte-level line replacement (`setline.py`, which spells the backslash `BS`); after it
  `111 non-ASCII runs, 0 not found`, `4 TS escapes, 0 short`. The 6 raw-pattern misses are `format!` templates,
  checked by hand. The same write had also folded the `\u200d`/`\u200c`/`\ufeff`/`\u200b` escapes in the kn section
  of the `dravidian` dump into literal characters (harmless to the TS, unreadable in review); `escape_cf.py`
  rewrites any literal Cf inside that dump entry as an escape, and `insert_l.py` runs it after every insertion.
  Rule for the rest of the group: an escape is never typed — it is written as a placeholder and substituted.
- `te: 200/200`, `kn: 200/200`.
- `dravidian (te): 54053 identical, 0 DIFFER` (golden 230, fleurs 6860, probe 20, synthetic 6104, number 3068).
  Mutation: `53965 identical, 88 DIFFER` (golden 4, fleurs 72, synthetic 12); reverted.
- `phonemize-sync / phonemize-best / trace: 3555 identical, 0 DIFFER` each.
- test/telugu.test.ts: 71 calls pinned (68 matchers, all green); the Rust test passes.
- TS prints: `$1500` → `pˈad̪iheːnu ʋˈãn̪d̪alu` (no dollar word) against `$2500` → `… ɖˈaːlaɾlu`; `1500%` →
  `pˈad̪iheːnu ʋˈãn̪d̪alu` (no percent word) against `2500%` → `… ʃˈaːt̪am`; `1200 km` keeps its unit (singular).

**Implication.** te done. TS defect to report (not fixed): telugu/normalize.ts reads every 1100-1999 numeral as a
century year BEFORE the symbol tier runs, so a currency sign or a percent sign on a number in that band has no
number left to attach to and is dropped (`$1500`, `1500%`).

## Run 3 — 2026-10-15 04:30 (ta)

**Question.** Does Tamil (its own sandhi-fused composer, the unit segmenter, the voicing allophony and two-level
stress, the normalizer with fractions and ordinal suffixes) match the TS?

**Command.** `audit.sh tamil`; `parity ta`; `LANGS=ta dump.mts dravidian` (normalize / text / word as for kn and te,
plus `numberToWords` with and without `raw` over the value grid, on floats at and past 10^10 and 10^21, on -1, NaN and
Infinity, and `ordinalStem` over every word the composer produces) → `fn-diff dravidian`; a mutation (the ʈ coda
exception dropped from the voicing condition); `e2e.sh ta`; `pins.sh tamil ta`; a TS print of ordinals on long
digit runs (`p.mts ta …`).

**Raw finding.**
- Audits: 25 raw patterns, 6 misses, all `format!` templates checked by hand; 109 non-ASCII runs, 0 missing;
  the zero-width range written by placeholder (U+200B U+002D U+200D U+FEFF); 0 TS escapes.
- `ta: 200/200`.
- `dravidian (ta): 45279 identical, 0 DIFFER` (golden 262, fleurs 7328, probe 22, synthetic 7952, number 3068).
  Mutation: `44307 identical, 972 DIFFER` (golden 26, fleurs 612); reverted.
- `phonemize-sync / phonemize-best / trace: 3806 identical, 0 DIFFER` each.
- test/tamil.test.ts: 97 calls pinned (97 matchers, all green); the Rust test passes.
- `numberToWords(n)` at 10^10 and above with no `raw` reads `String(n)`, reproduced with `js_number_to_string`.
  The one caller that passes no `raw` with an unbounded n is the ordinal step, which, unlike kn, te and ml, has no
  safe-integer guard: `12345678901234567891ஆம்` reads the digits of `12345678901234567000` (the float), ending
  `… ˈeːɻʊ pˈuːd͡ʒːɪjɐm pˈuːd͡ʒːɪjɐm pˈuːd͡ʒːɪjˌɐmaːm` where the bare numeral reads `… ˈeʈːʊ ˈonbɐd̪ʊ ˈonrʊ`;
  past 10^21 the digits come from the exponent form (`1.2345678901234568e+21`), so the reading ends `… ˈeʈːʊ ˈɪɾɐɳɖʊ
  ˈonraːm` — digits the writer never typed.

**Implication.** ta done. TS defect to report (not fixed): tamil/normalize.ts's ordinal step composes from
`Number(digits)` with no safe-integer guard and no `raw`, so an ordinal on a run of 17+ digits reads a different
digit string from the one written (the bare numeral path passes `raw` and is right).

## Run 4 — 2026-10-15 04:55 (ml)

**Question.** Does Malayalam (chillu expansion, samvritokaram, the anusvara and voicing rules, the shared composer
with suppletive thousands, the ordinal / plural / oblique clitics) match the TS, and did its ESCAPED joiners stay
escapes?

**What was written.** ml is the one language here whose TS writes its joiners as escapes (`/([ണനരലളക])്\u200d/` and
`[\u200b\u200c\u200d\ufeff]`). Per Run 2's rule they were written with a `@BS@` placeholder for the backslash and
substituted byte-level (`ph.py … @BS@ 5c`), never typed.

**Command.** `audit.sh malayalam`; `parity ml`; `LANGS=ml dump.mts dravidian` (normalize / text / word, plus
`numberToWords`, `ordinalToWords`, `cliticToWords` with each stem kind over the value grid, and the three stems over
every composed word) → `fn-diff dravidian`; a mutation (the retroflex post-nasal voicing `ɳʈ → ɳɖ` removed);
`e2e.sh ml`; `pins.sh malayalam ml`.

**Raw finding.**
- Audits: 21 raw patterns, 2 misses (`format!` templates: the token and the clitic builder, checked by hand); 144
  non-ASCII runs, 0 missing; `5 TS escapes, 0 code points short` — the escapes survived as escapes.
- `ml: 200/200`.
- `dravidian (ml): 90877 identical, 0 DIFFER` (golden 212, fleurs 7666, probe 16, synthetic 33464, number 3068).
  Mutation: `85666 identical, 5211 DIFFER` (golden 48, fleurs 1650); reverted.
- `phonemize-sync / phonemize-best / trace: 3947 identical, 0 DIFFER` each.
- test/malayalam.test.ts: 43 calls pinned (one more returns the engine object and is skipped); 43 matchers green; the
  Rust test passes.

**Implication.** ml done; no TS defect found by the reading or the probes.

## Run 5 — 2026-10-15 05:20 (si)

**Question.** Does Sinhala (its homorganic anusvara, schwa alternation and stress post-pass, its own analytic
composer in JS `Number` arithmetic, and the normalizer with its own symbol tier in prefix position) match the TS?

**What was written.** The joiner class (U+200B-U+200D, U+2060, U+FEFF, U+00AD) and the ZWJ inside four expansion
words are LITERAL in the TS and were substituted byte-level from placeholders; the three `−` / `⁰`
escapes in `SIGN` / `DEG` are ESCAPES in the TS and were substituted from `@BS@`. The `&nbsp;` replace inside
`stripJoiners` is a plain replace in the TS (off the provenance seam) and stays one. The composer is kept in `f64`:
it has no safe-integer guard, so a long run is composed from the float exactly as the TS does.

**Command.** `audit.sh sinhala`; `parity si`; `LANGS=si dump.mts dravidian` (no FLEURS: the golden, `probes/si.txt`
and synthetic grids over every arm, each joiner, each abbreviation, the initials, the degree and rate forms, the
million suffix, the tier's currencies and units; words over every Sinhala run and the consonant × tail grids;
`numberToWords` on the value grid and on 10^10, 10^15, 10^21, 1.5e22, 1e300, 2^53+2, 2.5, 99.9, -1, NaN, Infinity)
→ `fn-diff dravidian`; two mutations (the double-space collapse removed; the schwa rule's word-end test forced
false); `e2e.sh si`; `pins.sh sinhala si`; a TS print of unsafe integers (`p.mts si …`).

**Raw finding.**
- Audits: 33 raw patterns, 2 misses (`format!` templates: `abbrev` and the plain-degree rule, checked by hand);
  135 non-ASCII runs, 0 missing; `3 TS escapes, 0 short`; each Cf character present as in the TS.
- `si: 200/200`.
- `dravidian (si): 24978 identical, 0 DIFFER` (golden 400, probe 18, synthetic 1600, number 3068).
  Mutation 1: `24934 identical, 44 DIFFER` (golden 6); mutation 2: `24711 identical, 267 DIFFER` (golden 45).
  Both reverted.
- `phonemize-sync / phonemize-best / trace: 209 identical, 0 DIFFER` each.
- test/sinhala.test.ts: 71 calls pinned (72 matchers, all green); the Rust test passes.
- TS prints: `9007199254740993` and `9007199254740992` give the SAME reading (the float), ending `… ˈanuːd̪ˌekə`
  (…92); `100000000000000000000000` reads as the float's digits (`99999999999999991611392`), not as 10^23.

**Implication.** si done. TS defect to report (not fixed): sinhala/numbers.ts composes any digit run from
`Number(digits)` with no safe-integer guard and no digit-at-a-time fallback (the `spellDigits` shape the rest of the
fleet uses), so above 2^53 it reads a confidently wrong quantity.

## Run 6 — 2026-10-15 06:10 (rebase onto main 6bebb881, every gate on the combined tree)

**What changed.** origin/main gained the East Indic (#1582) and west (#1583) groups. Rebasing the five commits
conflicted in `registry.rs` on every commit (LANGUAGES header and tail, and the `build` arms), and on the kn commit
also in `dump.mts` (FLEURS_DIR and the end of the dumps table) and `fn-diff/src/main.rs` (the end of the replay
match). Both sides were kept everywhere (`resolve.py`). In main.rs git had factored the shared `})` / `}` out of
the hunk, so it was restored as glue. LANGUAGES was de-duplicated and recounted (`fixcount.py`): 86 → 91.
`dump.mts` parses.

**Command.** `final.sh` (scratchpad): the esbuild parse check, `gates.sh` (fmt, build, parity over all languages,
regex-diff, clippy, test), `e2e.sh kn,te,ta,ml,si`, and the `dravidian` dump over all five, replayed.

**Raw finding.**
- fmt clean; build 0 warnings.
- parity: every line 200/200 (hil 112/112, ilo 94/94, nog 68/68), except mag 199/200, tt 199/200 and syl 195/200,
  which are the known port-pending rows. kn, te, ta, ml, si: 200/200.
- regex-diff: `146326 probe results identical, 0 DIFFER, 0 patterns refused`.
- clippy: in the five new modules only their five `module_inception` warnings; none in fn-diff.
- cargo test: 289 + 1 passed, 0 failed (including the cross-host test: each of the five scripts inside `en` and `hi`
  text reaches its engine through the script router, and none of the five is port-pending).
- combined end to end: `phonemize-sync / phonemize-best / trace: 15164 identical, 0 DIFFER` each.
- combined `dravidian`: `269198 identical, 0 DIFFER` (golden 1348, fleurs 28882, probe 98, synthetic 57336, number
  15340).

**TS findings, reported and not fixed (the Rust reproduces each).**
1. te: the century-year rule runs before the symbol tier, so `$1500` and `1500%` lose their currency and percent
   words (Run 2).
2. ta: the ordinal step has no safe-integer guard and passes no `raw`, so an ordinal on a 17+ digit run reads the
   float's digits (Run 3).
3. si: the composer has no safe-integer guard and no digit-at-a-time fallback; above 2^53 it reads a wrong quantity
   (Run 5).
4. kn: `KM_RE` leaves a dotted unit's trailing dot as a clause pause (Run 1).
5. kn: in `VULGAR_FOLD_OPT_OUT`, but its own rule only covers a digit-adjacent fraction, so a bare `½` is dropped
   (Run 1).

**Port-pending.** None.

**Implication.** Ready for the PR.
