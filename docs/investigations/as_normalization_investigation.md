# Assamese (as) normalization investigation (#562)

Chronological record. Baseline worktree: `~/Programming/tmp/as-base` (pinned at the commit the work
started from). Working branch: `norm-as-562`.

## Run 1 — 2026-07-31

**Setup**: baseline emitted from `~/Programming/tmp/as-base` via
`npx tsx tools/normalization-corpus-diff.ts emit --lang as --corpus as_in --out /tmp/as.base`;
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
- normalization-review --lang as: checklist clean (wired, tests, all 8 sign classes, spelling→g2p, scan)

**Notes**:
- the review probe `12,5` reads "এক এশ পাঁচ বিছ" — a synthetic comma+1-digit the corpus never writes
  (every corpus comma is a 3-digit group); the shared Bengali grouping treats it as 125, a pre-existing
  shared-engine behavior, not a regression.
- the pre-pass export is `normalizeAssamese` (a self-contained entry loading the manifest) so the review
  tool's "wired into text()" check can see it — the factory `makeAssameseNormalizer(numbers)` stays as the
  numbers-injected core.
