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
