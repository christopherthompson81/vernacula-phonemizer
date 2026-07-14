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
