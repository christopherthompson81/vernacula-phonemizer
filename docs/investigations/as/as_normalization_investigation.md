# Assamese (as) normalization investigation (#562)

Chronological record. Baseline worktree: `<sibling checkout>/as-base` (pinned at the commit the work
started from). Working branch: `norm-as-562`.

## Run 1 — 2026-07-31

**Setup**: baseline emitted from `<sibling checkout>/as-base` via
`npx tsx tools/normalization/corpus-diff.ts emit --lang as --corpus as_in --out /tmp/as.base`;
identical to `/tmp/as.before` (main tree). Referee baseline: `folded backbone: 2171/2982 (72.8%)`.

**Architecture**: Assamese REUSES the Bengali engine (`makeNativeBengali` with the Assamese manifest),
which internally runs `makeBengaliNormalizer(def.numbers)` + a Bengali-word symbol tier. So the shared
Bengali handling ALREADY works: digit folding, `°C` → ডিগ্রি সেলসিয়াস, `%` → শতাংশ, `$`/`£` →
ডলার/পাউন্ড, clocks (টা … মিনিট), dot decimals (দশমিক), comma-grouping (tokenizer), and the
Bengali-style ordinals `7ম`→সপ্তম, `5ম`→পঞ্চম, `13তম`→তেরতম (the Bengali normalize composes with the
Assamese numbers def).

