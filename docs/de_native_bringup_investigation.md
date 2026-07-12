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
