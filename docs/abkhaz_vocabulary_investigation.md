# Abkhaz symbol-vocabulary sourcing — investigation

Goal: source the words that block the seven deferred normalization classes in
`src/languages/abkhaz/normalize.ts` (percent ×31, degree ×19, exponent ×16, minus ×13,
math ×12, currency ×6, ampersand ×1, clock ×3). The corpus (7,780 distinct tokens) does
not attest them and espeak does not ship Abkhaz, so this is external sourcing. A word is
accepted only with a citable dictionary/reference source; Gemini-style model output can
corroborate a phonemization but is not itself a source.

## Run 1 — 2026-08-08

Command: WebSearch (4 generic queries) + WebFetch of `ru.glosbe.com/ru/ab/<word>`.
Question: does Glosbe's crowdsourced ru→ab pair have the missing words?

- `процент` → **апроцент** — a bare entry, no example sentences. Consistent with the
  expected shape (Russian loan + Abkhaz definite prefix а-). Needs a second source.
- `градус` → none ("нет переводов").
- `минус` → junk: Glosbe returns the "-" symbol itself as the "translation".
- `доллар` → none; no рубль either.
- Currency reality check (Wikipedia): Abkhazia's own unit is the **апсар** (аԥсар),
  commemorative only; circulation currency is the Russian ruble. So the ₽/руб. cases in
  the corpus matter more than $ — check what "ruble" is in Abkhaz (candidate: амааҭ?).

