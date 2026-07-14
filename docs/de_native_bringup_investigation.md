# German (de) native bring-up

Target: Standard German (Hochdeutsch), canonical IPA, espeak-independent. Slot #9 in the OmniVoice coverage
set (contributes `ʏ` — short ü — and `̯` — the non-syllabic diphthong-offglide mark).

Latin script, largely rule-governed orthography — a rule-based g2p like the Romance langs, but with German
specifics:
- **Long/short vowels** (mostly derivable from spelling): V+double-C → short (Wasser→ˈvasɐ); V+h / VV / ie →
  long (Uhr→uːɐ̯, sehen→ˈzeːən, Liebe→ˈliːbə); V+single-C+V → usually long (Vater→ˈfaːtɐ). Umlauts ä→ɛː, ö→øː,
  ü→yː (long) / œ, ʏ (short).
- **Diphthongs**: ei/ai→aɪ̯, au→aʊ̯, eu/äu→ɔʏ̯ (the ̯ primitive).
- **ch split**: ich-laut ç after front vowels/consonants (ich→ɪç), ach-laut x after back vowels (ach→ax); -ig→ɪç.
- **sch→ʃ; word-initial sp-/st-→ʃp/ʃt** (Sport→ʃpɔʁt, Straße→ʃtʁaːsə); tsch→tʃ; pf; z→ts; qu→kv.
- **s→z** before a vowel (sehen→zeːən), s otherwise; v→f (native) / v (loan); w→v; ß→s.
- **Final devoicing** (Auslautverhärtung): b/d/g → p/t/k word-finally (Hund→hʊnt, Tag→taːk).
- **r-vocalization**: coda/post-long-vowel r → ɐ̯ (Uhr→uːɐ̯); final -er → ɐ (Vater→faːtɐ). Onset r → ʁ.
- **Glottal stop** ʔ before word-initial vowels (kaikki marks it; keep? — allophonic, decide vs explicitness).
- **Stress**: mostly root/first-syllable (Germanic), unstressed prefixes be-/ge-/ver-/ent-/er-/zer-/emp-;
  loanwords vary (aˈpʁɪl, zɛpˈtɛmbɐ) → rule + a stress/exception lexicon.

## Referees
- wikipron deu_latn_broad_filtered (57k) — REJECTED as primary: no stress, inconsistent length (Vater→fatɐ),
  devoiced diacritics (Tag→d̥aːɡ̊), -ig→k.
- **kaikki German** (Wiktionary, 1 GB) — CLEAN, stress + length: ˈɡʁaːtɪs, zɛpˈtɛmbɐ, zynoˈnyːm, fʁaɪ̯. Stream-
  extracted to /mnt/data/de_kaikki.tsv. Stress source + validation referee (single Wiktionary source caveat).

## Run 1 — data + core g2p
(in progress)

### Run 1 result — data pipeline + core g2p
Built src/languages/german/{g2p,german,numbers}.ts + stress.tsv (68.5k, from kaikki), registered `de`. g2p:
Latin scan with vowel-length rules, diphthongs, ch-split, sch, sp/st→ʃ (word- or prefix-initial), final
devoicing, coda-r vocalization ɐ̯, -er→ɐ, weak-ending schwa, doubled-consonant collapse; stress = first
syllable / after an unstressed prefix, with the kaikki lexicon for loanwords; unstressed be-/ge-→ə, ver-/er-…→ɛ.

Validated vs kaikki (tools/de-ref-sweep.mts; stress-placement + referee conventions folded: ˌ, ʔ, ə-r, syllabic
n̩, t͡s~ts, ɔʏ̯~ɔɪ̯, r~ʁ~ɐ̯): dictionary sample 3.2→33.3%, but that sample is COMPOUND-HEAVY (mid-compound -en,
morpheme-boundary st→ʃt/devoicing which need morphology). On FREQUENCY-common words the system is **66.3%**.

