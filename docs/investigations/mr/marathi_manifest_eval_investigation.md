# Marathi manifest eval — and the proliferating definitions it surfaced

Two questions, asked together because Marathi turned out to be a good lens on both:

1. What in `src/languages/marathi/*.ts` is **constant-definition data** that belongs in `marathi.jsonc`?
2. What is a **proliferating definition** — the same constant written out in language after language?

## Run 1 — 2026-08-24 — inventory of Marathi

`grep` for every `const` and every Devanagari literal in the normalizer body, comments stripped.

**Already lifted (#947):** `currency`, `percent`.

**Still inline, mr-specific — belongs in `marathi.jsonc`:**

| what | where | size | note |
|---|---|---|---|
| `SUFFIX_FORM` ordinal suffix → agreement slot | normalize.ts:27 | 4 | |
| `IRREGULAR` ordinals 1-4 × 4 agreement forms | normalize.ts:38 | 16 | index order [masc,fem,neut,obl] must travel with it |
| `ordinalStem` specials (`शंभरा`, `नऊ→नव`, `ीस→िसा`) | normalize.ts:87 | 3 | interleaved with a UNITS/TEENS set test that is genuine algorithm |
| `UNIT_WORD` (Devanagari + Latin unit abbrevs) | normalize.ts:57 | 26 | ⚠ the Latin keys DELIBERATELY duplicate the tier's — normalize.ts:71-86 records that step 14 destroys digit adjacency, so this lifts as TWO keys with the reason, never as a merge |
| `MAGNITUDE_ALT` | normalize.ts:94 | 8 | |
| `TAH_ADVERB_ALT` visarga adverbs | normalize.ts:100 | 8 | closed lexical list |
| tier `ampersand`, `multiply` | marathi.ts | 2 | |
| tier `units` (incl. the deliberate `l`/`L` pair, `हेक्टर`) | marathi.ts | 7 | ⚠ `हेक्टर` is the HECTARE in Marathi and HECTOR in Hindi — the note must travel |
| clock `वाजून` / `मिनिटे` / `वाजता` | normalize.ts:113,201 | 3 | ⚠ `वाजता` also appears inside the regex at :201 and :206 |
| era `इसवी सन पूर्व` / `इसवी सन`, `डॉ.→डॉक्टर` | normalize.ts:153 | 3 | |
| degree `अंश` + the six compass/scale words | normalize.ts:219 | 7 | |
| fractions `अर्धा` `पाव` `पाऊण` `भागिले` | normalize.ts:271 | 4 | |
| sign words `अधिक` `सुमारे` `अधिक उणे` `पेक्षा कमी` `पेक्षा जास्त` `ने भागणे` `बरोबर` | normalize.ts:288-319 | 7 | |
| `शंभर` bare hundred, `ते` range | normalize.ts:283,264 | 2 | `शंभर` belongs beside `magnitudes.hundred: शे` |

⚠ **The half-lifted tier is worse than either end state.** After #947, `MR_SYMBOLS` reads `percent` and
`currency` from the manifest and spells `ampersand`, `multiply` and `units` inline — in one object literal.
A reader cannot tell which half is authoritative, and editing the unit words in `marathi.jsonc` would do
nothing. That is the same split-brain condition the £ bug came from.

## Run 2 — 2026-08-24 — how much of this is Marathi's problem at all

Counted structural shapes across all 168 `src/languages/*/normalize.ts`, comments stripped.

| shape | languages |
|---|---|
| range `a–b` | 141 |
| degree `°` | 76 |
| no-letter boundary `(?<![\p{L}\p{M}])` | 69 |
| `makeSymbolNormalizer` | 61 |
| clock `HH:MM` | 61 |
| **`±`** | **54** |
| leading `+` before a digit | 33 |
| vulgar `½¼¾` | 15 |
| `postposedSign()` | 12 |

Then: are they the SAME definition, or 54 different ones?

    ± pattern                    54 sites,   1 distinct pattern   (/±/gu)
    left  boundary (?<![\p{L}\p{M}])   112 sites,   1 distinct
    right boundary (?![\p{L}\p{M}])    115 sites,   1 distinct
    degree                      156 sites,  51 distinct
    clock lookbehind             67 sites,   7 distinct

**`±` and the two boundary constants are pure proliferation** — one definition, written out 281 times. Only
the *replacement word* varies, and that is already per-language data. These are shared-core constants
misfiled as per-language code.

**The clock lookbehind is proliferation WITH ACCIDENTAL VARIATION**, which is worse:

    [\d,.:]  32 languages      [\d,:]   7
    [\d:]    14                [\d,.]   2  (persian, welsh — no colon at all)
    [\d.:]   10                bespoke  2  (ilocano, umbundu)

`[\d.:]` and `[\d:.]` are the same class spelled two ways. `[\d:]` is genuinely narrower. And afrikaans,
dutch, welsh and tamil each appear in MORE THAN ONE bucket — the same language guards the same rule
differently in different rules.

## Run 3 — 2026-08-24 — the degree guard is a live defect in five languages

156 degree sites, 51 distinct patterns. Most guard with `(?![\p{L}\p{M}])`. **Five use `\b`**: de, id, pt,
so, su. `PORTING.md` already records that JS `\b` is ASCII-`\w`-based — so after `°C`, a following
NON-ASCII letter is a word boundary and the rule fires when it must not.

    input          de  25°Cölner → ɡʁaːt kˈɛlzi̯uːzœlnɐ      ⚠ C eaten as Celsius, "ölner" left over
                   pt  25°Cölner → ɡɾˈawʃ sɛɫsiwsuɫnˈeɾ     ⚠ same
                   mr  25°Cölner → ˈə̃ʃ kʰˈɑːɫnɚ             correctly declines
                   nl  25°Cölner → ɣrˈaːdənkœlnər           correctly declines

`25°Ca` behaves identically everywhere (ASCII `a` is `\w`, so `\b` fails), which is why the bug survived:
it is invisible to any ASCII fixture. German and Portuguese are precisely the languages whose own
orthography supplies the following accented letter.

## What this implies for the work

1. **Fix the `\b` degree guard** in de/id/pt/so/su — a real defect, TS-first, five languages.
2. **Hoist the pure-proliferation constants** — `±` and the two no-letter boundaries — into `core/`. 281
   sites, one definition each, zero behaviour change.
3. **Reconcile the clock lookbehind** — decide whether `.` and `,` belong in the class, per language, and
   stop spelling the same class two ways.
4. **Finish Marathi's manifest** — including the tier fields, so the object stops being half-lifted.

Order: (1) is a bug, (2) is free, (4) is the original request, (3) needs a per-language judgement and
should be last.