Implication: Glosbe is too thin. Next: dict.agu.site (Abkhaz State University portal,
hosts the academic dictionaries — Kaslandzia's Abkhaz-Russian among them).

## Run 2 — 2026-08-08

Command: WebFetch of `ab.wikipedia.org/w/api.php?action=query&list=search&srsearch=<word>`.
Question: does the FULL ab.wikipedia text attest the candidates? (Our mined artifact is
208 sampled excerpts of the dump; the live full-text index is the whole wiki, so this is
a strictly bigger net over the same source register.)

| term | hits | attested frame (verbatim from snippets) |
|---|---|---|
| апроцент | 1 | "…иреиӡоу апроцент" (prefixed, nominal use) |
| процент | 10 | ALWAYS right after a numeral: "18 процент", "жәаба процент", "65 процент" |
| градус | 9 | bare, postposed after numeral: "180 градус", "60 градус", "2,5 градус/…" |
| Цельси | 2 | "Цельси иградус" = degree Celsius (СИ article, unit table) |
| асааҭ | 19 | clock frame is асааҭ BEFORE the number: "асааҭ 6 рзы", "асааҭ ааба рзы", "асааҭ 10.00 инаркны 16.00 рҟынӡа" |
| амааҭ | 5 | = ruble; has its OWN ARTICLE (Амааҭ); infobox "Авалиута Амааҭ" |
| доллар | 41 | bare "доллар" everywhere, never "адоллар" per snippets |
| квадрат | 4 | postposed: "143,600 километра квадрат (55,400 миль квадрат)" |
| минус | 0 | — |
| плюс | 1 | only inside a Russian publisher name ("Канон плюс") — NOT attested |

Negative but instructive: the СИ article writes powers as symbols (м²·м⁻²), never as
words — no "square/cubed" word there beyond the квадрат hits above.

Implication: percent, degree(+Celsius), clock, currency (ruble + dollar), and square are
now sourceable with wiki-attested frames. minus / plus / = < > × ÷ and ampersand remain
unsourced. The artifact's earlier "доллар only as substring" finding was an artifact of
excerpt sampling, not of the language.

## Run 3 — 2026-08-08

Command: three more wiki API searches (евро, фунт, куб, миллиард) + a local scan of the
artifact for the exact symbol instances the rules must cover.
Question: complete the currency vocabulary; find a cubic word; settle the scale words.

- `евро` ×37 ("миллион евро"), `фунт` ×10 — incl. "5 млн фунт стерлинг" and
  "29,721,250 фунт стерлинг", the SAME sum our corpus carries as £29,721,250. So £ has a
  spelled-out equivalent sentence on the wiki.
- `миллиард` ×19, and "8 миллиард доллар" (Формула Аку) fixes the currency word order:
  NUMBER · SCALE · CURRENCY.
- `куб` ×0 — cubic stays unsourced; only км² ("километра квадрат", Башкирия) is covered.
- Local artifact scan (distinct instances): percent 64, degree 25 (both ° and °C, signed
  +/−), exponent 17 (almost all км²; г/см³, м³ the rest), currency 7 ($ € £ — no ₽!),
  clock 3 ("22:30 рзы", "асааҭ 18:21:56 рзы", and "(1:51.4)" which is a RACE TIME, not a
  clock), minus 8 (all −temperatures/magnitudes), ampersand 8 (6 are literal `&nbsp;`
  mining artifacts, 1 Russian citation, 1 URL).
- Dead ends this run: JW online library search (timeout), dict.agu.site (JS app, no
  fetchable API — /api/search 404), Glosbe (junk beyond апроцент), quoted-Cyrillic web
  search (engines drop the quotes).

Implemented (PR to follow): manifest `symbols` block + normalize.ts step 3 (clock,
percent, degrees, scale words, currency, км²) + comma-de-grouping at 2+ groups.
Corpus-diff: 63/404 changed, DROP 78 → 34. Referee unchanged (170/206, 641/979).
Still deferred: minus, plus, = < > × ÷, cubic, °F, ampersand — searched, not assumed.
Gemini corroboration was unnecessary: the engine's own g2p reads the sourced Cyrillic
words directly, so no external phonemization enters the repo.

## Run 4 — 2026-08-08 (review of PR #767)

Command: /code-review 767 (multi-agent, adversarial verify), then re-ran the gates.
Question: what did the first implementation get wrong?

Eight findings survived verification (km² was refuted — the alleged bad corpus instance
does not exist). All eight fixed:

1. Single comma group: "decimal by default" mis-read the MAJORITY class — the artifact
   splits 7 groupings vs 5 decimals, and every decimal begins ⟨0,⟩. Leading-0 is now the
   discriminator ("301,340 км²" was reading as ~301 km²; "21,000 К" as "21 0 0 0").
2. Hand-rolled percent/currency doubled the word when the text already spelled it
   ("95% процент", "$1000 доллар") and stranded "US" from US$. Replaced with the shared
   symbol tier (makeSymbolNormalizer) + compound keys US$ and B£ (the corpus's Brixton
   pound).
3. млрд/млн had no dotted forms; "30 млн. аԥара" left a stray sentence-break dot. Now
   consumed/re-emitted like the year abbreviations, and symbols.scales references
   numbers keys instead of duplicating the words.
4. The clock said-lookback wasn't letter-bounded (иасааҭ suppressed the frame word),
   compiled per match, unescaped, unbounded slice.
5. No wall-clock bounds (25:99 accepted) — now h<24, mm<60, ss<60 (swedish precedent).
6. Medial-zero drop collapsed 10:00:30 into 10:30's output — now trailing zeros only.
7. "10:00-16:00" was rewritten endpoint-wise: doubled асааҭ, stranded hyphen. A clock
   RANGE rule now runs first and emits the corpus frame (асааҭ once, инаркны…рҟынӡа).
8. Degrees: Cyrillic ⟨°С⟩ (U+0421) glued *градусС; an unbounded skip class let any
   following К/C/F-word suppress the degree word ("60° Кырҭтәыла").

Gates after fixes: 8/404 corpus rows changed vs the pre-review PR state, every one an
improvement read by hand; DROP 34 → 33; referee unchanged (170/206, 641/979).
Also learned en route: bare ⟨км⟩ → километр is full-wiki attested ("18 километр",
"20 километр", "25 километр" — the bare form after numerals, where the area frame uses
"километра квадрат") — sourced and available for a plain-length-units follow-up.

## Run 5 — 2026-08-08 (the normalization follow-ups)

Command: local artifact scan for digit-adjacent unit symbols; `attest.ts --lang ab` for
all 11 sourced words; implemented units + dot decimals + the review.ts sourcing-gate arm.

- Units: the artifact itself spells the frames digit-adjacent — "900 метра",
  "15-20 километра" — so the declared words are the corpus's own forms (метра,
  километра), not the wiki's citation forms (километр). км ×58 and м ×21 are the two
  big classes; мм/кг/г/т have NO attested spelled singular (грамм only as граммақәа) and
  stay undeclared. Declared through the shared tier (`units` + `exponentWords`), which
  replaced the literal км² rule — and exposed that the old rule half-rewrote the rate
  "0,6км/км²"; the tier refuses (no "per" word), so DROP goes 33 → 34, honestly.
