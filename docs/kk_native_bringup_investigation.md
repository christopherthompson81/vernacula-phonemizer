# Kazakh (kk) native bring-up

Target: Kazakh, canonical IPA. Turkic (Kipchak), Cyrillic script — the second Turkic language in vernacula after
Turkish. Slot in the OmniVoice coverage set contributes the dark-`ɫ` (shared with Turkish) plus the uvulars
`q`/`ʁ`/`χ`. espeak ships kk, so this is a **shim-parity** convergence: the reference is espeak-ng-portable's
canonical-mode output over the 50k frequency corpus (which already carries the kk convergence relabels ғ→ʁ,
х→χ, р→r, ү→ʏ, and the word-level л harmony). Gold = 50,000 words.

## Architecture — rule g2p (Cyrillic, near-1:1) + espeak's stress algorithm
Kazakh Cyrillic is a shallow orthography, so `g2p.ts` is a left-to-right letter scan (no lexicon):
- vowels а ә е о ө ұ ү ы і э → ɑ æ e o ɵ ʊ ʏ ə ɪ ɛ; word-INITIAL е → je (the j split off so stress lands on
  the vowel, ел→jˈel).
- glides: и → əj (=@j in espeak), у → w (a glide, not a nucleus: су→sw), я/ю/ё → ja/ju/jo.
- consonants context-free except л, emitted dark ɫ then lightened word-wide.
- relabels: ғ→ʁ, х→χ, р→r, ц→t͡s, ч→t͡ʃ, щ→ʃʃ, ъ/ь→ʔ; doubled consonants stay doubled (no gemination).

**л vowel harmony** (the census contribution) — Kazakh л is dark ɫ in back-harmony words, clear l in front. A
word is harmonically uniform, so kazakh.ts lightens ALL ɫ→l whenever the token contains any front vowel
`[eɵʏɪæ]` (ported verbatim from espeak-ng-portable's kk job): тіл→tɪl, Солтүстік→soltʏstɪk, but климаты→kɫəjmɑtə
(no front vowel).

**Stress** is espeak's `STRESSPOSN_1RU`, ported exactly from `dictionary.c`: the default is the LAST syllable,
but scanning nuclei left-to-right from the second, the first vowel flagged unstressed moves stress to the one
BEFORE it (and stops). The only unstressed vowel is ə (ы, and the ə of и=@j). So a reduced ы between full
vowels pulls stress leftward — бойынша[o,ə,ɑ]→bˈojənʃɑ (stress о, not the final ɑ) — while a word with no
reduced vowel takes final stress (Санат→sɑnˈɑt).

Two phonotactic touches: **initial-cluster epenthesis** (a word-initial run of ≥3 true consonants — glides w/j
excepted — takes a schwa after the first: стратегия→sətrɑteɡəjja, but туралы→twrɑɫə), and **consonant-only
tokens** (abbreviations) are spelled by letter name, each consonant → Cə with final stress (км→kəmˈə, РФ→rəfˈə),
with camelCase compounds split on internal capitals (ҚазМұнайГаз→qˈɑz mʊnˈɑj ɡˈɑz).

## Validation
vs the 50k canonical gold (text path): **exact 92.19%**, seg-diff **16** (0.03% — all 1× loanword/edge cases:
дж→d͡ʒ tie, standalone soft/hard signs, complex nested abbreviations). The remaining ~7.8% is **stress-only**,
at the ceiling of espeak's own kk stress: the 1RU port scores 91.5% against the gold, and the residual is
espeak's lexical stress on Russian loanwords (Индекс→ˈəjndeks, кино→kˈəjno — Russian initial stress espeak
applies from its dictionary) and inconsistent case-suffix (un)stressing (-дан stem-stressed vs -дары
final-stressed). Per the kazakh_convergence note, kk stress has NO clean referee (wikipron kk is noisy and
conflicting) — espeak-ng-portable itself verified on shim segments + referee-majority, not stress parity.

## Numbers — hardcoded atomic IPA + composition
Kazakh number words are lexicalised in espeak (жиырма is final-stressed, алпыс has a clear l, нөл has ø — none
follow the regular g2p), and the compositor glues tens+units and the hundred-multiplier without a space
(онбір, жиырмабір, екіжүз) but separates magnitude groups with a space (бір мың екіжүз отызтөрт). So numbers.ts
returns finished canonical IPA from the atomic forms captured from espeak. 100 omits the leading 1 (жүз); 1000
keeps it (бір мің); million omits it (миллион).

## Run 1 — Cyrillic g2p + 1RU stress + numbers — 2026-07-13
Built g2p.ts / kazakh.ts / numbers.ts; registered kk. Iteration on the 50k gold: found espeak's stress rule is
`STRESSPOSN_1RU` (read from tr_languages.c + dictionary.c) rather than plain final stress — porting it exactly
took stress from 55.7% (naive final) to 91.5%. Segmental fixes in order: added missing е→e (was dropped
entirely, -е is ubiquitous) 53%→86.6%; word-level л harmony (regex ported from espeak-ng-portable) 86.6%→91.4%;
consonant-only abbreviation spelling 91.4%→91.5% seg / seg-diff 385→122; glide-excluded initial-cluster
epenthesis → seg-diff 122→55; camelCase split → seg-diff 16; е→je glide-stress split → 92.19%. 6 unit tests +
full suite (130) green.

Key lessons:
- Read espeak's actual stress algorithm from source before curve-fitting — `STRESSPOSN_1RU` is a specific
  "stress the last syllable, but the first unstressed vowel bounces stress to its left neighbour" rule that a
  "last full vowel" heuristic only approximates (63.7% vs 91.5%). The distinction (find-first-unstressed, stop)
  is exactly what makes бойынша initial-stressed.
- The only unstressed vowel is ы→ə; і→ɪ is NOT unstressed (tʏrˈɪ takes final stress). Testing unstressed={ə,ɪ}
  dropped accuracy to 73%.
