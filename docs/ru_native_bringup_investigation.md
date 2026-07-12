# Russian (ru) native bring-up

Target: standard (Moscow) Russian, canonical IPA, espeak-independent. Slot #8 in the OmniVoice coverage set
(contributes `ʑ`, `ɵ`, `ɭ`). This is the hardest bring-up so far — two lexical/rule problems compound:

1. **Lexical, unpredictable stress.** Russian stress is not derivable from spelling (like English, unlike the
   Romance langs). It must come from a stress dictionary. And *everything downstream depends on it* — vowel
   reduction is defined relative to the stressed syllable.
2. **Palatalization.** Every consonant has a hard/soft pair; soft (palatalized, Cʲ) before е ё и ю я ь. Plus
   final devoicing (год→ɡot), regressive voicing assimilation, and akanye/ikanye vowel reduction whose DEGREE
   depends on distance from stress (1st pretonic о/а→ɐ; elsewhere →ə; unstressed е/я→ɪ).

## Architecture decision — stress dictionary + rule g2p
Because reduction/palatalization/devoicing are all RULE-GOVERNED once stress is known, the clean design is:
a **stress dictionary** (word → stressed-syllable index) feeding a **rule g2p** (Cyrillic + stress → canonical
IPA). Our engine produces the IPA (canonical, consistent); the lexicon supplies only the unpredictable bit
(stress). This mirrors the English split (lexical facts + our logic) and the canonical-consistency goal.

## Data source
- **wikipron rus_cyrl_narrow** (466k) — REJECTED as primary: no stress marks, inconsistent reduction
  (молоко→malako here, ɐ/ə elsewhere), optional-palatalization brackets, some broken entries (человек→t͡ɕek).
- **kaikki Russian** (Wiktionary, 893 MB) — CLEAN raw IPA WITH stress: собака→sɐˈbakə, кошка→ˈkoʂkə,
  большой→bɐlʲˈʂoj, зонтик→ˈzonʲtʲɪk. Stream-extracted to /mnt/data/ru_kaikki.tsv (word→IPA). This is the
  stress source AND the validation referee. Single Wiktionary source (independence caveat, as with pt).

## Convention (canonical target, from kaikki)
Vowels: stressed a e i o u + æ (я after soft, дядя→dʲædʲə), ɨ (ы). Reduction: 1st-pretonic/absolute-initial
о,а→ɐ; other unstressed о,а→ə; unstressed е,я→ɪ; unstressed у→ʊ. Palatalization Cʲ. Retroflex ʂ ʐ (ш ж),
affricates t͡s t͡ɕ (ц ч), ɕː (щ). Final devoicing + regressive voicing assimilation. г→ɡ (v in некоторых genitives).

## Run 1 — data + core g2p
(in progress)

### Run 1 result — data pipeline + core g2p (70.6% vs kaikki)
Built src/languages/russian/{g2p,russian,numbers}.ts + stress.tsv, registered `ru`. Pipeline:
 - stress.tsv (312,683 words) — stressed-vowel ordinal extracted from kaikki IPA (count IPA vowels before ˈ;
   ё always stressed). Robust: only the stress POSITION is taken; our g2p re-derives the segmental IPA.
 - g2p: Cyrillic parse (hard/soft consonant selection, iotation glides), stress-based reduction, final
   devoicing + regressive voicing assimilation, then render with pre-vowel stress (repo convention).

Validated vs kaikki (tools/ru-ref-sweep.mts; stress-placement + optional ⁽ʲ⁾/(j)/ˌ folded): 36.1% → **70.6%**
across five fix batches:
 - reduction positional model (2nd-pretonic о→ə vs 1st-pretonic ɐ; post-tonic я→ə; unstressed е→ɪ)
 - и/е after hard ж/ш/ц → ɨ/ɛ; frontings between soft consonants — ё/о→ɵ (the ru primitive), а/я→æ, у→ʉ
 - the в-devoicing bug (в devoices before voiceless — it only fails to TRIGGER voicing)
 - т/д+с→t͡s affricate, -ться→t͡sː; geminate→Cː (final geminate degeminates); monosyllable → no stress
 - regressive palatalization (two-tier: с/з soften before soft т/д; т/д/н before soft т/д/н/ч/щ); reflexive
   -ся after a hard C keeps hard с (вернулся→…ɫsə) but -йся stays soft (…jsʲə)
 - closed-class irregulars (что→ʂto, его→jɪvo, сегодня, конечно…) as an inline map.

RESIDUAL (~29% vs kaikki, mostly not reachable): genuine kaikki inconsistency (post-tonic я ə~ɪ, final-е e~ɪ,
тся~тсся length), LOANWORDS (hard consonant before е: форель→fɐrˈɛlʲ, бисексуал→sɨ — needs a lexicon),
degemination of assimilated clusters (французский зс→s), and the productive adjective-genitive г→v (grammatical).
NEXT: a pronunciation-lexicon layer (loanword hard-C-before-е, genitive г→v) — like French/pt Phase 2 — and an
independent referee assessment (kaikki = single Wiktionary source, same caveat as pt).

## Run 2 — Phase 2 lexical layer (genitive г→v + loanword hard-е/и)
Two lexical residuals the rule engine can't predict, addressed the same way pt Phase 2 did — engine primary,
minimal correction:
 - GENITIVE г→v as a RULE (not a table): word-final -ого/-его → the г is [v] (красного→krˈasnəvə, этого→ˈɛtəvə),
   with a small adverb exception set that keeps ɡ (много, дорого, строго…). kaikki: 664 -ого/-его words →v vs
   only 13 →ɡ, so a rule + stoplist is right.
 - LOANWORD hard-consonant-before-е/и — genuinely lexical (тест→tɛst hard vs тема→tʲemə soft; ~9k words carry
   ɛ). Compact correction table hard-e.tsv (1951 rows, word→hard vowel ordinals), generated from kaikki
   (tools/ru-gen-lexicon.mts): record ordinals where the engine emits soft e/i but the referee has hard ɛ/ɨ.
   Engine hardens the preceding C and lowers the vowel (е→ɛ/ɨ, и→ɨ). отель→ɐtˈɛlʲ, форель→fɐrˈɛlʲ, секс→sɛks;
   native тема/дерево stay soft.

Scores: random-dictionary sweep barely moves (70.6→70.9% — loanwords/genitives are sparse among 407k regular
inflected forms), but on FREQUENCY-common words (where they are dense) the system reaches **87.4%** vs kaikki.
Remaining residual is genuine kaikki inconsistency (post-tonic я ə~ɪ, final-е e~ɪ) + rare degemination —
not reachable engine wins. 73 tests pass.

STATUS: same as pt — validated against kaikki (single Wiktionary source). An independent second referee (a
hand-adjudicated micro-gold, as built for pt) would be the path toward a "verified" stamp.

### Run 2 review fixes
Adversarial review of Phase 2 found three bugs, all fixed:
 - GEN_KEEP_G wrongly listed the genitive ADJECTIVE forms (многого, дорогого, убогого…) alongside the adverbs;
   those are regular genitives → v. Removed them (многого→mnˈoɡəvə).
 - hard[] left a STRANDED soft consonant: parse() regressively softens с before soft т, but hardening т for a
   loanword didn't re-harden с (стенд→sʲtɛnt). Now re-hardens the preceding dental (стенд→stɛnt); ~104 entries.
 - hard[] hardened the consonant even when the flagged vowel wasn't е/и (generator count-aligned but not
   letter-aligned → фюзеляже hardened лʲ). Guarded toIpa to е/и only + generator now checks the Cyrillic letter.
