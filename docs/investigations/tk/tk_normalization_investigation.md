# Turkmen (tk) normalization — investigation log

Picked to test **the prediction trap 61 was written with**. The Chuvash round closed on "where to look for
the next one: any alphabet whose letters have Latin twins that sit on a common keyboard layout", and
Turkmen's ⟨ň ý ş ž⟩ are exactly that shape — but in the LATIN direction, where the substitute is another
Latin letter and the failure mode should therefore be different. Turkmen is also the largest untreated
language left with a mined corpus (5M speakers), and it completes the branch arc: Kipchak (ba, tt) →
Oghur (chv) → **Oghuz**.

`tools/corpus/mined/tk.jsonc` — tk.wikipedia dump, 28,836 paragraph segments, 30/35 cells.

## Run 1 — 2026-08-16 — the prediction holds, and the failure mode is NOT a split word

Counting the Turkmen-specific letters and their look-alikes over the retained text:

| correct | ×    | substitute | ×   |
|---|---|---|---|
| ň U+0148 (n-caron) | 1,892 | **ñ U+00F1 (Spanish n-tilde)** | **157** |
| ý U+00FD (y-acute) | 3,908 | **ÿ U+00FF (y-diaeresis)** | 6 |

**161 words** in 430 segments — an 8% substitution rate on ⟨ň⟩. All of them are ordinary Turkmen: `onuñ`,
`öñ`, `biziñ`, `soñ`, `diñe`, `ýurduñ`, `Horasanyñ`, `Aleksandryñ`, `Koreÿa`, `ÿyly`, `ÿarymy`. Not one is
a Spanish or French word that would want the tilde for its own sake.

⚠ **AND THE FAILURE IS DIFFERENT FROM CHUVASH'S, WHICH IS THE POINT OF PICKING THIS LANGUAGE.** There the
substitute was a LATIN letter inside a CYRILLIC token class, so the word split and the stray went to the
English reader. Here the substitute is Latin inside a Latin token class, so nothing splits — the grapheme
scan simply has no rule for ⟨ñ⟩ and falls through to a plain [n]:

```
"öñ"     → ˈøn      vs   "öň"     → ˈøŋ        the velar nasal, gone
"onuñ"   → oˈnun    vs   "onuň"   → oˈnuŋ
"biziñ"  → biˈðin   vs   "biziň"  → biˈðiŋ
"ÿyly"   → ɯɯˈlɯ    vs   "ýyly"   → jɯˈlɯ      the glide read as a vowel
```

**Implication** One phoneme silently deleted in 8% of the language's genitives (`-yň` is the genitive
suffix, which is why `onuñ`/`biziñ`/`ýurduñ` dominate the list) — and no gate can see it, because nothing
is dropped, nothing is raw and the word is still a word. This one stays LOCAL to `normalize.ts` rather
than going into `core/unicode.ts`: ⟨ñ⟩→⟨ň⟩ is a diacritic substitution WITHIN one script, not a
cross-script confusable, and ⟨ñ⟩ is a real letter of Spanish, Basque and Galician — three languages this
fleet serves.

## Run 2 — 2026-08-16 — what the engine does today

```
"1989-njy ýylda"  → …doˈkuð ˈnd͡ʒɯ jɯlˈdɑ    ← the ordinal suffix as a separate word, ×279 in retained text
"60%-ini"         → ɑltˈmɯʃ iˈni             ← the sign dropped AND the suffix mangled
"50 ° C-e"        → elˈli k ˈe               ← the degree gone, ⟨C⟩ read as [k]
"39°31′0″N"       → …ˈnol n                  ← both marks dropped
"3/4 bölegine"    → ˈyt͡ʃ ˈdøɾt bøleɡiˈne     ← "three four"
"132,8 müň"       → ˈjyð oˈtuð iˈki , …      ← the comma a clause pause
"30,3 mln km²"    → oˈtuð , ˈyt͡ʃ mln km      ← magnitude, unit and power all raw
"b.e. öñ 330-njy" → b . ˈe . ˈøn …
"1606-1669"       → the endpoints fused into one number
"$5" · "№ 5"      → the sign dropped
"XX asyr"         → jiɡɾiˈmi ɑˈθɯɾ           ← "twenty centuries"
```

## Run 3 — 2026-08-16 — four things this corpus settles for itself