- attest.ts (live wiki, token-level): процент 14 · градус 11 · асааҭ 26 · амааҭ 5 ·
  доллар 30 · евро 7 · фунт 4 · квадрат 4 · километра 27 · метра 35 · миллиард 100 —
  all `attested`, artifact committed at tools/corpus/attest/ab.jsonc. Bonus: the probe
  surfaced "600 инаркны 1600 метра рҟынӡа" — the unit word inside our exact range frame.
- Dot decimals: "28.28 гр.", "0.02°", "1.98847" now read digit-by-digit like the comma
  form. Two traps found by the corpus gate, both fixed and pinned: a DOT CHAIN is a date
  ("17.11.1946" — and the fraction BACKTRACKED past the first guard, matching 17.1), and
  the fraction words GLUED to a following letter ("0,6км" → *фбакм). The corpus's
  dot-separated clock ("асааҭ 10.00 инаркны 16.00") is consumed as a clock only where
  the frame words prove it.
- review.ts sourcing gate: new arm follows `MANIFEST.symbols` references into the .jsonc
  (percent string + [sign, word] pairs, same sign-in-corpus filter), so a manifest-driven
  tier declaration no longer reads as "could not read it". Result: `[ ok ] all 7
  high-traffic words attested`.

## Run 6 — 2026-08-08 (review of PR #769)

Eight review angles; the consolidated confirmed set, all fixed:

- The dot-clock's `инаркны` anchor licensed a clock reading for ordinary decimals ("1
  инаркны 2.50 метра" read "2 50"), wasn't letter-bounded (аинаркны), refused a trailing
  comma (real clock fell to the decimal rule as "10 аноль аноль"), and had no hyphen
  form ("асааҭ 10.00-16.00" stranded ".00"). Rewritten: every dot form is anchored on
  the letter-bounded hour word itself (single / hyphen / инаркны-joined), punctuation
  is not a refusal, and MM.YYYY joins the date guard.
- Range endpoints admitted only the comma decimal, so the corpus's own "7.9-8.2" matched
  its inner digits and stranded ".2" after the "to" word — endpoints now admit [.,],
  with a left guard against starting past a separator and a right guard that refuses a
  digit continuation but not a sentence dot. (Side effect: "1002 - 1027," now takes its
  connectives — the old guard choked on the trailing comma.)
- "8 км2" (attested): the tier's ASCII-exponent arm is Latin-only by design, so the
  Cyrillic form is folded to ² before the tier (the Bulgarian precedent).
- The header's "no half-reading" rate claim was too strong: only a DECLARED denominator
  refuses whole; "км/с" words the numerator and leaves /с visible. Comment corrected,
  both behaviors pinned.
- review.ts: the symbols arm now PARSES the manifest (parseJsonc — the block regex
  truncated at the first line-initial `}` and over-captured on the hindi-family shape),
  gates on the whole layer source (yoruba's `const SYM = MANIFEST.symbols` alias was
  invisible — its percent word was silently unchecked, and the fixed gate immediately
  flagged its unattested `onígun`), folds the sign before the in-corpus test (US$/B£
  never matched a folded haystack), walks ALL symbol strings (degree/hour/squared are
  needles now), and shares one .jsonc read with the decimalWord arm.
- Цельси/иградус: attest.ts reports both absent — a retrieval blind spot, verified
  against the СИ article's raw wikitext (action=parse), where "Цельси иградус ||
  degree Celsius" sits in the unit table the search index does not carry. Cited in the
  manifest comment.
- Fraction digits now go through numbers.ts's readDigits instead of re-deriving through
  the full numeral pipeline.