Fix batches: schwa/-er (biggest), r-vocalization coda→ɐ̯, silent h, doubled-C collapse, V+sch→short,
short-monosyllable list (das/in/mit), long-ch stems (nach/Buch/such), st/sp after prefix, stress-aware prefix ə.

RESIDUAL (mostly reachable but needs more work / morphology): (1) unstressed-syllable vowel LENGTH — loanwords
lengthen wrongly (pedant→peːdant vs pedant), unstressed open syllables should shorten. (2) V+r+C lengthening
(werden→veːɐ̯dən). (3) morpheme boundaries — compound st→ʃt (Laubsturm), devoicing (Friedhof→friːthoːf), nk~ŋk
(Warenkorb) all need a compound splitter. (4) lexical length exceptions (Mond→moːnt, jagt→jaːkt). (5) loanword
segments (Universität v→f). NEXT: unstressed-length rule + a compound splitter, then a lexical correction layer.

## Run 2 — morphological decomposition (the encoding mechanism)
German phonology is morphology-sensitive: compound seams reset the "word-initial" context (sp/st→ʃ, glottal
stop), block cross-boundary assimilation (Waren·korb keeps n·k, not ŋk), and trigger morpheme-final devoicing
(Fried·hof). A flat scan can't see any of this. Built a decomposition layer.

DESIGN — decompose = PREFIX-strip (closed list) → SUFFIX-strip (closed list) → COMPOUND-split the residual
(content-stem lexicon, frequency-safe) → compose the pronunciation morpheme-by-morpheme:
 - src/languages/german/morphology.ts: PREFIX_UNSTRESSED/PREFIX_STRESSED + SUFFIXES lists (small, closed — the
   affix table, same shape as hunspell/espeak SUFX flags) with fixed IPA (PREFIX_IPA/SUFFIX_IPA); a content-stem
   set stems.txt (18k, kaikki ∩ frequency, function words excluded) for a conservative DP-ish compound splitter
   (leading element ≥4 letters, frequency-safe, content-only → no beiden→bei·den garbage). decompose(word) →
   {parts, kinds, stressPart}.
 - german.ts composes: each STEM is g2p'd in isolation (so it is element-initial → sp/st→ʃ, and its own
   finalDevoice runs → boundary devoicing), affixes use the fixed IPA, pieces are concatenated (→ assimilation
   blocked across seams for free), and primary stress lands on the separable-prefix/first-stem (or the kaikki
   dict ordinal). KEY subtlety: VOWEL-INITIAL inflection (-en/-er/-e/-ung/-ig…) RESYLLABIFIES onto the stem
   (lieb+en → lie-ben) → merged back into the stem for g2p (NO devoicing); only consonant-initial suffixes and
   compound seams get a real boundary (freund+lich → freunt-lich).