1. ⚠ **THE CORPUS GLOSSES ITS OWN DEGREE SIGN, twice, by writing both**: "ýylyň ortaça temperaturasy
   **+11° gradus**", "**-5° gradusa** çenli", "**+28° gradusa** barabar". The word and the sign in one
   token pair. ⚠ And unlike Tatar (all angular) or Chuvash (all thermal), **Turkmen's 31 degree signs are
   BOTH**: eleven are temperatures (`40-47 ° C`, `50 ° C-e`, `+10° dan`) and the rest are the coordinate
   pair `39°31′0″N 54°22′0″E`, which also needs the prime and the double prime.

2. ⚠ **THE FRACTION IS WRITTEN DENOMINATOR-FIRST — SOMETIMES.** "dünýä ilatynyň **10/1 bölegini** tutýar"
   is *one tenth* of the world's population, and "Gury ýeriň **5/1%**" is a fifth; Turkic says *onda bir*,
   the ten first. But the same corpus also writes `3/4 bölegine`, `1/9` and `1/8` in the ordinary order.
   The two conventions are distinguishable by nothing except which reading makes sense — **except that
   every reversed instance has numerator > denominator**. A rule requiring numerator < denominator ≤ 12
   takes `3/4`, `1/9`, `1/8` and refuses `10/1`, `5/1` — and also refuses the four year spans
   (`2011/2012`, `1606-1669/70`, `2015/16`, `1414/15`) that share the notation.

3. ⚠ **THE ONLY COLON-SHAPED THING IN THIS CORPUS IS A FOOTBALL SCORE** — "«Merw» toparyny **4:1**
   hasabynda utup". `clock` is 231 corpus-wide and the retained text has exactly one instance, and it is
   not a time. **No clock rule is written.** A two-field rule would have read the scoreline as half past
   four.

4. ⚠ **THE ERA MARKER IS WRITTEN FIVE WAYS** — `b.e. öñ`, `B.e. öñ`, `B.e. öňki`, `B.e.ö.`,
   `b.e.sepgidinde` — with the ⟨ñ⟩/⟨ň⟩ substitution cutting across them, so the fold in step 0 has to run
   before the era rule can be written at all. The expansion is *biziň eramyzdan öň*.

## Run 4 — 2026-08-16 — sourcing, and the fourth `tere` in this sweep

`attest.ts --lang tk` over 49 words. Every branch of the derived ordinal is corpus-attested — `birinji`
×45, `ikinji` ×42, `üçünji` ×26, `dördünji` ×26, `onunjy` ×18, `otuzynjy` ×9, `ellinji` ×2 — which
independently confirms both the labial-harmony rule and the `dört` → *dörd* voicing. And two words come
back with the corpus doing the sourcing outright:

- **`gradus` ×31 names the sign, the scale AND the compound in one sentence**: "0 K (Kelwin)= -273,15°C
  **(gradus Selsi)** -dir". ⚠ That is also what corrected the rule: `Selsiý`, the form I first wrote,
  scores **0** — the language writes `Selsi`.
- **`eramyzdan` ×72 with the era phrase intact**: "**Biziň eramyzdan öň** VI asyryň ahyrlarynda",
  "**Biziň eramyzdan öň** 500-449-njy ýyllarda". The same examples surfaced the `ý.` year abbreviation
  (`500-494ý.`, `480-479ý`), which was reaching the g2p as the bare glide [j] and now has a rule.
- `göterim` ×57 (percent), `inedördül` ×45 (square), `sagatda` ×14 and `sekuntda` ×21 with figures beside
  them, `belgi` ×13 (the № word), `kilometr` ×36, `metr` ×53, `dollar` ×50, `manat` ×40.

⚠ **`otur` AND `otyr` ARE THE VERB "SIT"** — "gel, **otur** sen gaşymda", "gaty ýerde **otur**", "«möjek»
**otyr**". That is the Fula `tere` shape for the fourth time in this sweep, and it cost the decimal
separator: `wergul` scores 0, and `nokat` ×21 names the DOT ("**Nokat (.)** — dyngy belgisi"), not the
comma. So **Turkmen is the first layer in this sweep whose tokenizer does NOT span the decimal comma** —
ba, tt, chv, uk, pl and be all emit the separator's own name, and Turkmen has none this corpus will
source. The comma stays a clause pause, which keeps the two halves audibly separate and invents nothing.
The shared tier is unaffected: it matches `132,8` as one quantity in the TEXT, before the tokenizer sees it.

