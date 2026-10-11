# Rust port: the Hindi belt (bho, mag, awa, mai, hne, rkt, ne, mr)

Eight engines built on the already-ported Hindi maker (`makeNativeHindi`, `rust/.../languages/hindi/`): six
dialect wrappers (`src/languages/{bhojpuri,magahi,awadhi,maithili,chhattisgarhi,rangpuri}`) that pass their own
`.jsonc` and at most one post-pass, plus Nepali and Marathi, which bring their own normalizers and symbol tiers.
One log for the group, because the six share almost everything. Ported in that order, one commit each.

## Run 0 — 2026-10-10 09:10 (import closure)

**Question.** What do the eight reach that the Rust crate does not have yet?

**Command.** `grep -n "^import" src/languages/{bhojpuri,magahi,awadhi,maithili,chhattisgarhi,rangpuri,nepali,marathi}/*.ts`,
then `grep -n` for each imported name under `rust/vernacula-phonemizer/src/`; `src/neuralRegistry.ts` and
`ROMAN_POLICIES` in `src/registry.ts` for the eight codes.

**Raw finding.**
- bho, mag, hne, rkt: `makeNativeHindi`, `loadManifest`, `loadSharedPhonology`. All ported.
- awa: plus `noteRewrite` (core/trace, ported). The intervocalic flap is the module's only code.
- mai: plus `rewrite` and `makeHindiNormalizer` (ported); the U+0951 fold wraps normalize and the word entries.
- ne: plus `makeSymbolNormalizer` (ported), `noteRewrite`, `PUA_SENTINEL` from `core/markers.ts` (**not
  ported**; a 3-constant module, so it gets its own `core/markers.rs`), and its own `normalize.ts` (459 lines).
- mr: plus `makeSymbolNormalizer` and its own `normalize.ts` (388 lines), driven by a `MarathiDef` that
  extends `HindiDef` with 18 more manifest keys.
- No neural entry and no Roman policy for any of the eight. FLEURS has only `ne_np` and `mr_in`; the other six
  have a golden and probes only.
- Every manifest already loads through Rust's `HindiDef` (the hi port's `family_manifests_load_as_hindi_def`).
  Only magahi declares `ordinalSuffixes`; none declares `symbolTier`.

