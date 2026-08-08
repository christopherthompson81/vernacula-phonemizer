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
