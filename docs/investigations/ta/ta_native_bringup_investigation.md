# Tamil (ta) native bring-up

Target: Tamil, canonical IPA, espeak-independent. Slot #13 in the OmniVoice coverage set (contributes `ʉ`→`ʊ`
and the retroflex approximant `ɻ` = ழ). Tamil is an ABUGIDA: consonants carry an inherent vowel /ɐ/, vowel
signs (matra) replace it, and the pulli ் removes it. espeak has solid Tamil, so the portable-espeak
canonical output is the oracle.

## Convention (from the portable-espeak canonical output)
- Vowels: அ→a (independent) / inherent→ɐ, ஆ/ா→aː, இ/ி→ɪ, ஈ/ீ→iː, உ/ு→ʊ, ஊ/ூ→uː, எ→e, ஏ→eː, ஐ/ை→aᶦ,
  ஒ→o, ஓ→oː, ஔ/ௌ→aᶷ. Short i/u are lax (ɪ/ʊ).
- Retroflex ண→ɳ, ட→ʈ, ள→ɭ, ழ→ɻ; dental த→t̪, ந→n̪; three coronal nasals ந(n̪)/ன(n)/ண(ɳ); two rhotics
  ர(tap ɾ, coda r)/ற(r, but ற்ற→ʈr); ச→t͡ɕ, ஞ→ɲ, ஜ→d͡ʒ.
- **Plosive allophony** (Dravidian): க/ட/த/ப are voiceless word-initially, geminated (Cː), and after a
  voiceless obstruent; VOICED elsewhere — intervocalic and after any sonorant (மகன்→mɐɡɐn, தம்பி→t̪ɐmbɪ,
  அவர்கள்→aʋɐrɡɐɭ). ச is the exception: voiceless t͡ɕ between vowels, d͡ʒ only after a nasal. ற never voices;
  ற is a voiceless-blocker (ற்ப→rp) unlike the sonorant ர (ர்க→rɡ). Coda ட voices (நாட்கள்→n̪aːɖkɐɭ); a
  word-final bare stop voices (proclitic sandhi இந்தப்→ɪn̪d̪ɐb).
- **Stress**: primary `ˈ` on syllable 1; secondary `ˌ` on even nucleus indices (2, 4, 6…) EXCEPT the last —
  so 1–3-syllable words carry only the primary, 4+ get ˌ on syllables 3, 5, 7…

## Engine (shared abugida core + Tamil post-pass)
The systematic abugida parsing (consonant + inherent/sign vowel, virama clusters, independent vowels, nukta) is
handled by the SHARED `core/abugida.ts` interpreter driven by `tamil.jsonc` — the SAME engine Hindi uses (the
`~80-line` declarative core is portable to C# by loading the same data file). Tamil-specifics are layered on top
in `tamil.ts` as a post-pass over the core's phoneme string: segment into phoneme units, resolve geminates
(Cː; ற்ற→ʈr, ற்ச→t͡ɕː) and the voicing allophony above (the ற/ர contrast survives because they are distinct
phonemes `r`/`ɾ` in the string), then place the two-level stress. No lexicon. (Originally a bespoke parser;
refactored onto the shared core — same result, +79 words from the core's more robust cluster handling.)

## Validation
vs the portable-espeak canonical gold (50k Tamil-script words): **exact 88.7%** (stress-only diff 0 after
the secondary-stress rule). The residual (~11%) is loanword/lexical, unreachable without a dictionary:
- Sanskrit-loan initial voicing (தேசிய→d̪eːt͡ɕɪjɐ, காந்தி→ɡaːn̪d̪ɪ) — word-initial க/த voiced in specific loans;
- `Cir/Cur` syncope (பிரதமர்→pɾɐd̪ɐmɐr — the short i drops to a Cr cluster) in Sanskrit-shaped words;
- unstressed long-vowel reduction (சமூக→t͡ɕɐmʊɡɐ, ~415 words) and a few voiced geminates in loans (மத்திய→d̪ː).
These are lexically conditioned; a rule-based engine hits its ceiling here.

## Numbers
Basic cardinal compositor (numbers.ts): units/tens lexicalised, hundreds + ஆயிரம்/லட்சம்/கோடி (Indian
grouping). Approximate for hundreds compounds (இருநூறு etc.); covers the common range.

## Run 1 — abugida engine — 2026-07-12
Built g2p.ts (script parse + allophony + two-level stress) + numbers + tamil.ts; registered `ta`. Iterated the
allophony against the gold: fixed the intervocalic test (abugida stops carry their OWN vowel), independent
அ→a, ஐ→aᶦ, coda ர→r, ஜ→d͡ʒ, and derived the secondary-stress pattern statistically (even nuclei except the
last). 24%→88.7% exact. Residual is loanword-lexical.
