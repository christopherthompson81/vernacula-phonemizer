# Abkhaz (ab) native bring-up investigation

Target: **Abkhaz** (аҧсуа бызшәа) — a NORTHWEST CAUCASIAN language, ~190k speakers (Abkhazia).
**The fleet's FIRST Northwest Caucasian language.** Abkhaz has ONE OF THE LARGEST CONSONANT
INVENTORIES in the world (~58 consonants — labialized, palatalized, pharyngealized and ejective
series) and only TWO phonemic vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). Cyrillic alphabet. Canonical IPA.

## Run 1 — referee landscape (2026-07-27)

- **wikipron `abk_cyrl_broad`**: 205 pairs, HUMAN, space-segmented. ~90 are letter/digraph DEFINITIONS
  (Џь→d͡ʒ, Гә→kʷ, …) + ~115 real words. → PRIMARY.
- **kaikki Abkhaz**: 2.4 MB dump → **979 IPA pairs** (real words). → SECONDARY (the big real-word check).
- **epitran**: none.
🔷 single-source-family (both Wiktionary) but a good size, incl. a 979-word real-word set.

## Run 2 — the consonant system

★★ **THE HALLMARK — the huge NW-Caucasian consonant inventory**, written with base letters + MODIFIER
letters: **⟨ь⟩ PALATALIZES** (гь→[c], хь→[ç]), **⟨ә⟩ LABIALIZES** (гә→[ɡʷ], шә→[ʃʷ], аҟәа→[aqʼʷa]),
**⟨'⟩ PHARYNGEALIZES** (х'→[χˤ]). ★ **THREE-WAY stops/affricates** — voiced / aspirated / ejective:
⟨г қ к⟩→[ɡ kʰ kʼ], ⟨д ҭ т⟩→[d tʰ tʼ], ⟨б ҧ п⟩→[b pʰ pʼ], ⟨ӡ ц ҵ⟩→[d͡z t͡sʰ t͡sʼ], ⟨џ ч ҷ⟩→[d͡ʐ t͡ʃʰ t͡ʃʼ];
the uvular ⟨ҟ⟩→[qʼ], the pharyngeal ⟨ҳ⟩→[ħ], the retroflexes ⟨ж ш ҽ ҿ⟩→[ʐ ʂ t͡ʂʰ t͡ʂʼ]. Only 2 vowels
⟨а⟩→[a], ⟨ы⟩→[ə]. The whole system is verified on words: аҷкәын→[at͡ʃʼkʼʷən], ажәабжь→[aʒʷabʒ],
аҭаацәа→[atʰaat͡ɕʷʰa], ахәыҷ→[aχʷət͡ʃʼ]. Implemented as a CLUSTER map (base+modifier, longest-first) +
a BASE-letter map incl. the extended/historical letters (Ԡ→lʰ, Ꚁ→dʷ, …).

## Run 3 — build + tune

Self-contained Cyrillic base+modifier scan (abkhaz.ts). First pass 67.5% (wikipron); +the extended/
historical letters (Ԡ Ԣ Ꚁ-Ꚗ, and extending TOKEN to the Cyrillic-Supplement block) + the ʍ~χʷ fold →
**84.0% folded / 93.8% symbol (wikipron)**; **55.5% folded / 89.1% symbol** on the 979-word kaikki set.