⚠ **`plýus` scores 0 and ships anyway**, on the same terms ba's `плюс` did: it is the twin of the attested
`minus` ×4, this corpus writes `+11°`, `+28°` and `+ 37°` in its own climate prose, and `plus` ×6 is a
FALSE attestation — four French song titles, one Latin etymology gloss. The gap is recorded, not papered over.

## Run 5 — 2026-08-16 — the multiplication sign is a brick

Printing every `×`: **all eleven are a BRICK DIMENSION** in the archaeology articles — `31×31×7 sm`,
`27×27×5 sm`, `23×25×6 sm`, `26,5 ×?×5 sm`, `340×560 metr`. A three-term size specification, not a
product. `esse` ×41 is the Turkmen multiplicative fold, but no source here reads a DIMENSION with it, and
putting a product word between the three terms of a mud-brick's measurements would be confidently wrong
eleven times out of eleven. Refused and registered.

`=` ×13 has exactly ONE prose arithmetic (`859+4050 = 4909`); the rest are a typo for a hyphen
(`1963=nji ýylyň`), raw LaTeX, a unit-equivalence chain (`1 uzel=sagatda 1 deňiz mili=1,852 km/sag`), a
byte-size table ×4 and a Quran citation. `>` ×1 is a typo for ⟨ş⟩. Both refused.

## Run 6 — 2026-08-16 — three defects the probes found late

**`ýüz` gave *ýüzinji* for the hundredth.** ⟨ý⟩ is the GLIDE [j], not a vowel, and my vowel set included
it — so `ýüz` counted as disyllabic, the labial harmony was suppressed and the linking vowel came out
unrounded. ⟨y⟩ IS a vowel and ⟨ý⟩ is not, and they differ by one accent.

**`+11° gradus` came out *gradus gradus*.** The corpus's own gloss — the sign AND the word — is what
sources the reading and also what breaks an unguarded fallback. A lookahead makes the gloss usable as
evidence and harmless as input.

**`60%-ini` left the suffix standing as its own word.** The shared tier reads the sign but cannot see the
`-ini` hanging off it, and by the time the tier runs the figure and the suffix are no longer adjacent. So
the percent-with-suffix case is claimed in `normalize.ts`, before the tier, repeating the tier's own word
deliberately.

## Run 7 — 2026-08-16 — the gates

- **`mine.ts scan`**: `percent` 26→0 · `exponent` 20→0 · `currency` 15→0 · `degree` 12→0 · `minus` 6→1 ·
  `math-sign` 26→1 · LEAK `km` 40→1 · `mln` 15→0 · `mm` 8→0 · `kg` 5→0. Residual, all read: five web and
  tech abbreviations (`www`, `tm`, `kw`, `mb`, `pdf`), an English `2nd ed.`, a Mongolian gloss, one Russian
  bibliography hyphen and the one real `=`. Two REDUNDANT flags (`degree`, `currency`) are correct
  behaviour — the corpus wrote the word beside its own sign and the layer now declines to double it.
- **corpus diff** (baseline emitted from a pristine worktree at `c468b97`): **277/427 utterances changed
  (64.9%), DROP 87 → 19**, and no DIGIT / SLOT-GAP / RAWMARK / RAW-CAPS / THROW on either side.
- **`review.ts --lang tk`**: green on every checklist item including `sourcing` and `sign classes` — the
  six refused sign classes are registered in `ACCEPTED_SIGN_SILENCE` with their counts.
- **`referee-eval tk`**: **21.9% raw / 80.4% folded / 94.9% symbol, before and after** — measured on both
  sides from the pristine worktree, and unchanged as expected for a layer that rewrites text and not the
  word g2p.
- **`vitest`** 4,529 passed and **`tsc --noEmit`** clean.

## Backlog surfaced, not fixed

- **The tilde fold rewrites a Spanish or French word spelled only with Turkmen letters** (`señor`, the
  `Haÿ` of `L'Haÿ-les-Roses`). Measured cost in this corpus: zero. Stated in the file rather than guarded.
- **`b.e.sepgidinde`** — the era abbreviation glued to the following word by a missing space in the dump
  extraction. One instance; a rule loose enough to catch it would fire inside ordinary words.
- **The rate reads denominator-last where Turkmen writes it first** (`sagatda 800 ýolagça` — "per hour,
  800 passengers"). A tier limitation, the same one tt recorded.
- **`2011/2012-nji`** — the ordinal rule claims the second year and the slash is then left with no digit
  after it, so the pause rule cannot reach it. The two years still read; the pause does not.
