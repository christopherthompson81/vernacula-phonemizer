# Bashkir (ba) normalization — investigation log

Picked as the next language in the sweep for one reason above the corpus size (`tools/corpus/mined/ba.jsonc`,
ba.wikipedia dump, **618,078** paragraph segments, 33/35 cells): the playbook makes a **specific, testable
prediction** for a Turkic corpus — trap 14, the case suffix glued to the figure, and trap 15, the same
morpheme also written with a space. That is a hypothesis to verify rather than assume, which is a better
reason to pick a language than "it is next by size". Step 0b was already done, so this log starts at step 1.

## Run 1 — 2026-08-16 — what the engine does today

**Command** `phonemize(form, "ba")` over one attested form per cell.

**Raw finding** — the prediction holds, and it is the biggest class here:

```
"1-се"        → ˈbɪɾ ˈsɪ                  ← the ordinal suffix as a separate word
"8:30-ҙа"     → hiˈɡɪð , uˈtɯð ˈðɑ        ← the case suffix as a word AND the colon as a pause
"100-ҙән"     → ˈjøð ˈðæn
"20-се йылдарҙа" → jɪɡɪɾˈmɪ ˈsɪ jɯɫdɑɾˈðɑ
```

And the ordinary ones:

```
"3 000 000"   → ˈøs ˈnuɫ ˈnuɫ             ← "three zero zero"
"70 %"        → jɪtˈmɪʃ                    ← the sign dropped
"5,3 %"       → ˈbiʃ , ˈøs                 ← the decimal comma is a PAUSE
"+28 °C"      → jɪɡɪɾˈmɪ hiˈɡɪð sˈiː       ← ° gone, ⟨C⟩ read as the ENGLISH letter name
"12,5 км"     → … km                       ← the unit as a raw cluster
"100 кг"      → ˈjøð kɡ
"1991 й."     → … ˈbɪɾ j .                 ← `й.` (йыл) as the bare glide
"СССР"        → sssɾ
"б. э. т."    → b . ˈɪ . t .
"5²" / "10 км²" → ˈbiʃ / ˈun km
"1990-1995"   → …tuqˈhɑn …tuqˈhɑn ˈbiʃ     ← the dash silent, endpoints fused
"№ 5"         → ˈbiʃ
```

`mine.ts scan` over the artifact, same day: `percent ×29 · math-sign ×20 · exponent ×20 · currency ×16 ·
degree ×13 · minus ×6 · ampersand ×2`.

## Run 2 — 2026-08-16 — the suffix inventory, and four classes that are not what they match as

**Command** counted regexes over the artifact's retained text (460 segments), then printed the surrounding
context of every class before writing any rule.

**The suffix inventory (37 instances), which is what the layer is built around:**

| written | n | what it is |
|---|---|---|
| `-се` | 15 | the ordinal — `1-се`, `50-се йылдар`, `14-се урынды`, `27-се солтаны`, `1774-се йылдың` |
| `-сы` | 4 | the ordinal, BACK harmony — `60-сы йылдарҙа`, `159-сы урын` |
| `-сө` | 3 | the ordinal, ROUNDED — `23-сө урында`, `13-сө урынға`, `3-сө` |
| `-е` | 6 | ⚠ **all Russian** — `Издание 1-е`, `4-е изд.`, `2-е изд.` ×3, `в 1990-е башкир…` |
| `-ө` `-һе` `-н` | 3 | possessive / accusative — `2 626 613-ө ҡалала`, `1 172 287-һе`, `1 923 233-н` |
| `-тән` `-дан` `-дән` `-гә` | 4 | case — `1/4-тән ашыу`, `1/10-дан кәмерәк`, `0-дән юғары`, `1/1000-гә яҡын` |

⚠ **Trap 15 does NOT bite here, and that is a measurement, not an assumption.** 191 instances of
`digit + space + short token` exist, but reading them shows they are units and nouns (`км` ×43, `мең` ×29,
`м` ×20, `млн` ×18, `көн` ×7, `йыл` ×7) — not a detached bound suffix. Oromo's shape does not recur.

⚠ **Four classes are not the class they pattern-match as:**

