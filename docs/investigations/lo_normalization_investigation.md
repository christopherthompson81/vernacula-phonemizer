# lo (Lao) text normalization — investigation log

Corpus artifact: `tools/corpus/mined/lo.jsonc` — lo.wikipedia dump, **20,994 paragraphs**, 432 mined
segments (232 hard + 200 sample), `covered 32/35`. **A small wiki** — a tenth of the si or kmr dumps — so
every count below is small and is quoted as it is rather than inflated. No FLEURS corpus; espeak does not
ship Lao. Referee: kaikki Lao (Wiktionary, human, 2,310 words), 97.7%.

---

## Run 1 — 2026-08-11 — baseline

`mine.ts scan`: `math-sign ×38 · percent ×33 · degree ×10 · currency ×7 · minus ×7 · ampersand ×4 ·
exponent ×3`.

| input | reading | what is wrong |
|---|---|---|
| `ຄ.ສ. 1990` | `kʰa˧ . sa˧˥ . nɯ˧ŋ pʰa˧˥n…` | the era marker is bare letters plus TWO clause pauses |
| `1.150` | `nɯ˧ŋ . nɯ˧ŋ hɔː˥˨j haː˧˩ si˧˥p̚` | the thousands period is a clause pause |
| `US$49,600` | `…si˧˥p̚ ka˥˨w ho˧˥k̚ hɔː˥˨j` | "forty-nine, six hundred" — **two numbers, and NOTHING to see** |
| `21%` | `saː˧˥w ʔe˧˥t̚` | `%` dropped |
| `20 °C` | `saː˧˥w **sˈiː**` | degree dropped and ⟨C⟩ read as the ENGLISH letter name |
| `A & B` | `ˈə bˈiː` | `&` dropped |

⚠ **Row 3 is the one worth pausing on.** `lao.ts` deliberately emits no pause for `,`, so a grouped
thousand does not produce a stray pause the way it does in every other language treated — it just
**silently becomes two numbers**. No leaked character, no dropped symbol, nothing for `mine.ts scan` or the
corpus diff's leak classes to report. `grouped` is 805 in the dump.

---

## Run 2 — 2026-08-11 — two invisible characters, needing opposite treatment

Census over the mined segments: **U+200B ×1,503, U+00AD ×73, U+200C ×1.**

Lao is written without spaces between words, and this corpus separates them with **U+200B**. `lao.ts`'s
token is `[຀-໿]+`, which U+200B is outside — so the zero-width space is doing the **word segmentation the
language needs**, and stripping it would fuse whole phrases into one token. It stays.

**U+00AD is the opposite.** It sits INSIDE a word — `ຊະ­ນິດ`, `ສັດ­ປ່າ`, `ລະ­ດັບ` — so it splits one word
into two tokens and two stress domains. It goes.

This is the Sinhala joiner finding **with the sign reversed**, and the pair is the general statement: an
invisible character is not junk or not-junk by its class, it is junk or not by **what the tokenizer does
with it in this language**. Neither is visible to any gate here.

---

## Run 3 — 2026-08-11 — the era marker is the biggest class in the language

`era-marker` is **1,648 in a 20,994-paragraph dump** — about 8% of paragraphs. The mined segments carry
`ຄ.ສ.` ×44, `ຄ.ສ` ×7 and `ພ.ສ.` ×10, against junk of exactly the shape every wiki dump produces
(`າຊິກ.ຈຸດປ`, `ໜຶ່ງ.ຕົວວ`, `ຂ.ແຕ່`, `ປີ.ຄ.ສ.` — a full stop with no space after it).

Both expansions are wiki-attested, and one sentence settles the identification outright by writing the long
form and the abbreviation **in the same clause**:

> `300 ປີກ່ອນ**ຄຣິດສັກກະລາດ**ເຖິງ **ຄ.ສ.** 300`  — "300 years before the Christian era to AD 300"

`ພຸດທະສັກກະລາດ` ×27 is used exactly where `ພ.ສ.` stands (`ພຸດທະສັກກະລາດ 2560`).

⚠ **The rule is bounded on both sides from the start**, because ⟨ຄ⟩ and ⟨ສ⟩ are ordinary Lao letters that
begin ordinary Lao words and the missing-space-after-a-period shape is right there in the artifact. This is
the guard the Sinhala pass shipped without and had to add in review.

---

## Run 4 — 2026-08-11 — sourcing, in a script where every count is a substring count

`attest.ts` returns `attested*` for every Lao probe — trap 19: with no word boundaries the count is a
substring count and **the printed examples are the whole of the evidence**. Each was read.