**The Assamese gaps** (what Bengali's normalize does NOT handle, probed on the hard-set):
- `11শ`/`12শ`/`18শ`/`15শ` → read as the cardinal + a bare শ syllable (এঘাৰ শ). Assamese uses the শ
  classical-ordinal suffix for 11–20 (একাদশ, দ্বাদশ) where Bengali's normalize only knows শে (dates).
- comma-grouped ordinal `1,000তম` → "এক হাজাৰ তম" — the ordinal suffix detaches from the grouped number.
- `190 নং` / `60নং` — the নং NUMBER marker reads as a bare syllable [nɔŋ]; should read নম্বৰ (number).
- `U.S.` → "জু. এস." and `ইউ.এছ.অ.চি` (USOC, Bengali-script dotted) → the interior dots survive as breaks.
- `George W. Bush` — the W. initial leaves a break.
- `802.11এন` / `802.11a` version dots → read as দশমিক (the tokenizer treats 802.11 as a decimal).
- `II বিশ্ব যুদ্ধ` (World War II) → cardinal "দুই"; should be দ্বিতীয় (regnal ordinal).
- `AUD$৪৫` / `US$30` → the currency CODE is read as an English word (AUD→[ɔːd]) and the $ dropped.
- `$2.3 বিলিয়ন` → "2.3 ডলার বিলিয়ন" — the magnitude hops AFTER the currency; the Bengali symbol tier
  has no magnitudes declared, so it can't move বিলিয়ন before ডলার (corpus: "বিলিয়ন আমেরিকান ডলার").
- `&` (B&B) → the ampersand is dropped.
- `XDR-TB` / `KNP` / `NHK` / `MS` / `PSTN` — embedded Latin initialisms go to the ENGLISH foreign path.

**Next**: decide whether Assamese needs its own normalize.ts (wrapping before makeNativeBengali's
internal normalize) or whether the gaps can be handled in the existing Bengali normalize. Given the
shared-engine reuse, an Assamese pre-pass is likely the cleaner seam.

## Run 2 — 2026-07-31

**Implementation landed** on `norm-as-562`. The Assamese engine reuses `makeNativeBengali` wholesale; the
pre-pass `src/languages/assamese/normalize.ts` runs BEFORE `makeNativeBengali(...).text()` so the Bengali
normalize + symbol tier below it still own the shared machinery (digit folding, °C, %, $, clocks,
decimals, comma-grouping, and the ম/তম ordinals). The pre-pass owns ONLY the Assamese-specific classes:

1. dotted Latin/Bengali runs (`U.S.`, `ইউ.এছ.অ.চি`, `George W. Bush`) — the interior/suffix dots were
   phrase breaks
2. `Nশ` classical ordinals 11–20 (`11শ` → একাদশ … `18শ` → অষ্টাদশ) and `1শ` = একশ (one hundred, not an
   ordinal) — the Bengali normalize does not know the শ suffix
3. `নং` number marker → নম্বৰ (190 নং → এক এশ নব্বৈ নম্বৰ)
4. comma-grouped ordinals (`1,000তম` — the grouping comma detaches the ordinal suffix)
5. version dots (`802.11এন`, `802.11a/b/g`) → বিন্দু (the tokenizer read them as DECIMALS, দশমিক)
6. currency codes (`AUD$৪৫`, `US$30`) → অস্ট্রেলিয়ান/আমেৰিকান ডলাৰ + number
7. `&` → আৰু (B&B → bee আৰু bee)
8. regnal `II বিশ্ব যুদ্ধ` → দ্বিতীয় বিশ্ব যুদ্ধ (the roman pass converts II → 2 first)
9. signs `=`/`<`/`>`/`×` → সমান/তকৈ সৰু/তকৈ ডাঙৰ/গুণ (Bengali owns `-` ঋণাত্মক and `+` যোগ)

**Gates, all green**:
- scan: no defects (DROP 1 → 0)
- tsc: clean
- vitest: 2613 passed (200 files) — 11 assamese tests
- referee: folded backbone 2171/2982 (72.8%) — IDENTICAL to the worktree baseline
- corpus diff: 25/1961 (1.3%) changed — small because the shared Bengali normalize already owns the
  corpus's dominant shapes; every change READ and verified an improvement
- normalization/review.ts --lang as: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**Notes**:
- the review probe `12,5` reads "এক এশ পাঁচ বিছ" — a synthetic comma+1-digit the corpus never writes
  (every corpus comma is a 3-digit group); the shared Bengali grouping treats it as 125, a pre-existing
  shared-engine behavior, not a regression.
- the pre-pass export is `normalizeAssamese` (a self-contained entry loading the manifest) so the review
  tool's "wired into text()" check can see it — the factory `makeAssameseNormalizer(numbers)` stays as the
  numbers-injected core.

## Run 3 — 2026-07-31 (PR #592 review pass)

**Question**: do the pre-pass rules fire on the corpus instances they were written for, and what do they do
to text just outside those instances? ~25 adversarial probes, then every gate re-run.

**Seven defects, five of them on live corpus text:**

1. **The regnal rule DELETED the noun it qualifies.** The pattern consumes `বিশ্ব যুদ্ধ` and the replacement
   returned the ordinal alone, so the corpus's one instance `II বিশ্ব যুদ্ধৰ` read *ditijɔɹ* — "of the
   second", with "World War" gone. **The test asserted the deleted form** (`toBe("ditij")`), so the suite
   pinned it.
2. **`য়` IS ENCODED TWO WAYS AND THE CORPUS USES BOTH.** Bengali-script য়/ড়/ঢ় exist precomposed (U+09DF)
   and as base + nukta (U+09AF U+09BC); the corpus writes `বিলিয়ন` precomposed and one `মিলিয়ন`
   decomposed. Every rule here matches Bengali LITERALS, all written one way, so they silently covered half
   the instances — the currency rule missed `$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ` entirely. Fixed by NFC-folding the
   input at the pre-pass entry (NFC yields the DECOMPOSED form for these letters — they are composition
   exclusions — and the g2p already NFCs downstream; both forms give byte-identical IPA). The fold also
   fixed a latent one: `3য়` now reads তৃতীয় instead of *tini jɔ*.
3. **Currency word order was inverted.** `US$30` read *dollar thirty* while the shared tier reads a bare
   `$30` as *thirty dollar* two rules away. The corpus postposes: "11,000 ডলাৰ", "22,500 ডলাৰ".
4. **A magnitude was stranded after the currency**: `AUD$৪৫ মিলিয়ন` → *45 dollars million*. The corpus's own
   prose is "$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ" — number, magnitude, then the noun.
5. **A bare `$` doubled a currency the sentence already spelled**: `$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ` read
   *14.7 dollar billion American dollar*, and `$2.3 বিলিয়ন ডলাৰৰ` likewise. Where the noun follows, the
   sign is redundant and is dropped.
6. **The version-dot rule claimed any decimal + letter**, so `6.5km` read *6 বিন্দু 5 kilometre*. Bounded to
   the corpus's shape: ≥3 integer digits plus a single trailing letter (802.11a/b/g/n, ৮০২.১১a).
7. **The initial-dot rule stripped SENTENCE periods.** Keying on any capital before the dot, `NASA. Bush`
   and `the U.S. The next` lost their pause; an initial is a LONE capital (`George W. Bush`). Also guarded
   the শ ordinal against the word শত ("hundred") — the corpus writes `৯০শত`.

**The gate had to be fixed too, and this is the interesting part.** Fix 5 makes the reading correct and
*unavoidably* trips the differential DROP test: the sentence says "American dollar" itself, so the reading
is byte-identical with and without the `$`, and no correct rule can escape that. The test conflated two
findings. It now asks a second question — **does the symbol's own word appear in the reading?** — by
probing the symbol on a bare `5` and looking for the tokens it adds:

- present → the meaning IS spoken, from the sentence's own words → a `REDUNDANT?` NOTE, not a defect
- absent → nothing says it → `DROP`, exactly as before

Measured across all 67 artifacts: **5 instances in 5 languages become notes** (as ×2, am, es, ne currency;
ml percent — `93% ശതമാനം` spells the unit beside the sign), **every one hand-checked**, and **every genuine
drop is preserved** — bn/ca/or/ga still report ¥, and Xhosa's `leUS$30` still reports even though xh reads
a bare `$5`, because the dollar word is absent from that reading. Two weaker discriminators were tried and
rejected on measurement first: sibling substitution (`$`→`£`) masked the real bn/ca/or ¥ drops, and an
isolation probe alone masked the Xhosa one.

Also fixed while there: `re.test()` on a `/g/` regex is STATEFUL, and both scan loops shared their regex
objects across sentences, so a hit left `lastIndex` mid-string for the next one. Fleet impact measured at
zero (the `replace` that follows resets it in the common path), but it is a live trap for the next edit.

**Gates**: vitest 2612 (200 files); tsc clean; scan clean (+2 notes); `normalization/review.ts --lang as`
checklist clean, notes surfaced; referee **identical** at 2171/2982; corpus diff 6/1961 with every counter
0 → 0, and all six changes classified — 2 doubled-currency, 1 World War, 2 currency order, 1 `3য়` ordinal.
