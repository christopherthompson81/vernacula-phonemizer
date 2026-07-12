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

## Phase 2.5 — g2p OOV convention aligned to the lexicon + liaison
Two follow-ups from Phase 2.

**(1) Align the g2p OOV to Lexique.** The g2p fallback was tuned to wikipron; unseen words therefore diverged
from the lexicon's (Lexique) convention. Re-measured g2p vs a 3000-word frequency-ranked Lexique-gold corpus
(/tmp/fr_lexique_gold.tsv) and aligned it: **73.8% → 85.8%**. Changes, each a real convention/correctness fix:
 - o → o in an OPEN syllable (comment→komɑ̃), ɔ only when a coda closes it (porte→pɔʁt); geminate/`-es` word-final
   is a coda (hommes→ɔm); obstruent+liquid before a pronounced vowel is a tautosyllabic ONSET (problème→pʁoblɛm).
 - drop the loi-des-trois-consonnes deletion — Lexique keeps the citation schwa (maintenant→mɛ̃tənɑ̃); keep only
   hiatus-schwa deletion (aboiement→abwamɑ̃).
 - final -e silent before a plural -s (choses→ʃoz); -ses (s→z) opens the syllable (choses→ʃoz not ʃɔz).
 - monosyllable detection now checks for a vowel ANYWHERE in a phoneme, so glide+vowel units (wa, ɥi, jɛ̃) count
   as nuclei — croire→kʁwaʁ (was kʁwaʁə, misread as a monosyllable → spurious final ə).
 - ai → ɛ across positions (vraiment→vʁɛmɑ̃), the Lexique convention (+0.9).
The SYSTEM vs wikipron is unchanged (82.8%) — the lexicon already covers the frequent words; g2p-alone vs
wikipron DROPS (80→75%) precisely because the OOV path now targets the lexicon convention, not wikipron. That is
the intended outcome: OOV output is now consistent with the lexicon it falls back from.

**(2) Liaison.** Obligatory function-word liaison: a latent final consonant surfaces as the onset of a following
vowel-initial word — z (les/des/nous/vous/deux…), n (un/mon/en/on…), t (est/sont/tout/petit…, grand/quand d→t),
incl. elided c'est/n'est. Attached to the NEXT word (re-syllabified: les amis → le zamˈi). Blocked across a pause
and before h aspiré (H_ASPIRE set: les héros → le eʁo). Elision (l', j', c') was already handled by the
tokenizer + lexicon. Chains correctly: les enfants ont un chien → le zɑ̃fɑ̃ ɔ̃ tœ̃ ʃjɛ̃. Remaining (not attempted):
optional/stylistic liaison, singular-noun forbidden cases, full h-aspiré lexicon — these need POS/lexical data.

### Phase 2.5 review fixes
Adversarial review of the liaison path found three concrete bugs, all fixed:
 - liaison DOUBLED a citation-realised latent consonant (cet→sɛt + t = sɛt tˈɔm). Added stripLatent: when the
   liaison fires and the word's IPA already ends in the latent consonant (z↔s/z, t↔t/d, n↔n), strip it so it
   re-attaches once as the next onset (cet homme→sɛ tˈɔm, six ans→si zˈɑ̃, dix ans→di zˈɑ̃).
 - c'est → kɛ (c before an apostrophe hit the front-vowel softening → k). Added c'→s in g2p (c'est→sɛ, c'était→setɛ).
 - H_ASPIRE was too small and missed plurals (les homards→le zomaʁ). Expanded the common h-aspiré set and match
   the singular after stripping a plural -s (les homards→le omaʁ), while h-muet still liaises (les hommes→le zˈɔm).

## Does French need English-style POS homograph disambiguation? — NO (measured)
Question raised: the ~14% "residual" looks like the English heteronym/POS problem — build a POS tagger too?
Measured against Lexique (which carries a POS column, cgram):

 - Heterophonic homographs (same spelling, ≥2 pronunciations): **78 forms, 0.06% of the lexicon**. 75/78 are
   POS-resolvable (the two readings have disjoint POS). 25 are the -ent verb(silent)/noun(ɑ̃) class.
 - But they are MASSIVELY frequency-skewed: est→e 22737 vs est→ɛst 87; plus→ply 4068 vs plys 21; as→a 3419 vs
   as(noun) 19. A most-frequent-wins lexicon already takes the dominant reading.
 - **Minority-pronunciation mass — what most-frequent-wins actually gets WRONG — is 0.035% of all tokens.** That
   is the entire homograph error ceiling. A POS tagger would recover three hundredths of a percent.
 - Lexicon token-coverage of ordinary modern prose: **100%** (127/127; OOV only proper nouns/neologisms/foreign,
   which the rule g2p serves well because French orthography is shallow).

Contrast with English: hundreds of heteronyms with BALANCED frequencies (read/read, lead/lead) → a POS tagger
buys real accuracy there. French has ~78, nearly all frequency-degenerate → it does not. The "14%" was the
lexicon-OVERRIDE rate (g2p/lexicon disagreement, lexicon wins), not an error rate; and the ~17% system-vs-
wikipron gap is dominated by cross-CONVENTION (Lexique vs wikipron on o/ɔ, e/ɛ, schwa), not by errors or
homographs. CONCLUSION: no POS tagger for French. The one POS-shaped case (-ent verb vs noun) is already
resolved in-vocabulary by Lexique's stored inflected forms (disent→diz); it would only matter for OOV verbs,
which are rare. Effective ceiling is ~99%+, and the residual is convention, not capability.