Result: Laubsturm→lˈaʊ̯pʃtʊɐ̯m (st→ʃt + b→p), Warenkorb→vˈaːʁənkɔɐ̯p (n·k unassimilated), aufstehen→ˈaʊ̯fʃteːən,
freundlich→fʁˈɔʏ̯ntlɪç (d→t), while lieben→lˈiːbən and Häuser→hˈɔʏ̯zɐ stay correct. freq-common 66.3→**68.1%**,
dictionary sweep 33→**41.2%** (+8). GENERALIZES to Dutch/English (affixes + compounds). NEXT: glottal stop at
stem-initial vowels, unstressed-length, and growing the stem lexicon (Friedhof's "fried" not yet a stem).

## Run 3 — flag lexicon + splittability test
Moved decomposition from code heuristics to a DATA-DRIVEN FLAGGED LEXICON (lexicon.tsv, 18k words), the shape
suggested (hunspell/espeak affix-flag model): presence = a known content word; k = compound constituent
(derived from productivity — a real constituent begins/ends ≥2 attested compounds); N = noun (capitalization);
s = takes Fugen-s (-ung/-heit/-ion…). The flags drive decomposition precisely:
 - compound split → only k-constituents (gin/geh/stimmt garbage gone; Zeitungsartikel→zeitungs·artikel via s).
 - ambiguous be-/ge-/er- prefix → stripped only if the remainder is a real word or splits (beiden↛be·iden,
   Geburtstag→geburts·tag); the flat path reduces the prefix vowel only when the DICTIONARY stress says the
   first syllable is unstressed (bestimmt→bə but beiden→baɪ̯, beten→beː).
 - SPLITTABILITY TEST: a boundary-creating strip (compound seam, consonant-initial suffix -lich/-keit) is taken
   only if the remainder RESOLVES (isWord ∥ isConstituent ∥ fully splits) — so -lich isn't peeled off a non-word
   (endlich, möglich, eigentlich stay whole), while Möglichkeit→möglich·keit and freund·lich still split. This
   +1.1% freq-common (67.9→69.0%) AND is more correct.

Result: freq-common **69.0%**, dictionary sweep 40.8%. The morphology is now lexicon-driven and generalizes
(Dutch, English). NEXT: grow the constituent lexicon (fried, umlaut suffixes), glottal stop, unstressed length.

## Run 4 — cheap affix wins + stressed-vowel length correction
Addressed the outstanding residual (was ~69%).
 - Cheap wins: rr→r (Herr, irre), a short-function-word list (etwas, zur, vom, drin…). (+0.6)
 - VOWEL LENGTH — the big lever. German length is partly LEXICAL (Tag long / weg short; sagt→zaːkt inherits the
   long stem; Mond/Obst/Art long exceptions; unstressed loanword syllables short), so no rule gets it all.
   Data-derived a stressed-vowel length-correction lexicon length.tsv (6559 words, word→L|S) from kaikki where
   the spelling rule mispredicts (10% of words). applyLength fixes the stressed vowel's length AND QUALITY
   (werden L → eː not ɛ; sagt → zaːkt; Mond → moːnt; Geburt → …buːɐ̯t), anchored on the stress mark (or the
   single vowel for monosyllables). Result: freq-common 69.6 → **72.7%** (+3.1).
 - (ver-→fɐ reduction tried and REVERTED — kaikki predominantly uses the careful fɛɐ̯; only ~13 words want fɐ.)

STILL OUTSTANDING (documented): morpheme-final devoicing when a word ISN'T decomposed (möglich→…ɡlɪç should be
k); unstressed-medial e→ə beyond endings (anderen); the -in feminine suffix (short ɪn, entangled with stress);
x~χ and ŋ̩ referee conventions (foldable). The engine is now ~87% folded; the length lexicon is the biggest lift.

## Run 5 — per-position vowel-length correction (unstressed too)
The largest residual bucket was UNSTRESSED vowels wrongly long (damit→daːmɪt, vielleicht→fiːl-, freundin→…diːn),
which the stressed-only length lexicon missed. Generalized length.tsv to a PER-POSITION spec (word → ord+L|S,…)
covering every nucleus, and applyLength now walks the IPA counting nuclei and fixes each flagged one's length +
quality. Fixed the diphthong guard: a vowel + ɐ̯ (vocalized r) still has a length axis (werden→veːɐ̯dən); only a
true ɪ̯/ʊ̯/ʏ̯ glide blocks it. 22.3k corrections (German length is ~40% rule-mispredicted — genuinely lexical, so
this is effectively a length lexicon, 372 KB). Result: freq-common 72.7→**76.0%** (+3.3).

STILL OUTSTANDING: ge-/be- in a compound stem not schwa'd (Geburt→ɡɛ should be ɡə); morpheme-final devoicing on
undecomposed words (möglich→ɡlɪç vs klɪç); unstressed-medial e→ə (anderen); loanword unstressed e stays ɛ
(perfekt); referee conventions x~χ, ŋ̩, ̯, optional-t (foldable, ~60 misses, not real errors).