1. **The 98 "dot decimals" are almost all PERCENT-ENCODING.** `[[#cite_note-.D0.9A.D0.9F.D0.A1…]]` is a
   URL-escaped wiki anchor, and `.D0.9A` alone supplies the `0.9` that tops the frequency table (×17).
   The rest are a lens aperture (`Planar 50mm f/0.7`), a page range (`6.5-66`) and a Russian date
   (`1.1У.44г.`). **Zero are decimals** — so, unlike Belarusian next door whose 82 were mostly genuine,
   **no dot-decimal fold is written here at all.** The comma decimal (×169) is the real one.
2. **`г.` WITH A DOT is Russian *года***, and every instance sits inside a Russian-language passage
   (`с 1938 г.`, `в 1940 г.`, `в 1941 г.` ×2, `М., 1988 г.`) — ba.wikipedia carries a lot of Russian
   bibliography and archival citation. **`г` WITHOUT a dot is the gram** (`3,300 г`, `2,176 г`). The dot is
   the only discriminator, and the shared tier's trailing guard does not reject a dot, so the gram is
   claimed locally instead of declared.
3. **`с.` is Russian *страниц*** (`80 с.`, `65 с.`, `707 с.`); the only Bashkir second is inside `м³/с`.
   Declared as a rate denominator only. **`т.` is *том*** in the same bibliographies.
4. **`=` ×17 is markup** — `a*a^{-1}=a^{-1}*a=e`, `\aleph_0=\hbar`, and a typo (`1996=2006`). One is a real
   equation (`рН = 6,4÷6,7`), so the rule is digit-gated.

**And three signs that end in a measured refusal rather than a rule:** `<` ×0; `>` ×1 and it is a **Thai
reduplication arrow** in a linguistics example (`เด็ก (dek, «бала») --> เด็กๆ`); `÷` ×1 and it is a **RANGE
in the Russian convention** (`рН = 6,4÷6,7` — pH from 6.4 to 6.7), not a division. All three are registered
in `ACCEPTED_SIGN_SILENCE` with their counts.

**Ranges are genuine** — `300—600 мм ападкаһы`, `120—135 көн`, `1900—2200°`, `15—25 см`, `3—6 км`,
`1-3 эш көнө`, `7-14 көн`, `2010—2018 йылдарҙа`. The football scores exist and are the minority.

## Run 3 — 2026-08-16 — sourcing, and the ordinal derived rather than tabulated

**Command** `attest.ts --lang ba --words …`, then reading every example.

