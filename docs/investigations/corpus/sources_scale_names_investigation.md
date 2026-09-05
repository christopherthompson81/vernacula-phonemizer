# `sources.ts` — the `scale-names` check, wrong in both directions

`tools/normalization/sources.ts` is the pre-flight report an author runs BEFORE writing a normalization
layer. Its `scale-names` row answers one question: *is there a source for the temperature scale word in this
language, or does the `C`/`F` get dropped?*

It was reported wrong in both directions at once — a `[ ok ]` for a language with no scale name at all, and a
`[NONE]` for a language whose corpus writes both names in full. Those are the same bug seen from either end:
the check was a substring search over a haystack that INCLUDED THE LAYER'S OWN SOURCE, using an enumeration
of LATIN transliterations.

---

## Run 1 — 2026-08-12 17:05 · reproduce both defects

```
npx tsx tools/normalization/sources.ts --lang cdo
npx tsx tools/normalization/sources.ts --lang syl
```

Question: do both reported defects reproduce as described?

Raw finding:

```
cdo   [ ok ] scale-names      Celsius Fahrenheit
syl   [NONE] scale-names      ° occurs, neither scale name anywhere — the letter gets dropped
```

Both reproduce. The provenance, read out of the two layers:

- **cdo** — the entire degree rule is one line:
  `readDegrees(s, { celsius: (n) => \`${n} dô\`, fahrenheit: (n) => \`${n} dô\`, bare: (n) => \`${n} dô\` })`.
  All three arms emit the BARE degree word `dô`. The strings "celsius" and "fahrenheit" in that line are the
  **option keys of a shared helper**. Nothing was sourced; ⟨攝氏⟩ has no Eastern Min reading on Wiktionary at
  all, which is why the layer drops the letter on purpose.
- **syl** — the corpus writes `০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ` and `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` — both names in full,
  each beside the abbreviation it expands. The probe is the literal list `celsi|selsi|셀시|celzi|t͡selsi`, so it
  cannot read a Syloti Nagri corpus.

Implication: comments were already stripped from `langSrc` (an earlier Oromo bug of exactly this shape), but
IDENTIFIERS were not — and the transliteration enumeration is a Latin-only instrument pointed at a fleet that
is mostly not Latin. Both halves need fixing, and the `[ ok ]` half is the dangerous one: this tool's whole
value is that it once caught a Lao layer which had INVENTED a currency word, by reporting it "in NO source".

---

## Run 2 — 2026-08-12 17:10 · fleet survey, with the provenance of every match

Question: how many verdicts are wrong, in each direction, across every language with a `normalize.ts`?
A scratch script recomputed the check over all 117 such languages and printed WHICH haystack matched.

Raw finding — 30 languages reported `have`/`partial` on CODE-ONLY evidence (nothing in corpus, referee or
espeak). Reading each layer, that set splits three ways:

- **Genuine** (~24): the scale word is a string literal the layer emits — `"$1 grader celsius"` (sv),
  `"grado Celsius"` (es), `"$1 digiri Celsius"` (ha).
- **Right verdict, bogus evidence** (5): yue/wuu/hak match on the `celsius:` option KEY while genuinely
  emitting 攝氏/摄氏; ab matches on a quoted JSON KEY `"celsius"` whose VALUE is the real Abkhaz word; rw
  matches on the identifier `const CELSIUS` whose value is `selisiyusi`.
- **Flat wrong** (1): cdo.

And in the other direction, the degree-adjacent corpus tokens for the 47 languages reporting `NONE`:

```
arz   degreeAdj: و×3 شمال×2 شرق×2 مئويه×1 فهرنهايت×1        ← BOTH scale names, Arabic script
pnb   degreeAdj: س×14 ف×14 C×5 F×4 سیلسیس×1                 ← Celsius, Shahmukhi
hi    degreeAdj: के×4 C×1 सेंटीग्रेड×1                         ← centigrade, Devanagari
syl   degreeAdj: ꠍꠦ×2 ꠚꠣ×2 ꠍꠦꠟꠍꠤꠀꠍ×2 ꠘꠤꠍꠦ×2                  ← Celsius in full, AND "below"
```