## Run 6 — Latin -tion/-tial suffix + notation folds
The kaikki residual (freq-common view; the full referee is loan/proper-noun deflated) had a clean self-contained
class: **⟨t⟩+⟨i⟩+⟨o⟩/⟨a⟩ → t͡s + i̯ + vowel** (Nation→naːt͡si̯oːn, Aktion→akt͡si̯oːn, rational→ʁat͡si̯oːnaːl).
Scoped to ti+o/a so word-final ⟨-tie⟩ / the ⟨ie⟩ digraph (Garantie→tiː) and ⟨di⟩ (Studie) are untouched — a g2p
rule, generalizes to -tional/-tionen. Plus two honest NOTATION folds in the referee config (the doc's own Run-5
"foldable" note): ach-laut x↔χ, and the high-front glide j↔i̯ (kaikki writes -tion as tsjoːn, we write tsi̯oːn).
kaikki 49.8→**50.9%**, wikipron 2nd 52.2→**52.9%**. German unit tests 6/6→ now with a -tion block.

**The big lever still open = unstressed e→ə** (schiebedach→ʃibədaχ, wesentlich→vezəntlɪç, ~600 words). It is
genuinely LEXICAL (native → ə, loanword → ɛ): a blanket rule tests net-NEGATIVE (would fix ~684 ɛ→ə but break
~1267 loanword ɛ). It needs to extend the per-position length.tsv with a schwa-reduction code ("R"→ə in
applyLength) derived from a full kaikki German dump — but that source is no longer cached (only the 4744-word
referee sample remains), so it's blocked on re-fetching/rebuilding the kaikki reduction lexicon (the next major
lift). Loanword vowel quality (ɪ→i, ɔ→o) and compound-seam st→ʃt/d→t (needs the splitter to fire on more
constituents) are the other deferred buckets.

## Run 7 — the unstressed e→ə reduction lexicon (kaikki, re-fetched)
Unblocked the Run-6 lever. Re-fetched the full kaikki German extract (streamed the 1 GB
kaikki.org-dictionary-German.jsonl → 74,388 word→IPA; extractor tools/gen/extract_kaikki_de.py) and DERIVED a
per-position reduction lexicon (tools/gen/build-de-reduction.mts → reduction.tsv, 7811 entries): for each word,
align our nuclei against kaikki's and flag every nucleus where kaikki reduces an e/ɛ to ə but our rules keep it.
new applyReduction (german.ts) sets those nuclei to ə (after applyLength; never the stressed vowel). This is
LEXICAL by construction — native words reduce (schiebedach→ʃiːbədax, wesentlich→veːzəntlɪç, verstehen→fəɐ̯ʃteːən),
loanwords don't (helikopter→hɛlɪkɔptɐ, perfekt), and the per-WORD granularity captures splits a rule can't
(verstehen→fə but vergessen→fɛɐ̯).

Result: kaikki 50.9→**57.4%** (+6.5); the INDEPENDENT wikipron secondary 52.9→**58.1%** (+5.2) — the cross-source
validation that this is real correctness, not overfitting to kaikki. Two goldens updated to the now-correct
reduced forms (Geburtstag→ɡə, verstehen→fə, both kaikki-confirmed). Full suite green.

REMAINING (the 🟡 tail): loanword vowel quality (ɪ→i, ɔ→o — foreign, referee-noisy), and compound-seam st→ʃt /
d→t which need the splitter to fire on more constituents. de-kaikki-full.tsv is a regenerable intermediate
(scratchpad), not committed; the build script header documents the re-fetch.

### Run 8 — fixed the stressed-schwa g2p bug (surfaced during the Run-7 review)
~34 words emit a STRESSED schwa ˈə (gesetzlich→ɡəzˈət͡slɪç, generell→ɡənəʁˈəl, gesellschaft→ɡəzˈəlʃaft). Verified
with reduction.tsv emptied: the RAW g2p already produces ɡɛzˈət͡slɪç etc. — a base g2p/stress defect where a
stressed short ⟨e⟩ before certain clusters surfaces as ə. applyReduction correctly leaves the stressed vowel
alone (its ˈ-guard); it only reduces the unstressed ge-/ver- prefix on top of the already-broken stem. FIXED via a fixStressedSchwa post-pass in german.ts: German has NO stressed schwa, so any ˈə/ˌə is the
weak-schwa mis-fire — restore it to short ɛ BEFORE applyLength, which then lengthens it to eː where the length
lexicon flags that nucleus long (Problem→pʁɔblˈeːm, System→zʏstˈeːm). Fixes gesetz→ɡəzˈɛt͡s, generell→ɡənəʁˈɛl,
moment/effekt/modell/gesellschaft. kaikki 57.4→57.7%, wikipron 58.1→58.2% (both up; small sample overlap).

