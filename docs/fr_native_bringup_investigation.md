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