★ **The folded score is DRAGGED by real hardness, NOT segment error** (the 89-94% SYMBOL accuracy is the
truer signal): (a) the referee's OWN inconsistency — the letter-DEFINITIONS vs the WORD-transcriptions
disagree (гә→[kʷ] def vs [ɡʷ] word; хә→[ʍ] def vs [χʷ] word), plus х~χ, ə~ɨ; (b) the complex ⟨у⟩/⟨и⟩
GLIDE/vowel behaviour ([w]~[əw]~[u], [j]~[i]~[əj] — aԥсуа→apʰsəwa in the referee); (c) the numeral
suffix ⟨-ба⟩→[-pa] (a lexical [b]→[p] devoicing: фба→fpa, ҩба→ɥpa); (d) loanword transcriptions. Folds:
⟨ы⟩ ə~ɨ, ⟨а⟩ a~ɑ, ⟨х⟩ x~χ, ⟨хә⟩ ʍ~χʷ.

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — 1 real robustness bug.** The recurring CURLY APOSTROPHE ’ (U+2019): the TOKEN
admitted it but the CLUSTER/MODIFIER keys used only ASCII ' → х’а (curly) silently DROPPED the
pharyngealization (χa not χˤa). FIXED by normalizing ’→' at the top of phonemizeWord (the Guaraní puso
bug class). All else correct (the scan i-advances, TOKEN coverage incl. ⟨ԥ⟩ U+0525, NFC, wiring).

**Phonology reviewer (verified on the 979-word kaikki set) — THE THREE-WAY SERIES IS ENTIRELY CORRECT**
(the hardest, highest-risk part). One real segment error + improvements:
- ★ **гь→[c] was a VOICING error** — ⟨г⟩ is voiced [ɡ], so ⟨гь⟩ must be [ɡʲ], not the voiceless palatal
  [c]. The engine had taken the palatal-place symbols (c/cʼ/cʰ/ç) from the wikipron letter-DEFINITIONS,
  which systematically DEVOICE; the 979-word corpus uses dorsal+[ʲ] throughout (зегьы→zeɡʲə). FIXED: all
  palatalized dorsals → dorsal+ʲ (гь→ɡʲ, кь→kʼʲ, қь→kʰʲ, хь→χʲ), matching the already-correct ҟь→qʼʲ.
- ★ **⟨у⟩/⟨и⟩ glide rule** — the engine mapped у→[w]/и→[i] uniformly (asymmetric, wrong in complementary
  environments). FIXED: glide [w]/[j] next to a vowel, syllabic [u]/[i] between consonants (иҭабуп→
  itʰabup, аи→aj). ★ This + the гь fix lifted the 979-word KAIKKI set **55.5→65.5%** (+10pp) — the real
  measure. Added low-cost folds (ɛ/ɔ height, аа~aː, the palatal↔dorsal place notation for кь/қь/хь).
- CONFIRMED correct: the entire 3-way stop/affricate series (к=kʼ ejective, қ=kʰ, г=ɡ, etc.), ж/ш→ʐ/ʂ
  retroflex, гә→[ɡʷ] and хә→[χʷ] (the engine right, the referee-DEFS wrong/devoiced), the pharyngeals/
  uvulars. Noted-not-fixed (deferred): the numeral ⟨-ба⟩→[-pa] (with numbers), џ→[ɖʐ] place, ҩ→[ɥˤ]
  (referee-inconsistent).

**Final: wikipron 82.5% folded / 93.3% symbol; kaikki 65.5% / 92.5% symbol.** The output is now
phonologically correct per the review; the folded % remains depressed by the referee's own inconsistency
(defs vs words) + the complex glide/schwa + numeral behaviour (the ~92-93% SYMBOL is the truer signal).
Floor 0.78. Goldens (4 tests incl. the гь/у/и/curly-apostrophe fixes), the 154-test floor, typecheck green.

## Run 5 — 2026-07-28 18:00 — VIGESIMAL cardinal number compositor (numbers were deferred)

Question: `phonemize("<int>", "ab")` passed the digits through. Probe: 110/110 DIGIT-LEAK.

**Pattern B mandatory**, data + logic both in `src/languages/abkhaz/numbers.ts` (Abkhaz has no `.jsonc` manifest).
Abkhaz's traditional system is base-20, so the shared decimal composer cannot express it.