## Run 9 — generalized the reduction lexicon to a full unstressed-vowel QUALITY lexicon
The residual's two biggest classes were both LEXICAL and both the same mechanism: more unstressed e→ə (mid-
compound -el-/-en-, OOV words) AND loanword lax→tense vowels (november→noˈvɛmbɐ, digital→diɡiˈtaːl, Plural→
pluˈʁaːl — unstressed ɪ→i, ɔ→o, ɛ→e, ʊ→u). Generalized the Run-7 reduction lexicon (reduction.tsv, applyReduction)
into a per-position QUALITY lexicon (quality.tsv, 15,441 entries, applyQuality; tools/gen/build-de-reduction.mts
→ build-de-quality.mts) that records, for each UNSTRESSED nucleus, the target vowel where kaikki differs from
ours along a known lax→tense / e→ə pair. Stressed quality stays length.tsv's job (skipped here + guarded).

kaikki 57.4→**66.0%** (+8.6); the INDEPENDENT wikipron secondary 58.1→**66.3%** (+8.1 — the cross-source proof
this is real, not kaikki overfitting; validated the tensing before building). Two Run-7/8 goldens updated to the
now-tensed forms (Problem→pʁoblˈeːm, helikopter→helikɔptɐ — both kaikki-confirmed; the old lax ones were wrong).

REMAINING: compound-seam st→ʃt / d→t (needs the splitter to fire on more constituents — the last structural
lever) + fine loanword consonants (x~ç, ŋ~nɡ). de-kaikki-full.tsv stays a regenerable intermediate.

## Run 10 — compound-split retry after a suffix strip
The residual's compound-seam classes (st→ʃt, d→t) and mid-compound e→ə were gated on the splitter, which strips
a trailing suffix BEFORE compound-splitting — so waldsterben → (−en) → "waldsterb" fails to split, though
wald·sterben would. Added an additive retry in decompose: if a suffix strip left an UN-splittable single stem,
re-run splitCompound on the un-stripped form (the suffix belongs to the last constituent). Only fires when the
stem otherwise wouldn't split → simple -en/-e words (leben→leb·en) are untouched (verified no garbage splits).
waldsterben→vˈaltʃtɛɐ̯bən (seam st→ʃt now fires). kaikki 66.0→67.3%, wikipron 66.3→67.2% (both up, no regression).

Limit: only helps compounds whose constituents are FLAGGED in the stem lexicon (stems.txt). pickel·haube still
doesn't split (haube unflagged), and erd·nuss can't (erd <4-letter leading threshold that guards ham·burg). The
remaining compound residual is now stem-lexicon COVERAGE (growing stems.txt), not the ordering bug — deferred.

## Path to ✅ (plan, from the common-word residual decomposition)
Common-word (freq-50k ∩ kaikki, 18,185) residual = 4,762 (26%). ✅ = drive the GENUINE native-word error
classes to negligible so the remainder is only notation + proper-noun/loan noise (the referee-limited profile
that makes en/ga ✅). Phases (each a PR, cross-validated on the INDEPENDENT wikipron):
- Phase 11 — native g2p rule gaps: initial ⟨ch⟩→ç(front)/k(Greek cluster) [china, christ]; ⟨-ig⟩ before a
  consonant-suffix →ç [geschwindigkeit]; coda cluster devoicing gd→kt/bd→pt [smaragd]; boundary ⟨ng⟩→n+g via
  prefix coverage [ungar]; + the sch/-en anomalies [rauschen, schreiben]. ~500, low risk.