Attested with the sense checked: `процент` ×206 (its own article: "йөҙөнсө өлөштә **процент** ставкаларын")
· `градус` ×71 ("95 **градус** көнсығыш оҙонлоҡ" — with a figure) · `Цельсий` ×36 ("**Цельсий градусы**,
Фаренгейт градусы" — ⚠ note the ORDER: scale first, not *градус Цельсия*) · `тигеҙ` ×350, the equals
reading beside its own formula ("квадрат яғының яртыһына **тигеҙ**: r = t/2") · `тапҡыр` ×103 ("11
**тапҡыр** — Советтар Союзы Маршалы") · `минус` ×41 («**минус өс**» тип атала — the sign spelled before a
numeral) · `квадрат` ×165 · `куб` ×35 · `номер` ×31 · `доллар` ×221 · `евро` ×87 · `һум` ×142 · `өтөр` ×27,
the comma's own article ("**Өтөр** — тыныш билдәһе").

⚠ **`плюс` ×48 is a FALSE attestation** — every hit is the radio station «Европа Плюс». It ships as the
twin of the `минус` attestation, because this corpus writes `+18 °C` and `+0,3 °C` in its own climate
prose; the gap is recorded rather than papered over.

**The ordinal is DERIVED, not tabulated**, because Turkic ordinal formation is regular where the East
Slavic one is suppletive. The harmony rule that fits every attested form:

```
last vowel ө / о             → -өнсө / -онсо     өс → өсөнсө,  йөҙ → йөҙөнсө
last vowel а / ы / у         → -ынсы             алтмыш → алтмышынсы,  ун → унынсы
last vowel ә / э / е / и / ү → -енсе             бер → беренсе,  дүрт → дүртенсе
…vowel-final stem drops the linking vowel        ике → икенсе,  илле → илленсе
```

⚠ **Labial harmony is NARROWER than the vowel inventory suggests**, and that is the one way the derivation
can misfire: ⟨у⟩ and ⟨ү⟩ are rounded and do NOT round the suffix — `ун` is *унынсы*, not *унонсо*, and
`дүрт` is *дүртенсе*, not *дүртөнсө*. Only ⟨ө⟩ and ⟨о⟩ do. Each live branch is exercised by an attestation:
-енсе (`беренсе` ×50, `егерменсе` ×21, `меңенсе` ×26), -ынсы (`унынсы` ×29), -өнсө (`өсөнсө`, in the corpus).

**A decision that is lossy on purpose.** The Коска-shaped question recurs: Bashkir reads `5,3` fully as
*биш бөтөн өс ундан*, and `бөтөн` is attested ×207 in exactly this numeric domain ("Бөтөн һандар" = the
integers) — but the tail NAMES THE DECIMAL PLACE (ундан / йөҙҙән / меңдән), which the number path cannot
compose. Half of a two-part reading is worse than the sign's own name, so `өтөр` is emitted. Same call uk
made (кома), pl made (przecinek) and be made (коска).

## Run 4 — 2026-08-16 — three defects the corpus diff and the tests found, and none of them a probe

1. ⚠ **`м²` was reading as the ENGLISH "em squared"** ([ˈɛm skwˈɛɹd]) — the Cyrillic-only tokenizer hands a
   Latin run to `core/foreign.ts`. Same shape as `°C` → [sˈiː]. Both fixed; neither is visible to a leak
   class, because an English word is not a raw mark.
2. ⚠ **`17—19 °Т` fused into *градуст***. The bare-degree rule wrote `$1 градус` and the corpus writes the
   sign GLUED to a letter the rule does not claim (°Т is degrees Turner, a dairy acidity unit), so the
   words ran together into one impossible token. Fixed by emitting a trailing space.
3. ⚠ **`Әхмәт III-сөнөң` gave *өссөнөң***. The written suffix runs PAST the ordinal's own tail — it is
   *өсөнсө* plus a genitive — and a plain `endsWith` test cannot see that, so it fell through to the glue
   path. Fixed by splicing on the longest OVERLAP between the ordinal's tail and the written suffix, which
   reduces to `endsWith` when there is no case ending.

**And two the branch-pinned tests found, which no corpus gate could:**

- **`1 923 233-н` gave *…утыҙ өсн***, a syllable no Bashkir word can carry. The writer's `-н` is the
  accusative of a possessive whose linking vowel they did not type. A glued suffix must now bring its own
  vowel unless the numeral ends in one; one instance, declined rather than emitted.
- **`613-ө` gave *…өсөнсө* (the ordinal) where the corpus means *өсө* (the possessive)** — «2 626 613-ө
  ҡалала», "613 of them live in the city". `endsWith` cannot separate them, because *өсөнсө* also ends in
  ⟨ө⟩. The ordinal branch now needs a TWO-letter suffix: every ordinal this corpus writes is ≥2 letters and
  starts with ⟨с⟩ or ⟨н⟩; every one-letter suffix in it is possessive.

## Run 5 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 29→0 · `degree` 13→0 · `currency` 16→0 · `ampersand` 2→0 · `exponent`
  20→2 · `minus` 6→1 · `math-sign` 20→3 (plus 7 now classified `ACCEPTED-CLASS`). Residual, all read: the
  Greek-etymology `+` joining two morphemes, raw LaTeX, a Russian bibliography's minus, and one English
  title (`2nd Generation…`).
- **corpus diff** (baseline emitted from a pristine worktree): **274/460 utterances changed (59.6%),
  DROP 81 → 16**, and no DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / RAW-CAPS / THROW on either side.
- **`review.ts --lang ba`**: green on every checklist item except the artifact scan; the four refused sign
  classes are registered with their measurements rather than left as bare DROPPED lines.
- **`referee-eval ba`**: **40.8% folded / 81.1% symbol, before and after** — unchanged, as expected for a
  layer that rewrites text and not the word g2p. (The absolute number is the pre-existing single-referee
  situation this language's manifest already documents: kaikki is the only referee and it transcribes
  Russian loans inconsistently.)
- **`vitest`** and **`tsc --noEmit`** clean.

**A bonus the derivation paid for.** `romanOrdinals.ts` for a century (`roman` 29,234 corpus-wide; `XIX
быуат` was reading as the cardinal *ун туғыҙ быуат*, "nineteen centuries") cost almost nothing, because it
imports `ordinalOf` from `normalize.ts` instead of authoring a second table — which is what ru/uk/be each
have to do, since their -ый/-ое series cannot be derived from the cardinal. One derivation, one place it can
be wrong. And Bashkir has no grammatical gender, so the limitation those three files each record does not
exist here.
