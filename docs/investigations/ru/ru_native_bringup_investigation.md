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
  большой→bɐlʲˈʂoj, зонтик→ˈzonʲtʲɪk. Stream-extracted to <data root> (word→IPA). This is the
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

## Run 3 — independent adjudicated micro-gold (a 2nd referee)
Same as pt: no 2nd freely-accessible Wiktionary-independent Russian referee exists, so built one —
tools/ru-gold.tsv, 128 words HAND-TRANSCRIBED from standard Moscow Russian phonology (stress + reduction +
palatalization adjudicated from knowledge, NOT read off kaikki). Eval tools/ru-gold-eval.mts + a ≥96% vitest lock.

It immediately caught what the kaikki sweep could not:
 - STRESS-EXTRACTION BUG: the stress-dict generator's IPA vowel set was MISSING ʉ, so ʉ before the stress
   wasn't counted → любить mis-stressed (0 instead of 1). Every у-between-soft word was affected. Regenerated
   stress.tsv with ʉ → 312k → 406,679 words (the bug had also silently dropped ~94k) — большого/любить/хорошая
   all correct now.
 - ENGINE CLUSTER BUGS: тц/дц→t͡s merge (отца→ɐt͡sa, двадцать→dvat͡sətʲ), сч/зч/жч→ɕː (счастье, мужчина→mʊɕːinə),
   с/з soften before soft т ONLY not д (сделать→zdʲeɫətʲ, здесь→zdʲesʲ), н hard before щ (женщина), geminate
   softness agreement (россия→sʲː), letter а never fronts to æ (only я; счастье→ɕːasʲtʲjə), glide-final -ье→jə.
 - silent-letter irregulars солнце→sont͡sə, сердце→sʲert͡sə, сейчас, здравствуйте.

Result: adjudicated gold 84.4% → **96.9%** (124/128). Residual = genuinely-variable post-tonic я (месяц/заяц
ɪ~ə, жизнь з/н) + one lexicon gap (интернет's 1st е) — not reachable. freq-common vs kaikki 87.4→87.6%.

STATUS: ru now checked against kaikki (single Wiktionary referee) AND an independent hand-adjudicated micro-gold
(96.9%). Same bar as pt — the micro-gold gives real independent signal and confirms the engine + stress dict.

## Run 4 — "are we done?" re-examination (found real reachable wins)
Prompted by the residual question. Checked the disputed cases against kaikki and found the Run-3 micro-gold had
a few of MY OWN transcription errors, which I'd overfit — regressing the broad sweep. Corrected:
 - REVERTED three gold-driven changes that were wrong: а DOES front to æ between soft (счастье→ɕːæsʲtʲje,
   просвещать→ɕːætʲ); glide-final -ье → je not jə; с/з DO soften before soft д (сделать→zʲdʲeɫətʲ, ездил→zʲdʲ,
   здесь→zʲdʲesʲ — all confirmed soft in kaikki, my gold was hard). Fixed the gold entries too.
 - NEW reachable rule: degemination of a SIBILANT assimilated across a morpheme (французский зс→s single), while
   written doubles and voicing-assimilated stops stay long (русский→sː, отдых→odːɨx).
Result: sweep 86.4→**87.8%**, freq-common 87.6→**90.3%**, gold back to 96.9% (now with CORRECT transcriptions).

RESIDUAL CHARACTERIZATION (what's left, reachable vs not):
 REACHABLE (still): (1) stress-dict OOV — ~10% of top-5000 freq words aren't in the 406k dict, but most are
   monosyllables (no stress needed); the real wrong-stress class is ~2-3% and would need dict expansion or a
   stress-prediction fallback (the genuinely hard part, like English OOV). (2) loanword hard-е table gaps
   (интернет's 1st е). (3) a few small cluster rules.
 NOT REACHABLE (~half the residual): kaikki SELF-INCONSISTENCY — post-tonic я ə~ɪ (месяц/далями), final-glide-е
   e~ə, тся~тсся length; and genuinely-variable optional assimilation (жизнь з/н). The referee contradicts
   itself here, so no rule can match both sides.
CONCLUSION: the engine is near its reachable ceiling on the segmental rules (gold 96.9%); the one substantive
lever left is stress-dict COVERAGE (OOV), which is a data-expansion problem, not an engine problem.

## Run 5 — stress-dictionary OOV coverage + loanword table gaps
The residual analysis said OOV stress was the main reachable lever. Measured: 11.6% of multisyllabic top-10k
freq words are OOV, and almost NONE are in kaikki (genuinely absent). Three mechanisms, engine-side (no data
bloat):
 - Ё-RESTORATION: Russian text writes ё as е. For an OOV word with е, try restoring a ё that IS in the dict
   (еще→ещё, пришел→пришёл, придется→придётся) — ё is inherently stressed, fixing segment AND stress. Biggest,
   cleanest chunk (function words used constantly). OOV 11.6→9.7%.
 - ADJECTIVE-LEMMA INFERENCE: an OOV inflected adjective/pronoun (которые, большое, маленькая) takes its
   masculine lemma's stress ordinal (который/большой/маленький), which is stem-relative and stable across forms.
   Hard endings (-ое/-ая) reconstruct -ый/-ой (большое→большой, NOT the comparative больший); soft (-ее/-яя) →
   -ий; -ий is a last-resort fallback for velar/hushing stems (маленький→маленькая). OOV 9.7→6.5%.
 - Regenerated hard-e.tsv against the fixed 406k stress dict: 1949 → 2668 loanword rows.

Result: freq-common vs kaikki 87.6 → **90.7%** (+3.1); sweep 87.8→88.0%; gold 96.9%. Remaining multisyllabic OOV
(6.5%) is almost entirely FOREIGN PROPER NAMES (дэнни/алекс/мэри — subtitle-corpus English names, unpredictable
stress) + a few short-form participles. Those are genuinely not reachable without per-name data.

## Run 6 — foreign-name/loanword affricate дж→d͡ʐ
Prompted by asking whether the OOV foreign proper names encode CORRECT pronunciation. Finding: they largely DO
— the Cyrillic transliteration encodes the Russian-adapted reading, and our g2p reads it right (мэри→mˈɛrʲɪ hard
via э, гарри→ɡˈarʲːɪ H→Г). And the first-vowel stress default happens to be correct for most (English names are
predominantly initial-stressed: DAN-ny, MA-ry, EM-ily). The one real gap it exposed was general (not
name-specific): дж rendered as separate d+ʐ instead of the affricate d͡ʐ. Fixed дж→d͡ʐ — джинсы→d͡ʐɨnsɨ,
менеджер→mˈɛnʲɪd͡ʐɨr, джонни→d͡ʐˈonʲːɪ, поджарить→pɐd͡ʐˈarʲɪtʲ. Sweep 88.0% (kaikki over-transcribes дж as d͡ʐʐ so
the clean affricate doesn't perfectly match, but d͡ʐ is the correct canonical form), gold 96.9%, 76 tests.
