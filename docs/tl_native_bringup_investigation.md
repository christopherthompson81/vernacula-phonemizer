# Tagalog / Filipino (tl) native bring-up — investigation log

Tagalog — a shallow, near-phonemic Latin orthography → rule-based transliterator (tagalog.jsonc + tagalog.ts).
No wikipron tgl exists; referees are epitran tgl-Latn (INDEPENDENT, programmatic) + a 20-word adjudicated gold.

## Run 1 — 2026-07-15 — rule-based g2p + glottal stops → 🟡 (epitran 89%, gold 100%)

Built the module: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ, ll→lj, ts→t͡s) then single letters (c/q→k, j→d͡ʒ, r→ɾ,
y→j, …), the 5-vowel a e i o u, whole-word irregulars (mga→maŋa, ng→naŋ — given as orthographic respellings
manga/nang the g2p scans), penultimate stress, and compositional numbers.

GLOTTAL STOPS (the distinctive part): Tagalog ʔ is phonemic but mostly UNWRITTEN. Implemented the predictable
positions:
- word-INITIAL before a vowel (araw→ʔaɾaw, umaga→ʔumaɡa),
- INTERVOCALIC in vowel hiatus (tao→taʔo, maaari→maʔaʔaɾi, oo→ʔoʔo) — between two vowel LETTERS (the y/w glides
  are consonants, so ay/aw stay glides),
- HYPHEN → [ʔ] (pag-ibig→paɡʔibiɡ).

VALIDATION: epitran does word-initial ʔ but NOT the intervocalic ʔ, so once we added the (correct) intervocalic
rule the epitran agreement dropped 100→89% — and ALL 12 residual misses are epitran omitting the ʔ we add
(doon→doʔon, tao→taʔo, paa→paʔa …), i.e. WE beat the referee (gold-confirmed). The adjudicated common-word gold
is 100%. Status 🟡.

LEXICAL TAIL (the unwritten, lexicon-closable residual): word-FINAL glottal stops (bata 'child' [ˈbataʔ] vs bata
'robe' [ˈbata]) — not derivable from spelling; phonemic STRESS (magandá final vs default penult — the backbone
folds stress so it doesn't hit the eval, but the output is wrong on oxytones); a few Spanish-loan VV are glides,
not hiatus (Europa→ʔewropa), where the intervocalic-ʔ rule slightly over-applies. A pronunciation lexicon would
close the final-glottal + stress classes, exactly as for Indonesian's ⟨e⟩. Suite 36/36; typecheck clean.