Implication: the `NONE` side is not one language's problem. And the last line is the trap that decides the
design — `ꠘꠤꠍꠦ` is "below" (`১৮° ꠘꠤꠍꠦ ꠘꠣꠝꠦ`, "18 degrees below"), degree-adjacent exactly like the scale
name. km writes `° និង` ("and") four times. **No rule over adjacency separates a scale name from a
preposition without knowing the language**, so adjacency can produce CANDIDATES but never a verdict.

---

## Run 3 — 2026-08-12 17:20 · the boundary, and four self-inflicted false verdicts on the way to it

The design: text evidence is corpus + referee + espeak and NEVER the layer source; code evidence is read as
ARMS (`°C` vs `°F` vs bare `°`), not as substrings; an arm that cannot be read statically is `[??]`, never
`none` and never `ok`; and `none` requires a probe that could have read the corpus.

Each of the following was a WRONG verdict produced by an intermediate version, found by re-running the fleet
survey after every change. They are the reason the boundary is where it is:

1. **The literal extractor had to be a scanner.** The first version paired quotes with one `matchAll`. A
   normalization layer is full of regex literals containing lone quotes and of nested template literals, so
   one "string" ran across hundreds of lines: on cdo it returned a single 400-character literal containing
   `celsius: (n) => …` verbatim, and the check reported `ok` again. *The naive version reproduced the exact
   bug it was written to fix.*
2. **`${…}` holes are code.** Skipping them lost sr and hr, whose scale words live inside a ternary in a hole
   — `${/[Ff]/u.test(u) ? "Farenhajta" : "Celzijusa"}`. The two layers that spell both names out most
   explicitly read as having neither.
3. **A literal followed by `:` is a key only where a key can stand.** Testing the colon alone threw away the
   TRUE branch of every ternary. Fixed by requiring the previous significant character to be `{` or `,` —
   which still excludes ab's `"celsius": "Цельси иградус"`, where the English is the field name.
4. **"Differs from the other arm" is not the test.** uz reads `°C` as `N daraja` ("degree") and `°F` as
   `N daraja farengeyt`. The arms differ, so a difference test declared a Uzbek Celsius word that does not
   exist — *the identical mistake being repaired, arrived at from the other side.* Replaced by the RESIDUE:
   what the `°C` arm emits that the BARE arm does not, computed by trimming the longest common prefix and
   suffix (so `攝氏N度` minus `N度` = `攝氏`, and `N градусов Цельсия` minus `N градусов` = `Цельсия`, under
   one rule, spaced and unspaced scripts alike).

Four further pattern-reading bugs, each caught the same way — a language whose verdict moved for no reason:

