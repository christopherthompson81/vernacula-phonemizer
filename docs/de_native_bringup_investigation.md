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