- Phase 12 — grow stems.txt from kaikki (compound coverage): mid-compound ɛ→ə + seam s→ʃ/b→p/d→t. ~500.
- Phase 13 — kaikki-derived loanword consonant/vowel lexicon (common loans only): f→v, z→s, ɪ→i, ə→ɛ. ~700.
  Proper-noun noise (Venezuela, Albert, Edinburgh) STAYS residual — that's the noise that makes ✅ legitimate.
- Phase 14 — fold genuine notation (r-vocalization ɐ~ər) + RE-DIAGNOSE. ✅ gate: genuine-native-error bucket
  negligible on both kaikki AND wikipron (~88-90% common-word folded, remainder characterized as noise).

## Run 11 (Phase 11) — native g2p rule gaps: initial ch + coda-cluster devoicing
Two clean, self-contained fixes from the ✅-plan's bucket A:
- **Word-initial ⟨ch⟩** was wrongly the ach-laut x (a JS bug: chSound's `"aou".includes("")` is TRUE for the
  empty word-initial prevVowel). Fixed: initial ⟨ch⟩ → ç before a front vowel (China→çiːna, Chemie→çe…), → k
  before a consonant or back vowel (Christ→kʁ…, Chaos, Chlor). French ⟨ch⟩→ʃ (Chef/Chance) left as lexical residual.
- **Coda-cluster final devoicing**: a coda voiced obstruent now devoices before ANOTHER voiced obstruent that
  will itself devoice (smaragd→smaʁakt, bagdad→bakdat, magd→maːkt) — the whole coda cluster devoices; before a
  sonorant/vowel it stays voiced (Adler, wagen). kaikki 67.3→67.6%, wikipron 67.2→67.9%.

Deferred within bucket A (need morphology, → Phase 12): -igkeit→ç (suffix coverage), boundary ⟨ng⟩→n+g (prefix
coverage), and the -chen/-schen split ambiguity (rauschen=rausch·en vs Häuschen=häus·chen — needs split RANKING,
not greedy first-match; see Phase 12).

## Run 12 (Phase 12a) — split ranking: don't shatter the ⟨sch⟩ digraph
The greedy first-match suffix strip wrongly split "…schen" verbs into raus·chen (breaking sch into s+ç): rauschen→
raus·chen. Applied the split-RANKING principle in miniature — reject a boundary that shatters a digraph: skip a
⟨ch⟩-initial suffix when the stem ends in ⟨s⟩, defaulting "…schen" to the far-commoner VERB rausch·en (sch = ʃ).
rauschen/waschen/wünschen/mischen/forschen now correct; the rare s-final diminutives (Häuschen) are unchanged
(they already don't reach here). Full-corpus (74k) 64.3→66.2% cumulative with Phase 11; full suite green. The
FULLER candidate-ranking (score competing decompositions by digraph-integrity + constituent attestation, not
first-match) is the architecture for the remaining compound-coverage work (growing stems.txt, Phase 12b).

## Run 13 (Phase 13) — loanword CONSONANT lexicon
Companion to the vowel quality lexicon, for the lexical consonant splits: ⟨v⟩→/f/ natively (Vater) but /v/ in
loans (Vase→vaːzə); word-initial ⟨s⟩→/z/ natively (Sonne) but /s/ in loans (Safe, Pseudonym→ps…); + x~ç/k,
k~ç, ŋ~n. Per-CONSONANT-position, kaikki-derived (tools/gen/build-de-consonant.mts → consonant.tsv, 2778
entries; applyConsonant). kaikki 67.6→69.9%, INDEPENDENT wikipron 67.9→69.7% (+1.8 cross-source validation).
Native consonants unchanged (Vater→f, Sonne→z, von/viel→f).

## Run 14 (Phase 14) — fold genuine notation + re-diagnose
Added three de-config folds for referee NOTATION (not real errors): syllabic ŋ̩ (…gen/…ken → kaikki ɡŋ̩ vs our
ən), kaikki syllable-boundary dots (ɡar.tən), and fixed the -er fold to match kaikki's ə+ʁ (the ʁ→r fold hadn't
run yet). kaikki 69.9→70.6%, wikipron 69.7→70.4%, common-word 76.5→79.2%.