Source hunt: languagesandnumbers.com would not load (socket hang up, repeatedly) and en.wiktionary's Abkhaz
cardinal category has only 22 entries with no compounds. What actually settled it was **ab.wikipedia**:
- «Иԥсабаратәу ахыԥхьаӡара» (Natural number) — a complete 0–99 table + the hundreds list + the thousands list,
  cited there to Хәарцкиа Ҳ. И. & Џьонуа Б. Гь., «АУРЫС-АԤСУА, АԤСУА-АУРЫС акомпиутертә терминқәа ржәар», Аҟәа 2012.
- its per-number articles «21 (ахыԥхьаӡара)» … «99 (ахыԥхьаӡара)», which confirm the whole table word-for-word.
- its YEAR articles, which are the only source found for the compounds ABOVE 100 and were decisive: 101 шәи акы ·
  105 шәи хәба · 111 шәи жәеиза · 120 шәи ҩажәа · 135 шәи ҩажәи жәохә · 155 шәи ҩынҩажәи жәохә ·
  199 шәи ԥшьынҩажәи зеижә · 201 ҩышәи акы · 555 хәшәи ҩынҩажәи жәохә · 999 жәшәи ԥшьынҩажәи зеижә ·
  1001 зқьы акы · 1100 зқьы шәкы · 1101 зқьы шәи акы · 1234 зқьы ҩышәи ҩажәи жәиԥшь · 1500 зқьы хәшә ·
  1900 зқьы жәшәы · 1989 зқьы жәшәи ԥшьынҩажәи жәба · 2001 ҩнызқь акы · 2020 ҩнызқь ҩажәа.
- «Аноль» for zero: «0 (аноль; алаҭ. nullus — акгьы)».

★ Structure recovered from that evidence. Scores: 20 ҩажәа, 40 ҩынҩажәа (2×20), 60 хынҩажәа, 80 ԥшьынҩажәа; a
non-final score takes the **-и connective** (final -а → -и) + a SPACE + the plain 1–19 word (30 = ҩажәи жәаба,
99 = ԥшьынҩажәи зеижә). The same -и marks a non-final HUNDRED (шәкы → шәи акы; ҩышә → ҩышәи акы) but the thousand
does NOT (1001 зқьы акы, 2001 ҩнызқь акы) — that asymmetry is only visible in the year articles. Thousands are
**fused** for a multiplier of 1–10 (зқьы, ҩнызқь … жәанызқь) and for exactly 100 (шәнызқь); any other multiplier
is spelled out + the separate word нызқь (20 000 ҩажәа нызқь).

★ **Citation form / class agreement** — the judgment call the task asked to document. Abkhaz numerals agree with
the HUMAN vs NON-HUMAN class of the counted noun: the human series is built with -ҩык/-џьара (аӡәы "one person",
ҩыџьа "two people", хҩык "three people"), the non-human/abstract series is акы, ҩба, хԥа … A bare numeral in a TTS
input has NO counted noun and therefore no class to agree with, so the compositor emits the **non-human /
abstract counting series** throughout — which is also the series ab.wikipedia's own number articles use to NAME
the numbers, i.e. the form a speaker reads a bare digit string with. Human concord needs the noun → out of scope.

Other contested forms, flagged in the module: **7** is authored быжьба (year articles + Omniglot) while the
dictionary-cited table writes the syncopated бжьба — which also survives in the derived 7000 бжьнызқь, so both
stems are kept where their own source has them. **500** is authored хәышә per the dictionary-cited hundreds list,
though the 555/1500 year articles write the syncopated хәшә(и) (a bare ⟨ы⟩/∅ alternation → [ə] or nothing).
10^6/10^9 use the Russian loans миллион / миллиард (attested in running ab.wikipedia text: "140 миллион",
"750 миллион шықәса"); a count of 1 reads as the bare noun, parallel to зқьы for 1000.

Result: probe **CLEAN** across the required range; every year-article form above reproduced exactly except the
noted 500 variant. Tests in test/abkhaz.test.ts.
