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

## Review — 2026-07-16 — a real human referee + the word-final glottal-stop closure

The bring-up doc claimed "no wikipron tgl exists" — WRONG. wikipron ships **tgl_latn_broad (25,188 HUMAN entries)**,
which CORRECTLY marks the glottal stops the crude 109-word epitran omits (tao→taʔo, araw→ʔaɾaw, and the word-final
ʔ homographs bata→bata AND bataʔ). Replaced the crude epitran primary with wikipron (epitran demoted to a
secondary). The eval uses `phonemizeWordRules` (rule-only) so it's non-circular vs a wikipron-sourced lexicon.

**Rule-only vs wikipron = 77.3%** (was "89% vs crude epitran"). The drop is HONESTY, not regression — the 25k
human set is far harder + surfaces three tails, measured:
- **Word-final glottal stop (~1421 clean, the #1 gap)** — phonemic but UNWRITTEN (bata child [bataʔ] vs robe
  [bata]), so genuinely lexical. CLOSED on the SHIPPED path by a wikipron-sourced set (`final-glottal.txt`: all
  readings end in ʔ AND the rest of our rule output already matches, so the ONLY gap is the final ʔ; 540
  homographs abstained). Shipped `phonemizeWord` appends [ʔ] for these → **shipped 82.9%** (+5.6pp); rule-only
  stays 77.3% (the eval can't see it — correctly non-circular, the Indonesian ⟨e⟩ / Gujarati schwa pattern).
- **Ambiguous loanword VV** (Spanish -ia/-ua): the referee is genuinely 3-way — glide (baniaga→banjaɡa), plain
  (alegria→aleɡɾia), or ʔ-hiatus — for the SAME spelling. A rule suppressing the hiatus-ʔ after a high vowel was
  NET-NEGATIVE (77.3→76.9%), so it's not rule-derivable; left as documented lexical/loanword residual.
- **Proper-noun/surname idiosyncrasy** — the wikipron set is Filipino-surname-heavy; those pronunciations are
  idiosyncratic (referee-limited).

The NATIVE core is excellent (gold 100%); the 77.3% reflects the lexical/loanword/proper-noun tail on a large
human referee, not the common-word quality. STATUS 🟡: the final-ʔ lexical tail is now closed on the shipped path;
phonemic STRESS (unwritten) + the ambiguous loanword VV remain.