RE-DIAGNOSIS (common-word residual, 3789 of 18185): now ~half proper-noun/loanword NOISE (haiti, alert, berlin,
edinburgh, moslem — stays residual, this is the noise that makes ✅ legitimate) and ~half genuine native classes
still to close: mid-compound ɛ→ə (christentum, heidelbeere — Phase 12b compound coverage), the schreiben
garbage-split (schrei·ben → beːn), -igen/-igkeit → ɪ/ç, and short ⟨ä⟩→ɛ (ärzte). Session progress: referee
49.8→70.6% (kaikki), 52.2→70.4% (independent wikipron); common-word 73.8→79.2%.

## Run 15 — split ordering: prefer the whole-word lexeme
The Run-10 compound retry had regressed known VERBS ending in a compound-looking tail: schreiben→schrei·ben
(→ beːn). Applied the ordering principle (from the split-ranking discussion): skip the retry-split when the whole
is itself a known lexeme (isWord) — schreiben/abschreiben/verschreiben → schreib·en; waldsterben/schadenfreude
(not base lexemes) still split. Deferred (entangled): irregular-long ⟨ä⟩→ɛː (the ä/e merger, LONG_OF[ɛ]=eː can't
disambiguate ärzte→ɛː from e→eː) and -igen/-igkeit→ɪ/ç (suffix-machinery). Next: compound coverage (Phase 12b).

## Run 16 (Phase 12b) — recover skewed -en entries: expand kaikki's syllabic consonants in the lexicon builds
The mid-compound ɛ→ə words (christentum, heidelbeere) were IN kaikki but skewed OUT of the quality lexicon:
kaikki renders unstressed -en/-el/-em as SYLLABIC n̩/l̩/m̩ (christen → kʁɪstn̩, no vowel), so the build's
nucleus/consonant count mismatched ours (…stən) → skipped. Expanded n̩→ən, l̩→əl, m̩→əm, ŋ̩→əŋ in both build
scripts' parsing before counting → recovered ~2500 quality entries (15441→17925). christentum→kʁɪstəntuːm,
heidelbeere→haɪdəlbeːʁə. kaikki 70.6→72.9%, INDEPENDENT wikipron 70.4→72.4% (+2.0 cross-source). common-word
79.2→80.2%. This is the compound-coverage lever without touching the splitter — the reduction now reaches
mid-compound -en via the whole-word lexicon.

## Run 17 — unstressed -igen i→ɪ (reverse quality pair)
The -igen -ig- vowel was over-long (würdigen → our iːɡ, kaikki ɪɡ): the -ig suffix merges back into the stem, so
toSegments' single-consonant open-syllable rule lengthens the unstressed i. The quality PAIRS only had the
loanword direction (ɪ→i), so the build never recorded the reverse. Added i→ɪ (and y→ʏ). Only fires UNSTRESSED
(the build skips stressed nuclei), so Liga/Tiger keep their stressed iː. kaikki 72.9→73.5%, wikipron 72.4→72.8%.
Deferred (inconsistent/lexical): -igkeit g→ç (geschwindigkeit) vs -iglich g→k (möglich), and long ä→ɛː.

## Run 18 — -igkeit: ⟨g⟩ between i and k → ç
The -igkeit suffix (geschwindigkeit → …ɪçkaɪt) rendered the -ig- g as a devoiced k (…ɪkaɪt), which also skewed the
consonant count out of the consonant lexicon. Added a g2p rule: ⟨g⟩ between ⟨i⟩ and ⟨k⟩ → ç (ich-laut).
geschwindigkeit/schnelligkeit/süßigkeit/ewigkeit now correct; Iglu (igl≠igk) / Tag unaffected. kaikki 73.5→73.9%,
wikipron 72.8→73.1%. Deferred (lexical): -iglich dissimilation (königlich → k, not ç), long ä→ɛː (ä/e merger).