| candidate | count | verdict |
|---|---:|---|
| **`ຮ້ອຍລະ`** | 3 corpus / 21 wiki | ✓ percent, **prefix in 3 of 3** (`ຮ້ອຍລະ 8.7 ຂອງຜິວໂລກ`). The loan `ເປີເຊັນ` ×2 is written on BOTH sides |
| **`ອົງສາ`** | 36 | ✓ degree, postposed — `51 ອົງສາ 50 ລິບດາ`, `0 ອົງສາ`, and the wiki's definitional *"ພິວັດ… pile an jî grad"* equivalent for the angular sense |
| **`ຈຸດ`** | 45 | ✓ the decimal point — and it IS sourceable here, unlike the last two languages: *"ຄ່າສ່ວນໃຫຍ່ຖືກປັດເປັນເລກຫຼັງ**ຈຸດທົດສະນິຍົມ**ສາມຫຼັກ"*, "rounded to three digits after the DECIMAL POINT" |
| `ບວກ` | 42 | ✗ **every hit is ເອແດມ‑ບວກ = EDINBURGH.** The Lao transliteration of "-burgh" |
| `ລົບ` | 21 wiki | ✗ on the wiki — all place names (ຈັງຫວັດ**ລົບ**ບຸລີ = Lopburi) — but ✓ in the CORPUS, which glosses it beside the signs: *"ຈຳນວນທຳມະຊາດ**ລົບ** (−1, −2, −3, ...)"* |
| **`ຕາລາງ`** | 38+7 | ✓ squared, a FUSED PREFIX: `ຕາລາງກິໂລແມັດ`, `ຕາລາງແມັດ`, always one word beside an area figure |
| **`ກ້ອນ`** | — | ✓ cubed, a FUSED SUFFIX: `7,000 ລ້ານ**ແມັດກ້ອນ**` (a reservoir), `5 ລ້ານ **ແມັດກ້ອນ**` (of oil) |
| `ລູກບາດ` | 2 | ✗ the geometric CUBE — *"ລູກບາດ ແມ່ນຮູບຊົງສາມມິຕິທີ່ມີ 6 ໜ້າ"*, "a cube is a 3-D shape with 6 faces" |
| `ຢູໂຣ` | 14 | ✗ mostly **ຢູໂຣປາລີກ** (the Europa League) and **ຢູຟາ ຢູໂຣ** — "Euro-" as in Europe |
| **`ເອີໂຣ`** | 25 | ✓ the euro; the same definitional line glosses both against `€`, but only this one also has the quantity slot — *"1 ເອີໂຣແບ່ງອອກເປັນ 100 ຊັງ"* |
| **`ຄູນ`** | 50 | ✓ multiply, glossed against the sign — *"ການຄູນ (ມັກຈະສະແດງດ້ວຍ ສັນຍາລັກຂ້າມ ×, …)"* — but `×` is ×0, so the word is RECORDED and not declared |

**The powers sit on opposite sides of the noun**, which is trap 37's per-power `position` record (the
Amharic case) and the first time this sweep has needed `compound` and `suffix` in one language.

---

## Run 5 — 2026-08-11 — the minus, where range and negative share both contexts

`ranges` is 878 and the corpus writes genuine negative coordinates and temperatures with the same dash.

**U+2212 is ×5 and all five are genuine** (`(−1, −2, −3, ...)`, `i ² = −1`, `(−5, (2k+1)π)`). The ASCII
hyphen is the hard one, and neither of the obvious guards works:

- the *bracket* arm alone misses `ໄປທາງຕາເວັນຕົກ -180 ອົງສາ` (west longitude −180), a genuine negative;
- a *degree-context* arm — which is exactly what settled Kurmanji — cannot work here, because two of the
  ranges are temperature spans (`30 - 33 c°`, `0 - 2 c°`).

What separates them is **what precedes the space**: a letter in `ຕົກ -180`, a digit in `1642 -1647`. So the
guard is "not after a number", plus the observation that a range writes a space on BOTH sides of the dash
(`30 - 33`) while a negative writes none after it. `{` is excluded for the subscript markup `p^e_{-1}`.
Result on the mined evidence: 4 genuine read, 4 ranges and 1 markup declined, 0 counter-examples.

---

## Run 6 — 2026-08-11 — the gates, and two findings they produced

```
npx vitest run          233 files / 3,386 tests
npx tsc --noEmit        OK
mine.ts scan            no defects   (was 7 classes, 99 hits)
review.ts --lang lo     checklist clean
corpus-diff compare     changed 169/431 (39.2%), DROP 99 → 43
referee-eval lo         97.7% unchanged (word path; this layer is text-path only)
```

**1. `review.ts`'s sourcing line caught an invented word.** It reported
`ຢູໂຣ — in NO source (corpus, artifact, referee, lexicon, espeak; wikipedia NOT probed)`. It was my
guess at the euro. Probing it produced the Europa-League finding above and the better spelling `ເອີໂຣ`.
This is exactly the check's stated purpose (the Fula `tere` lesson) and it is the first time in this sweep
it has fired on something I wrote.

**2. A one-letter unit key in an unspaced script is two traps at once.** The corpus writes `10.000ກມ²` —
square kilometres with the LAO abbreviation ⟨ກມ⟩ — so declaring Lao-script unit keys looked worth it.
Measured first: **a digit-adjacent Lao ⟨ມ⟩ is ×35 in the mined segments and every single one is a MONTH
NAME** — `19 ມີນາ` (19 March), `5 ມິຖຸນາ` (5 June), `1 ມັງກອນ` (1 January), `11 ມີນາ`. Trap 27 and trap 46
in one measurement. The key is refused and the price is the single `ກມ²`, listed in `defects.ts`.

**Refusals, each with its count:** `=`/`+` (`arithmetic` ×79 — every instance a formula or a worked
example, and the unit equivalences already write `ເທົ່າກັບ` in the next bracket, so voicing the sign would
say it twice), `>` (×1, inside a utility function whose Lao gloss already reads the relation aloud),
`<`/`±`/`÷` (×0), ranges (Lao writes `ຫາ` when it means one), and the clock (`:` already produces no pause,
and the mined `NN:NN` include a coordinate `ຄວາມຊັນ:51 ອົງສາ`).
