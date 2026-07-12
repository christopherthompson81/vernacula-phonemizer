# French (fr) native bring-up — investigation

Sixth native language. Deep orthography (silent letters, nasals, liaison) but rule-GOVERNED in the reading
direction (unlike English). Sole census provider of ø œ ɒ ʁ ɥ.

## Approach: rule-based g2p + exception lexicon
French reading is mostly deterministic → author reading rules (vowels/nasals/digraphs/consonants/silent-finals)
+ a small exception lexicon for irregulars (monsieur, femme, ville, oignon, foreign). Validate vs wikipron fra
(97k Wiktionary gold — the strong referee). espeak-portable + epitran have quirks we diverge from:
- espeak: gn→nj (want ɲ), huit→yit (want ɥi — ɥ is a census gap!), otherwise good.
- epitran fra-Latn: WEAK — -er→əʀ (want e), keeps silent finals, ville→vij, monsieur wrong, ʀ vs ʁ. Low trust.

## Convention (from shim + wikipron, standard French)
- vowels: a e i o u→y é→e è/ê→ɛ ; nasals an/en→ɑ̃ on→ɔ̃ in/ain/ein→ɛ̃ un→œ̃
- digraphs: ou→u eau/au→o eu→ø(open)/œ(closed) oi→wa ai→ɛ/e ei→ɛ ; ch→ʃ gn→ɲ qu→k ph→f gu→g
- glides: i/u/ou before vowel → j/ɥ/w (huit→ɥi, lui→lɥi, oiseau→wazo)
- r→ʁ ; c→k/s(before e/i/y) ç→s g→ɡ/ʒ(before e/i/y) ; -ille→ij (fille) exc. ville/mille/tranquille→il
- silent: final e; final consonants mostly silent (s t d p x z; also final -er→e); careful: c r f l often kept
- ø œ ʁ ɥ ɲ ɑ̃ ɔ̃ ɛ̃ œ̃ are the distinctive phonemes.

## Referees / data
- wikipron_fra_latn_broad.tsv (97k) — PRIMARY gold. words-50000.fr.txt (freq list).
- shim canonical = secondary ref (quirks: nj, yit).

## Phase 1 complete — rule-based g2p + exception lexicon
g2p.ts: left-to-right scan — vowel multigraphs, nasal groups, eu/œu open/closed (ø/œ), o [o]/[ɔ], ai
final-ɛ/nonfinal-e, yod (aille→aj, fille→ij), glides j/ɥ/w, ti→sj, gn→ɲ, silent-final clusters (temps→tɑ̃),
geminate collapse, schwa deletion (loi des trois consonnes). french.ts: exception lexicon (monsieur, femme,
ville, Greek ch→k, counting forms) + text() with French phrase-final accent (no lexical stress) + numbers
(vigesimal 70/80/90). Registered fr.

VALIDATION vs wikipron fra (3000 most-frequent ∩ gold, tools/fr-ref-sweep.mts): 78.9% exact pure-rules.
Residual: e/ɛ convention NOISE (wikipron itself inconsistent — abaissement ɛ vs abaissable e, same stem),
plus a lexical tail (Greek ch→k, -ome/-one o vs ɔ, b/p devoicing abcès, s/z prefix exceptions) → exception
lexicon territory. 53 tests pass. espeak/epitran diverged toward the standard: ɥ glide (huit→ɥi, census gap),
ɲ (not nj), ʁ.

REMAINING (Phase 2): grow the exception lexicon (Greek/learned words, -ome), liaison + elision (cross-word,
prosodic), e/ɛ refinement, embedded-English routing. Optional: generate a fuller lexicon from wikipron.

## PR #5 review + fixes → 80.8%
Two reviewers + self-probing. 8 g2p/text bugs fixed:
1-2. word-final c/g softened to s/ʒ ("".includes("") trap) → isFront guard ; -er verb rule ate the r in
     monosyllables (mer→me) → polysyllable guard (mer→mɛʁ, manger→mɑ̃ʒe).
3. ai before nasal+vowel (laine, aime) left raw a+i → reordered ai after nasal-check + euClosed-based ɛ/e
   (with geminate-as-onset handling so abaissable→abesabl).
4. hiatus schwa after a glide phoneme (aboiement, wa) not deleted → endsVowel check (not isConsPh(ph[0])).
5. eû not recognized (jeûne) → added to eu/œu rule.
6. word-initial schwa over-deleted (petit→pti) → require a vowel before the single consonant (petit→pəti).
7. loanword tail (film, album, direct, ours) → exception lexicon.
8. empty g2p tokens → double spaces in text() → filter empties.
Reviewers verified numbers (vigesimal), accentFinal (nasal tilde intact), apostrophe words, exceptions.
Gold 78.9%→80.8%. 57 tests pass.

## Phase 2 — pronunciation LEXICON (the lexical data table)
Restructured to the English architecture: a pronunciation lexicon is the primary path, the g2p is the OOV
fallback. Lexicon = Lexique 3.83 (lexique.org; New/Pallier) → src/languages/french/lexicon.tsv, 125,343
word→IPA forms (2.6MB), SAMPA→IPA converted (@→ɑ̃ §→ɔ̃ 5→ɛ̃ 1→œ̃ 2→ø 9→œ N→ɲ R→ʁ S→ʃ Z→ʒ 8→ɥ g→ɡ). It
carries every irregular as DATA (monsieur, Greek ch→k choline→kɔlin, -ome, the whole e/ɛ distribution).
phonemizeWord: lexicon.get(word) ?? toIpa(word).

## Test corpus — FREQUENCY-based (was alphabetical)
The espeak words-50000.fr.txt is ALPHABETICAL (all ab- rare technical words: abajoue, abarticulaire) — a poor
corpus. Built /tmp/fr_freq_gold.tsv = Lexique freqfilms2-ranked words ∩ wikipron gold (top-3000 spoken-
frequent). tools/fr-ref-sweep.mts reports SYSTEM (lexicon→g2p) vs g2p-ALONE.

RESULTS (frequency corpus vs wikipron): SYSTEM 82.8% vs g2p-alone 80.1% (+2.7 from the lexicon). KEY FINDING:
the lexicon's disagreements with wikipron are almost all CONVENTION, not error — Lexique consistently uses o
in open syllables (comment kom-), retains optional schwa (maintenant mɛ̃tənɑ̃), where wikipron is
INCONSISTENT. Lexique preserves the œ census gap (4732 œ-words: seul s9l, fleur fl9R). One fixed mapping bug:
g→ɡ (Latin vs IPA script) was 101 spurious mismatches. So 82.8% vs (inconsistent) wikipron understates the
lexicon — Lexique is the more consistent canonical convention.

REMAINING (Phase 2.5): align the g2p OOV convention to Lexique (o/ɔ open-syllable, schwa retention) so unseen
words match the lexicon's convention; liaison/elision (cross-word).
