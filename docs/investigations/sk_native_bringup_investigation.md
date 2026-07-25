# Slovak (sk) native bring-up

West Slavic, Slovakia (~5.2M L1), Latin script. Sibling of Czech (cs, already a 97% rule engine + loanword lexicon).
Goal: an espeak-independent canonical-IPA rule g2p. Slovak is fairly phonemic but with its own machinery: palatalisation,
the rising diphthongs (ia ie iu ô), ä, syllabic long liquids (ĺ ŕ), and voicing assimilation — so the natural shape is
the Czech rule engine (`toSegments` → nucleus-flagged segments → stress), with Slovak data.

## Run 1 — 2026-07-24 — referee + first measurement

**Referee:** wikipron `slk_latn_broad` (github.com/CUNY-CL/wikipron) — 15,950 template-expanded HUMAN entries,
space-segmented IPA. Installed as `sk.wikipron-slk-broad.tsv`. Read straight off the data:
- ⟨a⟩=a, ⟨e⟩=e (dominant; ɛ minority → fold), ⟨o⟩=ɔ, ⟨v⟩=v (NOT ʋ), palatal soft series ɟ/c/ɲ/ʎ, ⟨h⟩=ɦ, ⟨ch⟩=x.
- **⟨v⟩ is inert** — stav→stav, pravda→pravda, dievča→ɟɪ̯evt͡ʃa (v kept before voiceless č!). Unlike Czech v→f.
- palatalisation d/t/n/l → ɟ/c/ɲ/ʎ, with the **Czech y/ý-hard vs i/í-soft** split (milý→miliː keeps plain l).
- syllabic l̩/r̩ (vlk→vl̩k, krv→kr̩v), long ĺ/ŕ → l̩ː/r̩ː (stĺp→stl̩ːp).

**v1 (palatalise before i/í only, glide i̯, n→ŋ before velar): 74.0% folded.** The residual buckets pointed at three
systematic problems, all fixed this run:
1. **The ie/ia/iu glide is ɪ̯, not i̯** — the referee writes chlieb→xʎɪ̯ep, Biela→bɪ̯ela. The backbone strips the
   offglide ̯ but NOT the base letter, so i̯→i mismatched ɪ̯→ɪ. Emit ɪ̯.
2. **Palatalisation before ⟨e⟩ is the majority** — the referee (name- and native-heavy) palatalises: Debnár→ɟebnaːr,
   Dedina→ɟeɟina, deti→ɟeci, les→ʎes. Added ⟨e⟩ to the trigger set.
3. **No n→ŋ velar assimilation** — the broad referee keeps [n] (Danka→danka; ŋ is only ~0.1% of rows). Removed the rule.

**→ 86.1% folded** (+12.1pp). The e-trigger was the big lever.

**Gemination** (doubled consonant → Cː: mäkký→mækːiː) added → **86.6%** (rare in Slovak, +0.5pp).

**Referee-noise folds** — the ie-glide is written inconsistently ɪ̯ (chlieb) ~ i̯ (miest), and loanwords use lax ɪ/ʊ
for short i/u; ɪ/i and ʊ/u are not contrastive in Slovak → folded ɪ→i, ʊ→u (plus ɛ→e, ɫ→l). **→ 88.8% folded.**

**Where the residual is (not fixable by native rule):** the loanword / foreign-name **lexical palatalisation tail** —
words where d/t/n/l do NOT palatalise before a front vowel (Juliana→juliana, Lei→lei, komunisticky→komunistitski from
komunista) and international -ium/-ia sequences read as hiatus not diphthongs (nobelium→nɔbelijum, Xénia→ksenia). This
is exactly the class Czech dictionaried (loanwords.tsv). A split by capitalisation shows it is NOT name-deflation:
**common-word 88.0% ≈ proper-noun 91.2%** — the tail is a genuine lexical property spread across the vocabulary.

**Verdict: 🔷 single-source, rule g2p at 88.8%.** wikipron slk is Wiktionary-derived (kaikki sk / epitran slk would be
correlated / rule-based). The palatalisation-before-e lexicality is why Slovak rules-only (88.8%) sits below Czech
rules-only (97.7% — Czech simply doesn't palatalise before e, a cleaner rule). **The path past the floor** is the Czech
precedent: a kaikki/exception lexicon for the loanword non-palatalisation. Floor 0.87. Wired: registry (`case "sk"`),
eval PHON, `langs/sk.jsonc`, `test/slovak.test.ts` (6 tests), catalogue row, maturity row.

## Run 2 — 2026-07-24 — code review fixes

3-agent review found two HIGH bugs + agreement fixes:
- **⟨v⟩ is NOT fully inert** — the "inert" thesis was overgeneralised from CODA examples (stav, dievča). In an ONSET
  cluster before a voiceless obstruent, Slovak v regressively devoices to [f] (vták→ftaːk, včera→ft͡ʃera, všetko→fʃetkɔ —
  26/26 in the referee, common words). Fixed: v→f only when NOT preceded by a vowel (onset) AND the next segment is a
  voiceless obstruent; post-vocalic/final v stays [v] (the real Slovak difference from Czech, which devoices v→f always).
  A first attempt that devoiced ALL pre-voiceless v regressed dievča→ɟɪ̯eft͡ʃa (−1pp); the onset guard fixed it. **88.8%→89.0%.**
- **Numbers ≥1e9 emitted the literal "undefined"** (no miliarda tier → sub1000 indexed HUNDREDS[≥10]) — the same class
  as the Finnish PR-#445 bug. Fixed with a readDigits digit-by-digit fallback + a text() ≤9-digit guard (float precision).
- **Number agreement**: thousand paucal tisíc→**tisíce** (2–4: tri tisíce), and **dve** (not dva) before a magnitude
  (2000→dve tisíce). Numbers aren't referee-scored, so these slipped the gate.
- Cleanups: removed a dead palatalisation sub-clause (the i-diphthong is covered by the plain "i" trigger), the stale
  nasalAssim comment, and the i̯→ɪ̯ glide-notation drift in the g2p/jsonc docstrings. Full suite 1002/1002.
