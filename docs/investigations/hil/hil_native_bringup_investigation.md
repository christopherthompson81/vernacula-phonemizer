# Hiligaynon (hil) native bring-up

Hiligaynon / Ilonggo (hil) — Austronesian (Malayo-Polynesian → Philippine → Western Bisayan); ~9M speakers (Panay +
Negros Occidental, the Western Visayas). Latin, near-phonemic. Sibling of the done Cebuano (`ceb`) and Tagalog
(`tl`).

## Gate — two human referees

- **wikipron hil_latn broad** (PRIMARY, human, 465) — but PROPER-NOUN-HEAVY (place/family names: Bacolod, Bermejo,
  Castronuevo), so it stresses the SPANISH-LOAN orthography.
- **kaikki hil** (SECONDARY, human, 477) — NATIVE vocabulary (daan→daʔan, mango→maŋoʔ, anak→ʔanak), which behaves
  exactly like Cebuano.

Two complementary human referees → a real bespoke bring-up (epitran has no hil-Latn map).

## The engine — Cebuano core + Spanish-loan deltas

Measuring the Cebuano g2p directly against the hil referee gave **91.8%** — close, but with systematic Spanish-loan
deltas. So Hiligaynon reuses the Cebuano/Tagalog pattern (a shallow rule g2p reading `hiligaynon.jsonc`): the
trigraphs ⟨gui/gue/qui/que⟩ + digraph ⟨ng⟩→ŋ, then single letters, with a **word-initial + hiatus glottal stop**
[ʔ] (anak→ʔanak, daan→daʔan) and **penultimate stress** (phonemic, unwritten, folded). The two deltas from Cebuano,
read off the referee:

- **⟨j⟩→[h]** — the Spanish *jota*, not Cebuano's [d͡ʒ] (Bermejo→beɾmeho).
- **⟨f⟩→[p]** — nativised (Fuentes→puentes, Demafeliz→demapelis).

## Result

`npx tsx tools/referee-eval/eval.ts hil`:
- **wikipron (human, primary): 94.4% folded (439/465).**
- **kaikki (human, secondary): 94.1% folded (449/477).**

Folds (see `langs/hil.jsonc`): stress (unwritten penult), the unwritten word-final glottal (mango→[maŋoʔ], phonemic
but lexical → deferred), ɾ~r, the ⟨y⟩ glide j~d͡ʒ, ⟨ñ⟩ ɲ~nj, the 3-vowel lax allophones (o~ɔ, e~ɛ, u~ʊ, i~ɪ), and the
inconsistently-marked word-initial ʔ.

**The ~6% residual is genuine and documented:** the **Spanish rising diphthongs** ⟨ue/ua/ie⟩→[we/wa/je]
(Castronuevo→kastɾonwebo, Fuentes→pwentes) which our native hiatus-glottal rule renders [uʔe] — this is
**origin-ambiguous from the spelling** (native ⟨ue⟩ is a glottal hiatus, Spanish-loan ⟨ue⟩ is a rising diphthong;
no way to tell from orthography without a lexicon), plus hiatus-glottal marking variation in the referee.

## Verdict: 🟢 bounded

Two large independent human referees both ~94% folded, on a clean rule g2p. Deferred: numbers (Hiligaynon
decimal — not yet built), the lexical word-final glottal, and the origin-ambiguous Spanish rising diphthongs. Gold:
`test/hiligaynon.test.ts`. Floor `hil: 0.92`.
