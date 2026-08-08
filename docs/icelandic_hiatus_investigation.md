# The Icelandic hiatus glide — which vowel actually triggers it

Spun out of `ipa_classes_investigation.md` Run 7, which found the rule over-applying on three
referee-attested words while I was busy trying to make it fire MORE often. The engine inserted a glide
[j] between a "high front vowel" ⟨i í y ý⟩ and a following vowel (Biblía→pɪplija). That letter class was
reasoned from phonology, never measured.

Referee: `tools/referee-eval/referees/is.wikipron-isl-broad.tsv` (wikipron isl_latn_broad, human,
10,093 scored headwords). Baseline folded backbone at the start: **8086/10093**.

## Run 1 — 2026-08-07 ~22:10 — does the referee condition the glide at all?

    npx tsx hiatus.scratch.ts   # every headword with a high-front letter directly before a vowel letter

**Question:** is the glide categorical (and the referee just inconsistent), or conditioned?

**Raw finding:** 95 headwords with a glide at that seam, 26 without. Conditioned, not noise.

## Run 2 — 2026-08-07 ~22:20 — conditioned on WHAT

Same scan, bucketed by (high-front letter, following letter):

| pair | glide | none | examples without |
|---|---|---|---|
| í+a | 73 | 7 | Gloría, bavían, bavíani |
| í+u | 10 | 2 | níutugasti, tíu |
| í+ó | 4 | 3 | bílabíó, bíóhús, bíómynd |
| í+e | 3 | 1 | þríeinn |
| **i+e** | **0** | **4** | Briem, Nielsen, beitieski |
| **ý+y** | **0** | **2** | nýyrðasmíð, nýyrði |
| ý+a | 0 | 1 | blýantur |
| ý+e | 0 | 1 | hýena |
| i+ö / i+á / í+i / í+æ | 0 | 1 each | Schiöth, æviágrip, Svíi, tvíær |

Totals by trigger letter: **⟨í⟩ 90/13**, ⟨i⟩ 2/7, ⟨ý⟩ 0/4, ⟨y⟩ 1/0.

**Implication:** the glide belongs to the LONG ⟨í⟩. The class was built on the phonological intuition
that high front vowels break hiatus, which groups ⟨í⟩ with ⟨i y ý⟩ — but the orthographic length
distinction is exactly what the data separates on.

## Run 3 — 2026-08-07 ~22:30 — measure the candidates end to end

    npx tsx tools/referee-eval/eval.ts is       # after editing highFrontVowels

| trigger set | folded backbone |
|---|---|
| ⟨i í y ý⟩ (before) | 8086/10093 |
| ⟨í ý⟩ | 8087/10093 |
| ⟨í y ý⟩ | 8087/10093 |
| **⟨í⟩** | **8091/10093 (80.2%)** |

**Raw finding:** +5 words. Adopted. The key is renamed `hiatusGlideVowels` — "highFrontVowels" named the
reasoning that turned out to be wrong, and a one-letter list under that name would just look like a bug.

**Not tuned further.** Dropping ⟨í⟩ before ⟨ó⟩ (the bíó words, 4 glide / 3 none) would trade 4 losses
for 3 gains. The í+a minority (7 words: Gloría, bavían, …) stays wrong; at 73/7 the majority rule is
right and those are lexical.

## Verified

`npm run ci` green — 228 files / 3136 tests. New goldens pin ⟨i⟩/⟨ý⟩ glideless (hýena, beitieski,
blýantur) and ⟨í⟩ keeping it (Albanía, Biblía).
