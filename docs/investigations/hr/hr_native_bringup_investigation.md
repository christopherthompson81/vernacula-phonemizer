# Croatian (hr) bring-up — investigation

Bring up Croatian (hr), a FLEURS-102 language: Indo-European (South Slavic), Latin (Gaj's) script, ~5M.

## Run 1 — 2026-07-24 — served_by sr (no defensible delta)

Croatian and Serbian are the pluricentric standards of one phonological system (Serbo-Croatian). The **Serbian (sr)
engine is already DUAL-SCRIPT** — it reads Gaj's Latin (the exact Croatian alphabet: a b c č ć d dž đ e f g h i j k l
lj m n nj o p r s š t u v z ž) as well as Cyrillic — and its referee is **wikipron hbs_latn** (hbs = the Serbo-Croatian
MACROLANGUAGE, 26k words), which already contains the Croatian words (on Wiktionary, Croatian is filed under
"Serbo-Croatian" — the standalone "Croatian" IPA category is empty, 0 entries).

**Verified: the Serbian engine produces correct Croatian output with ZERO delta**, including Croatian-specific
Ijekavian forms and vocabulary:
```
hrvatski→xrʋatski  mlijeko→mlijeko  čovjek→t͡ʃoʋjek  đak→d͡ʑak  ljubav→ʎubaʋ  zdravlje→zdraʋʎe
tisuća→tisut͡ɕa  dvije→dʋije  vrijeme→ʋrijeme  htjeti→xtjeti  Hrvatska→xrʋatska  džep→d͡ʒep  njegov→ɲeɡoʋ
```
The Latin grapheme→IPA is IDENTICAL (č=t͡ʃ, ć=t͡ɕ, dž=d͡ʒ, đ=d͡ʑ, š=ʃ, ž=ʒ, c=t͡s, lj=ʎ, nj=ɲ, h=x, v=ʋ, j=j); the
lexical pitch accent + length are unwritten and DEFERRED in both; Ijekavian ⟨ije/je⟩ is just letters the scan reads.

**Decision: `hr` served_by `sr`** — a labelled alias to the Serbian engine, exactly the zsm→id / bgc→hi pattern. A
bespoke Croatian module would be a byte-identical clone of the Serbian one (no grapheme→IPA delta to justify it),
which the served-by policy explicitly avoids ("never an invented bespoke clone"). Croatian stays a first-class code
(discoverability + dignity) that works today, transparently served by its verified sibling. Locked by
test/croatian-alias.test.ts. If a documented Croatian-specific phonological delta + a Croatian-only referee ever
appear, replace the alias with a bespoke module.


## Run 2 — 2026-07-24 — review found a numbers delta → THIN module (not a pure alias)

The adversarial review of the pure `served_by=sr` alias confirmed the letter/digraph g2p is genuinely IDENTICAL (the
`injekcija`/`nadživjeti` prefix-boundary residuals are shared Serbo-Croatian, not a Croatian delta), BUT found ONE
real Croatian-specific delta: **cardinal NUMBER WORDS**. A pure alias sends Croatian numbers through the Serbian table,
so `1000`→xiʎadu (Serbian *hiljadu*, should be Croatian *tisuću*), `1000000`→…milion (vs *milijun*), and hundreds are
Ekavian-hardcoded (*dvesta* vs Croatian *dvjesto*).

Fixed the right way — a **thin Croatian module** (`src/languages/croatian/`) that REUSES the Serbian engine's
`phonemizeWord` verbatim (the segmental g2p is 100% shared, no clone) and overrides ONLY the numbers: the Serbo-Croatian
agreement compositor was extracted to `serbian/numbers.ts composeSlavicNumber(n, N)` (Serbian output byte-identical),
and Croatian passes its own word table (`croatian.jsonc`: tisuća/milijun/dvjesto; units/teens/tens identical). Verified:
`1000`→tisut͡ɕu, `200`→dʋjesto, `1000000`→jedan milijun, `2000`→dʋa tisut͡ɕe; words unchanged (mlijeko→mlijeko, đak→d͡ʑak).
Tokenizer is Latin-only (Croatian is written exclusively in Gaj's Latin — see the front-end note above). So hr is no
longer `served_by=sr`; it is a thin bespoke module (the pt-BR parameterized-dialect shape), verdict 🟢. Locked by
test/croatian.test.ts (words==sr + Croatian numbers). Serbian suite stays green (compositor refactor is behaviour-
preserving).

## Note — scripts / front-ends

**Croatian needs no Cyrillic (or any second) front-end.** Modern standard Croatian is written EXCLUSIVELY in Gaj's
Latin (the historical Glagolitic / Bosnian-Cyrillic *bosančica* are liturgical/archival, not the modern standard). So
a single Latin front-end is complete for Croatian.

The Serbian engine that `hr` aliases to happens to be DUAL-SCRIPT (Cyrillic + Latin in one table, because Serbian is
digraphic and the two alphabets are 1:1 parallel with the same phonology). Croatian inherits that Cyrillic capability
for free — it is simply UNUSED for Croatian text, and harmless if ever fed Cyrillic (it yields the same Serbo-Croatian
phonemes). We do NOT add a Latin-only guard: the phonology is identical, so leniency costs nothing and a wrapper would
only add code for a pedantic gain.

When ARE multiple front-ends warranted in the fleet? Only when a language is genuinely used in ≥2 scripts whose
orthography→phoneme mappings DIFFER and can't collapse to one table — e.g. Mongolian Cyrillic vs the traditional
Mongol-bichig (a deep historical orthography → a real transliteration front-end), or Punjabi Gurmukhi vs Shahmukhi /
Sindhi (cross-script). Serbo-Croatian Cyrillic+Latin is NOT that case: it's one parallel alphabet pair → one table.