**Implication.** No large core module is missing. The six dialects are a manifest each (plus awa's flap and
mai's fold); ne and mr are a normalizer port each. Order as assigned.

## Run 1 — 2026-10-10 09:40 (bho: port, golden, word level, end to end)

**What changed.** `languages/bhojpuri/bhojpuri.rs` (`create_bhojpuri`, `engine`), the registry arm, and
`hindi::manifest::load_family_def` (one cell per family member, so the def is `&'static` as `make_native_hindi`
needs). fn-diff gained one dump/replay pair, `hindi-family-word`: each language's OWN create function's `word`,
`wordRules` and `number` over every Devanagari run of that language's texts, every consonant of ITS manifest x
{each sign, each matra, matra + anusvara/chandrabindu, ZWJ, ZWNJ, avagraha, U+0951} in four frames, conjuncts
(including ड/ढ, for awa's flap later), independent vowels, and the hi-word digit strings. `langTexts` now also
replays `probes/hi.txt` for the six dialects (they inherit Hindi's normalizer and tier unchanged), plus each
dialect's own `probes/<code>.txt` (synthetic).

TS test pins: `.probe/hindi-belt/pins.mts` walks the test file with the TypeScript compiler API, takes every
engine call whose arguments are literals (`phonemizeWord`, `phonemize(x, lang)`, the `say`/`mr`/`t` aliases,
`e.word`, `rkt.text`, `getPhonemizer(l).text`), runs it through the TS engine, and fails if any `toBe` literal
disagrees with that output. So relational assertions (`toBe(bho(…))`, `toContain`) are carried as the readings
both sides produced, not just the literal ones.

**Commands and raw counts.**
- `cargo run --release -p parity -- bho hi`: `bho: 200/200 identical, 0 differ`; `hi: 200/200`.
- `.probe/hindi-belt/run.sh bho` (dumps, then replays): `hindi-family-word: 23316 identical, 0 DIFFER`;
  `phonemize-sync: 318 identical, 0 DIFFER`; `phonemize-best: 318 identical, 0 DIFFER` (golden +
  hi.txt + bho.txt; no FLEURS).
- `pins.mts test/bhojpuri.test.ts bho`: 17 calls, 17 distinct, 16 `toBe` literals cross-checked.
- Mutation (harness can see a bho-specific rule): `retain_on_avagraha` forced false in hindi.rs, rebuilt,
  replayed: `hindi-family-word: 23310 identical, 6 DIFFER` (e.g. `खइलऽ` rust `kʰˈəil`), `phonemize-sync: 315
  identical, 3 DIFFER`. Reverted; `git diff` on hindi.rs empty.
- `cargo test --release --workspace`: 130 + 1 passed. `cargo fmt --check` clean. `cargo clippy --workspace`:
  the only new warning is `module_inception` on `bhojpuri/mod.rs`.

**Implication.** bho is done. Nothing port-pending (the only foreign reader it calls is `en`). No TS defect found
beyond the two the TS header already files (ऋ was the trill; the inherited Hindi tier); both are pinned readings.

## Run 2 — 2026-10-10 10:05 (mag)

**What changed.** `languages/magahi/magahi.rs`, generated from the same template as bho (the two TS modules are
the same shape; `.probe/hindi-belt/gen_plain.py` writes the module, the registry arm and the `LANGUAGES` entry).
`probes/mag.txt`: the flat glide hardening, the `मा` ordinal (fused, spaced, before a postposition, after the
suppletive digits 1/2/3/4/6, above 2^53) and a standalone मा.

**Commands and raw counts.**
- `parity -- mag bho`: `mag: 199/200 identical, 1 differ`; `bho: 200/200`. The one row carries an ARABIC run
  (`(अरबी: صنعاء)`): TS reads `sˤnʕˈaːʔ` through the script reader to `ar`, Rust drops it. `ar` is not ported,
  so this is port-pending, not a mag defect. Pinned by `an_arabic_run_is_pending_on_ar_until_it_is_ported`
  (asserts `port_pending()` holds `ar` exactly while `ar` is absent from `LANGUAGES`, so it flips correctly
  when ar lands).
- `run.sh mag`: `hindi-family-word: 24990 identical, 0 DIFFER`; `phonemize-sync: 383 identical, 1 DIFFER`;
  `phonemize-best: 383 identical, 1 DIFFER`. The DIFFER is the same Arabic golden row.
- `pins.mts test/magahi.test.ts mag`: 30 calls, 26 distinct, 22 `toBe` literals cross-checked (two are bho
  words the magahi suite compares against).
- Mutation: hindi.rs passing `ordinal_suffixes: None` (so mag falls back to Hindi's table):
  `phonemize-sync: 376 identical, 8 DIFFER` (the seven `मा` probe lines plus the Arabic row). Reverted.
- `cargo test --release --workspace`: 132 + 1 passed. fmt clean. clippy: only `module_inception` on `magahi/mod.rs` new.

**Implication.** mag is done except one port-pending golden row (needs `ar`).

## Run 3 — 2026-10-10 10:35 (awa, and both trace dumps for all three so far)

**What changed.** `languages/awadhi/awadhi.rs`: an `Awadhi` wrapper whose `word`, `word_rules`, `number` and
`text` each pass the base engine's output through the flap (`FLAP`, the TS pattern string built from the same
`V` class), and whose `text` reports the post-pass as `note_rewrite("awadhi-flap", …, positional = true)`.
`run.sh` now also replays the `trace` and `phonemize-trace` dumps (tokens, spans, rewrite stages).
`probes/awa.txt`: the flap in each context it must take (intervocalic, after a long vowel, across ˈ, into an ʌi/ʌu
diphthong) and each it must decline (after ɳ, after a nasalised vowel, word-initial, geminate, across a space),
plus number words that carry a ड.

**Commands and raw counts.**
- `parity -- awa bho mag hi`: awa 200/200, bho 200/200, mag 199/200 (the ar row), hi 200/200.
- `run.sh bho mag awa`:
  - bho: word 23316/0, sync 318/0, best 318/0, trace 318/0, phonemize-trace 318/0.
  - mag: word 24990/0, sync 383/1, best 383/1, trace 383/1, phonemize-trace 383/1 (the ar row each time).
  - awa: word 25724/0, sync 378/0, best 378/0, trace 378/0, phonemize-trace 378/0.
- `pins.mts test/awadhi.test.ts awa`: 29 calls, 29 distinct, 29 `toBe` literals cross-checked.
- Mutations, one at a time, reverted after:
  - `ʌ` dropped from `V` (the test file says the diphthong lookahead is load-bearing): `hindi-family-word:
    25668 identical, 56 DIFFER`; `phonemize-sync: 375 identical, 3 DIFFER`.
  - the `note_rewrite` call removed: `trace` and `phonemize-trace` both `345 identical, 33 DIFFER`; sync is
    unaffected, so only the trace dumps can see this line. Restored: `phonemize-trace 378/0`.
- `cargo test --release --workspace`: 133 + 1 passed. fmt clean. clippy: only `module_inception` on `awadhi/mod.rs` new.

**Implication.** awa is done, nothing port-pending. The TS header already files the ⟨ज्ञ⟩ gap (d͡ʒɲ, family-wide);
it is pinned (`ज्ञान` → `d͡ʒɲˈaːn`) through the extracted pins.

## Run 4 — 2026-10-11 08:20 (mai)

**What changed.** `languages/maithili/maithili.rs`: a `Maithili` wrapper. The normalize override is
`hindi(fold(input))`, with `fold` on the provenance seam (`rewrite`) as the TS marks it; `word` and `word_rules`
fold U+0951 with a plain replace (off the seam, the TS `foldWord`); `number` and `text` are the inner engine's,
unwrapped, as the TS spread leaves them. `probes/mai.txt`: the udatta mid-sentence, at the end, alone, inside a
word, beside the avagraha, ⟨ꣿ⟩ U+A8FF ending a word, the inherited tier. (A rate-limit interruption fell between
the dumps and this entry; the dumps were not re-run, and the binary was rebuilt before the post-revert replay.)

**Commands and raw counts.**
- `parity -- mai`: `mai: 200/200 identical, 0 differ`.
- `run.sh mai`: word 28758/0, sync 380/0, best 380/0, trace 380/0, phonemize-trace 380/0.
- `pins.mts test/maithili.test.ts mai`: 26 calls, 25 distinct, 22 `toBe` literals cross-checked (three are
  `phonemize(…, "hi")` pins the suite uses to show Hindi does NOT fold).
- Mutations, each reverted:
  - `fold_word` made the identity: `hindi-family-word: 28754 identical, 4 DIFFER`, and
    `the_ts_suite_pins_hold` fails. (The text dumps cannot see this: `text` folds in the normalizer.)
  - `fold` moved off the seam (`JsRegex::replace` on the pipeline string): the new
    `the_udatta_fold_never_poisons_the_mapping` (phonemize_trace over probes/mai.txt + the golden, counting
    `on_poison`) fails. After revert: word 28758/0.
- `cargo test --release --workspace`: 135 + 1 passed. fmt clean. clippy: only `module_inception` on `maithili/mod.rs` new.

**Implication.** mai is done, nothing port-pending. The TS-filed unreachable ⟨ꣿ⟩ entry is pinned as the TS reads it.

## Run 5 — 2026-10-11 08:35 (hne)

**What changed.** `languages/chhattisgarhi/chhattisgarhi.rs` from the bho template. `probes/hne.txt`: श/ष, the
monophthongs, the absent finalRules (शहर, समय) and absent ज्ञ postRule, the geminate-collapse postRule (its
`\1(?!͡)` backreference) and its neighbours, an avagraha that this manifest does NOT treat as retention.

**Commands and raw counts.**
- `parity -- hne`: `hne: 200/200 identical, 0 differ`.
- `run.sh hne`: word 23300/0, sync 308/0, best 308/0, trace 308/0, phonemize-trace 308/0.
- `pins.mts test/chhattisgarhi.test.ts hne`: 19 calls, 19 distinct, 19 `toBe` literals cross-checked.
- Mutation: the first post rule skipped (hindi.rs `self.post.iter().skip(1)`, which for hne is the geminate
  rule): `hindi-family-word: 22498 identical, 802 DIFFER`; `phonemize-sync: 259 identical, 49 DIFFER`.
  Reverted; word 23300/0 again.
- `cargo test --release --workspace`: 136 + 1 passed. fmt clean. clippy: only `module_inception` on `chhattisgarhi/mod.rs` new.

**Implication.** hne is done, nothing port-pending.

## Run 6 — 2026-10-11 08:50 (rkt)

**What changed.** `languages/rangpuri/rangpuri.rs` from the bho template. Its test calls `word_rules` for
`phonemizeWord`, as the TS `phonemizeWord` is `wordRules` here. rkt is the one member with no `symbols` and no
`stripSymbols`, so its token pattern has no symbol group at all (the Rust `symbol_class.is_empty()` branch).
`probes/rkt.txt`: the deaffrication, the positional deaspiration `(?<!^)(t̪|[kʈp])ʰ`, the ə→ɔ final rule, signs
that are not tokens here, the दशमिक decimal word.

**Commands and raw counts.**
- `parity -- rkt`: `rkt: 200/200 identical, 0 differ`.
- `run.sh rkt`: word 21262/0, sync 309/0, best 309/0, trace 309/0, phonemize-trace 309/0.
- `pins.mts test/rangpuri.test.ts rkt`: 15 calls, 15 distinct, 15 `toBe` literals cross-checked.
- Mutation: final rules skipped (rkt's only one is ə→ɔ): `hindi-family-word: 15310 identical, 5952 DIFFER`;
  `phonemize-sync: 58 identical, 251 DIFFER`. Reverted; word 21262/0.
- `cargo test --release --workspace`: 137 + 1 passed. fmt clean. clippy: only `module_inception` on `rangpuri/mod.rs` new.

**Implication.** rkt is done, nothing port-pending. The six dialects are complete; ne and mr follow.

## Run 7 — 2026-10-11 09:40 (ne)

**What changed.** `core/markers.rs` (the three sentinel constants of `core/markers.ts`, written as escapes);
`languages/nepali/normalize.rs` (`makeNepaliNormalizer`, every regex the TS pattern string, every `rewrite` on the
seam as in the TS); `languages/nepali/nepali.rs`: a `Nepali` wrapper with the ə→ʌ fold on `word`, `word_rules`,
`number` and `text`, the foreign reader shielded (its ə → `PUA_SENTINEL`, restored after the fold), the post-pass
reported as `note_rewrite("nepali-inherent-vowel", …, true)`, and `NE_SYMBOLS` built from the TS object literal
(key order kept). fn-diff: a `ne-normalize` dump/replay pair, and `ne`/`mr` added to `FLEURS_DIR` so the
end-to-end dumps take FLEURS `ne_np`/`mr_in` columns 3 and 4. `probes/ne.txt`: one line per normalize arm, each
with the neighbour it must decline (list colons, `6औं`, an unsafe ordinal, a :00 clock before बज-, a minus after a
digit, a descending range, a range before देखि, a decimal fraction, …), plus the symbol tier and a Latin run.

**Dead end, recorded.** The first Write of normalize.rs came back with the TS's `[क-हक़-य़]$`
spelled as LITERAL Devanagari (precomposed, so the range still parsed and every replay was 0 DIFFER). Restored to
the escaped spelling, which is the TS source verbatim and the form the TS comment says the pattern must keep (a
decomposed nukta literal would make the range out of order). Replays re-run after: unchanged.

**Commands and raw counts.**
- `parity -- ne`: `ne: 200/200 identical, 0 differ`.
- `norm.sh ne`: `ne-normalize: 3986 identical, 0 DIFFER` (golden 100, fleurs 3865, probe 21). The normalizer
  CHANGES golden 6/100, FLEURS 362/3865, probes 18/21, so about 9% of the FLEURS haystack exercises it.
- `run.sh ne`: word 43320/0, sync 3986/0, best 3986/0, trace 3986/0, phonemize-trace 3986/0.
- `pins.mts test/nepali.test.ts ne`: 64 calls, 60 distinct, 55 `toBe` literals cross-checked.
- `npx tsx tools/provenance-poison.mts ne`: `distinct poison sites: 0`. The Rust twin,
  `nepali_rewrites_never_poison_the_mapping` (probes + golden through `phonemize_trace`), passes; its first run
  failed only on my line-count floor (`n > 250`, there are 221 lines), lowered to 200.
- Mutations (`.probe/hindi-belt/mut_ne.sh`, one at a time, each reverted), `ne-normalize` / `phonemize-sync` DIFFER:
  ordinal matra off 56/56; `6` not declined 1/1; the :00 clock's "followed by बज-" test off 3/3; the minus
  after-a-digit guard off 1/1; the ascending-range guard off 11/11; the foreign ə shield off 0/116 (only the
  engine path can see it); exponent position left at the tier default 0/5.
- `cargo test --release --workspace`: 139 + 1 passed. fmt clean. clippy: `module_inception` on `nepali/mod.rs`
  only (a `sort_by` → `sort_by_key` lint in my `unit_alt` fixed).

**TS readings worth reporting (not fixed).**
- `RATE_DEN_OK` is the same four words as the `RATE_DEN` alternation, so the rate callback's `has(den)` check
  can never fail: a guard with no reachable decline. Reproduced as written.
- `6औं` is declined on purpose (छैटौं unattested), which leaves the digit and the suffix as two tokens, so the
  suffix is spoken as a stray `ˈʌũ` syllable: the exact failure the ordinal rule's own docstring says it exists
  to prevent. Pinned by the probe line.

**Implication.** ne is done, nothing port-pending.

## Run 8 — 2026-10-11 10:30 (mr)

**What changed.** `languages/marathi/normalize.rs` (`makeMarathiNormalizer`; `MarathiWords` as a serde struct,
minus `numbers`, which the manifest shares with `HindiDef` and serde's `flatten` cannot hand to two structs);
`languages/marathi/marathi.rs`: `MarathiDef` = `HindiDef` + `MarathiWords` + `ampersand`/`multiply`/`units`, loaded
ONCE (`try_def`) and read by the engine, the normalizer and the tier, as the TS's module-level `DEF`;
`WITH_SYMBOLS` (the def with `%` → `percent.plural` in the bare-sign map) as a second once-cell; `MR_SYMBOLS` from
the manifest. A `manifest_claims_every_key` test diffs marathi.jsonc's keys against the struct. fn-diff: an
`mr-normalize` pair. `probes/mr.txt`: each normalize arm with its decline.

**Dead end, recorded.** The editor stored the `[क-हक़-य़]$` class with क़/य़ DECOMPOSED (क + U+093C), which is
precisely the TS comment's hazard (the range becomes `क + ़ - य + ़`). It compiled (regress accepted the range in
that order) but the class was no longer the TS's. Restored the precomposed U+0958/U+095F by script, checked against
the TS source bytes, and swept every Rust file in my modules for decomposed nukta pairs: none outside generated
pins (whose bytes are the TS test file's own). The same editor had turned nepali's `क…` escapes into literal
precomposed letters (Run 7). Both found by reading bytes (`od -c`), not by any replay.

**Commands and raw counts.**
- `parity -- mr`: `mr: 200/200 identical, 0 differ`.
- `norm.sh mr`: `mr-normalize: 3998 identical, 0 DIFFER` (golden 100, fleurs 3882, probe 16). The normalizer
  changes golden 18/100, FLEURS 781/3882 (20%), probes 13/15.
- `run.sh mr`: word 45330/0, sync 3998/0, best 3998/0, trace 3998/0, phonemize-trace 3998/0.
- pins: test/marathi.test.ts 134 calls (130 distinct, 3 literal `toBe`; the rest relational), marathi-minus-sign 13
  (11), marathi-manifest-lifted 2 (2): 140 distinct rows in `PINS`.
- `npx tsx tools/provenance-poison.mts mr`: 0 sites; the Rust `marathi_rewrites_never_poison_the_mapping` passes.
- Mutations (`mut_mr.sh`, each reverted), `mr-normalize` / `phonemize-sync` DIFFER: शे stem off 1/1; नऊ stem off
  3/3; -ीस stem off 9/9; units/teens bare off 5/5; the व- spacer off 1/1; :00 clock's "followed by वाज-" test off
  3/3; percent singular off 1/1; tier currency off 0/2; `WITH_SYMBOLS` `%` off **0/0**: a dead harness for that
  line, since every `N%` is claimed by the normalizer first. Added a bare-`%` probe line (`% वाढ, x% आणि टक्के %`),
  re-dumped: with the line removed `phonemize-sync: 3997 identical, 1 DIFFER`; restored 3998/0.
- `cargo test --release --workspace`: 142 + 1 passed. fmt clean. clippy: only `module_inception` on `marathi/mod.rs` new.

**Implication.** mr is done, nothing port-pending. No TS defect found in this file beyond the ones Run 10-12 of
the hi log already fixed (the ordinal above 2^53).

## Run 9 — 2026-10-11 11:40 (rebased onto main f80295ba, every gate on the combined tree)

**Question.** After rebasing the eight commits onto main (sr, hr, bs, sl, lt, lv merged), is every list whole and
every gate still green?

**Command.** `git rebase origin/main`; every commit conflicted only in the shared lists (`LANGUAGES`, the `build`
arms, `languages/mod.rs`, and for ne the fn-diff `FLEURS_DIR`), resolved as a union by `.probe/hindi-belt/resolve.py`
(HEAD's entries, then this branch's), `cargo fmt`. Then `.probe/hindi-belt/final.sh`: fmt, parity over ALL
languages, regex-diff, the workspace tests, clippy, and every dump of this log regenerated from main's TS and
replayed (FLEURS from `<external-drive>`).

**Raw finding.**
- `cargo fmt --check` clean. `LANGUAGES` has 34 entries (main's 26 + these 8).
- parity: all 26 previously ported languages 200/200; bho, awa, mai, hne, rkt, ne, mr 200/200; mag 199/200 (the
  one ar-pending row).
- `regex-diff`: `144898 probe results identical, 0 DIFFER, 0 patterns refused`. No TS regex was added or changed,
  so the corpus was not re-extracted.
- `cargo test --release --workspace`: 154 + 1 passed.
- clippy: 34 `module_inception` (one per language module, 8 of them new); every other warning class has the same
  count as before this branch (54 collapsible-if, 11 excessive-precision, 10 complex-type, …), none in these files.
- dumps: hindi-family-word bho 23316, mag 24990, awa 25724, mai 28758, hne 23300, rkt 21262, ne 43320, mr 45330,
  all 0 DIFFER; sync / best / trace / phonemize-trace bho 318, mag 383 (1 DIFFER each, the ar row), awa 378,
  mai 380, hne 308, rkt 309, ne 3986, mr 3998, all others 0 DIFFER; `ne-normalize 3986/0`, `mr-normalize 3998/0`.

**Implication.** Done. Port-pending: one mag golden row, on `ar`.