- `°[  ]?[CF]` (a character class of spaces, the Bantu layers' style) was read as the BARE arm → xh's explicit
  scale arm vanished.
- `°(?![\p{L}\p{M}])` — the negative guard nearly every rule ends with — was read as "the following letters
  are p, L, p, M", so the rule was discarded as not-a-scale-arm. ht then reported `none`, "the layer declares
  no scale arm", one line above `"$1 degre Sèlsiyis"`.
- `[CСc]` — the scale letter written twice, in two scripts, which every Cyrillic layer must match — was read
  as "some other letter". ru, uk and sr, which write Цельсия and Фаренгейта in full, became unreadable.
- `new RegExp(\`(\\d+)\\s*°\\s*(\\d+)…\`)` — hak's COORDINATE rule — counted as an unreadable temperature arm
  and blanked a layer that emits 攝氏 and 華氏 outright.

Negative result worth keeping: **a digit after the `°` is a coordinate, not a temperature** (`118°08'`,
`22° 11′ 47″`), and cdo claims that whole shape in one rule with a callback. Reading it as the bare degree arm
made the layer "unreadable" and sent the one language whose three arms are provably identical back to `[??]`.

---

## Run 4 — 2026-08-12 17:26 · `\d` is ASCII-only

Found by a test fixture, not by the fleet: `hasDeg` was `/\d\s?°/u`, and `\d` matches only ASCII 0–9 even
under `/u`. A corpus that writes its temperatures in its own digits (`১৮°ꠍꠦ.`) reported **"no ° in the
corpus"** and skipped the class entirely. Widened to `\p{Nd}`; `as` and `my` gained a verdict they had never
been given. Same false-absence shape as the rest of the repair, one layer further out: the tool was not
deciding wrongly, it was declining to look.

---

## Run 5 — 2026-08-12 17:30 · final fleet counts

`npx vitest run` (240 files, 3777 pass) · `npx tsc --noEmit` clean. Over the 117 registered languages with a
`normalize.ts`:

| before → after | n | meaning |
|---|---|---|
| `have` → `none` | **1** | **false green removed** (cdo) |
| `none` → `have` | 17 | false negatives: the scale word was in the layer's own script all along |
| `none` → `partial` | 1 | th (Celsius only) |
| `partial` → `have` | 2 | cy, mad |
| `none` → `unknown` | 20 | false confidence replaced by an honest "could not read" |
| `n/a` → `unknown` | 2 | as, my — native digits, class had been skipped |
| `partial` → `unknown` | 1 | ab — its `partial` came from a quoted JSON key |
| unchanged | 73 | 33 `have`, 10 `partial`, 9 `none`, 21 `n/a` |

**41 of 117 verdicts were wrong.** The 17 recovered positives are the striking ones — every one is a layer
that emits the scale name in its own script, which the Latin-only probe could not see:

```
ru  Цельсия / Фаренгейта      el  Κελσίου / Φαρενάιτ       ko  섭씨 / 화씨
hi  सेल्सियस / फ़ारेनहाइट        ta  செல்சியஸ் / பாரன்ஹீட்      ur  سینٹی گریڈ / فارن ہائیٹ
```

The 9 remaining `none` are now earned on EVIDENCE rather than handed out by a probe finding nothing: cdo, om,
mg, lo and ug all report *"the layer's °C/°F/° arms all emit the same text — the letter IS dropped,
deliberately"*. ug's own layer comment says "`sources.ts` reports `[NONE] scale-names` and the wiki confirms
it"; the tool now proves that from the arms instead of by silence.

### What stays `[??]`, and why that is correct

23 languages. Two reasons, both stated in the row:

- **The arm's output is computed** — syl (a table keyed on the abbreviation), ab (`MANIFEST.symbols.celsius`),
  ht/uk/xh/si/rn/nya/kk (callbacks and assembled `new RegExp` patterns). Every one of these DOES have a scale
  word. A `none` for any of them would be a fresh false negative of exactly the kind being fixed, and an `ok`
  would be a false green. Reading arbitrary TypeScript is not in scope for a pre-flight report.
- **The corpus is in a script the probe cannot read** — cmn, arz, he, km, bn, pa, ps, or, kn, ml, am, ug,
  hsn, gan, pnb, as, my. A miss there is an unread haystack, not an absence. Each row prints the
  degree-adjacent tokens so the reader gets the candidate in hand.

syl is the case worth stating plainly: **it does not become `ok`, and that is the right answer.** Its scale
words are real and attested, but no script-general rule tells `ꠍꠦꠟꠍꠤꠀꠍ` (Celsius) from `ꠘꠤꠍꠦ` ("below") when
both sit against a `°` in the same artifact. The row now prints `ꠍꠦꠟꠍꠤꠀꠍ×2` among its candidates, so a reader
sees the evidence in one line and decides. An honest unknown is the point of the class; a false `ok` is what
this instrument exists to prevent.

### Does any of this belong in `review.ts`?

No. `review.ts` does not import from `sources.ts`, and its `sourcing` line is an independent extractor over
percent/currency/decimal that never touches `scale-names`. It had already reached the same conclusion from
the other side — its own comment reads *"'nothing declared' and 'nothing I could read' are different answers,
and printing the first for the second is what made this line lie about ug"*, and it reports both as `[??]`
with different reasons. The `unknown` verdict added here deliberately reuses that vocabulary. Convergent, not
duplicated: no logic moves.
