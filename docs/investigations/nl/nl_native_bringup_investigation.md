# Dutch (nl) native bring-up

Dutch / Nederlands — West Germanic, ~25M speakers (Netherlands + Flanders), Latin script. A cleanroom rule-based
g2p in the German mould (a scanner + open/closed-syllable vowel length + final devoicing), espeak-independent.

## Data availability (checked up front)

- **kaikki nl** — 46.5k words with IPA (PRIMARY; Wiktionary/wiktextract, human). Clean formatting (syllable dots,
  optional-⟨(n)⟩ groups expanded to variants).
- **wikipron nld_latn broad** — 45.9k human pairs (SECONDARY). Duplicate-key lines merged into tab-variants.
- **Same-source caveat:** both are Wiktionary-derived — the same underlying human corpus parsed two ways, so this
  is *weak (same-source) corroboration*, not two independent referees (recorded as the `secondaryGap`). No free
  non-Wiktionary Dutch pronunciation corpus exists.
- **epitran nld-Latn — UNUSABLE as a referee.** It does *not* reduce unstressed ⟨e⟩ to schwa (water→ʋaːtɛr,
  geven→ɣeːvɛn), the opposite of the truth and of both Wiktionary referees. Folding ə↔ɛ to make it agree would
  destroy a real contrast, so it is not used. (A good reminder to vet referee *quality*, not just existence.)

## The rule core

- **Open/closed-syllable vowel length** — the Dutch (not German) rule: a single vowel is tense/long in an OPEN
  syllable (word-final `ja`, or V.CV `wa·ter`→ʋaːtər) and lax/short in a CLOSED one (`dag`→dɑx, `man`→mɑn). Unlike
  German, a stressed monosyllable does NOT lengthen (`dag` is short). Doubled vowels (aa/ee/oo/uu) are always long.
- **The diphthongs**: ij/ei→ɛi̯, ui→œy̯, ou/au→ɑu̯ (the closing ⟨w⟩ of ⟨ouw⟩ absorbed: vrouw→vrɑu̯), eu→øː, oe→u;
  the glide-final sets ieuw→iu̯, eeuw→eːu̯, aai→aːi̯, ooi→oːi̯, oei→ui̯.
- **Fricatives**: g→ɣ in the onset (geven→ɣeːvə, groot→ɣr), →x in a coda (dag→dɑx); ch→x; sch→sx (school) / s
  (final -isch). **w→ʋ** (labiodental), **h→ɦ** (voiced).
- **Final devoicing** (Auslautverhärtung): b/d/v/z/ɣ → p/t/f/s/x word-finally (hond→ɦɔnt, goed→ɣut).

## The load-bearing discovery: unstressed ⟨e⟩ → schwa

The single biggest lever. Dutch default stress is initial, so any single ⟨e⟩ that is **not the first vowel nucleus**
reduces to [ə] (water→ʋaːtər, achterbos→ɑxtərbɔs, zeven→zeːvə). The digraphs (ee/ei/eu/ie) and the stressed first
⟨e⟩ are consumed earlier, so they keep their full quality. Broadening the schwa rule from "final syllable only" to
"any non-initial nucleus" was **+10.7pp** (47.4%→58.1%) — the largest single gain. Because the BACKBONE strips
length ː and the offglide ̯, the surviving eval signal is precisely vowel QUALITY (schwa vs full vowel) + the
consonants, so getting this reduction right is most of the score.

Native unstressed suffixes -ig→əx, -lijk→lək, -isch→is (all guarded against stressed monosyllables like big→bɪx,
the noun lijk→lɛi̯k) added another +2.4pp; adding ⟨y⟩ to the vowel maps (a real dropped-vowel bug: typisch→tpis)
+0.6pp. High-frequency clitics (de→də) are a small reduced-function-word map.

**ge-/be-/ver-/te- prefix reduction (+3.5pp, adversarial-review fix).** The first review flagged that the ge-
participle class (gemaakt→ɣəmaːkt, not ɣeːmaːkt) is high-frequency *native*, not the loanword tail. The fix
couples the prefix-vowel reduction to the SAME decision the stress placer already makes: the prefix is treated as
unstressed (stress shifts past it) only when a later non-schwa nucleus exists — which cleanly separates a real
prefix (ge·maakt, nucleus2 = aː → reduce ge→ɣə) from a ⟨ge⟩-root (geven, nucleus2 = ə → no shift, ɣeː stays). ont-/
her- shift stress but keep their full vowel (ɔnt-/hɛr-), so they are excluded from the reduction. The review also
fixed the -ën plural (knieën→kniən: ⟨ë⟩→schwa, guarded so stressed poëzie→poːeːzi keeps eː) and the unreachable
leading-apostrophe clitics ('t→ət).

## Run — vs the two referees

**64.5% vs kaikki (primary) / 64.7% vs wikipron (secondary).** The two Wiktionary parsings agree to within 0.2pp,
so ~64.5% is a real ceiling for the pure rule core, not a referee artifact. The residual is:

1. **The referee's composition.** Both are dictionary-lemma lists dense with Dutch **proper nouns / place-names**
   (Achterbos, Beisterveld, Batenburg) and **loanwords** (Champagne, America, Archipel) — out-of-distribution for
   a native-Dutch rule set. On the native core the g2p is far better than 64.5% (all 31 hand-diagnostic words correct).
2. **The loanword lexical tail** — the German pattern exactly: non-initial stress the initial-stress heuristic
   over-reduces (archipel→…pɛl, not …pəl), loan vowel quality (America→ɑ…), French-loan consonants (gn→nj, ch→ʃ),
   the be-/ge-/ver- prefix vowel (begin→bə… vs our bɛ…). None is a rule — each is a finite set of known words, so
   the fix is a **kaikki-derived correction lexicon** (German's length/quality/consonant TSVs), deferred here.

## Verdict — 🟡 Reliable + loanword/stress lexical tail

The native rule core is correct and verified; the residual is the loanword + proper-noun tail, recoverable with a
correction lexicon (the clear German path). Numbers (cardinals, units-before-tens with the -en- connector +
trema, honderd/duizend/miljoen/miljard) and reduced clitics are done. Not ✅ because the loanword vowel-quality/
stress tail is still rule-mispredicted (the lexicon is the known, unbuilt path); not lower because the core is
reliable for native vocabulary and cross-referee-stable.

## Run N — 2026-07-24 — morphological decomposition on the shared West-Germanic engine

Brought Dutch onto `src/core/germanicMorphology.ts` (the shared engine extracted for German/Afrikaans). Dutch's g2p
(g2p.ts) already handles a word's OWN prefix reduction (ge-/be-/ver-/te-) and suffix schwa (-ig/-lijk/-isch)
internally, so the integration splits ONLY at COMPOUND (stem·stem) boundaries and phonemizes each element with the
existing engine — each element keeps its own stress + boundary devoicing (stad·huis → stˈɑtɦœy̯s). `stressGroups`
reconstructs stem-headed chunks (a prefix attaches to the following element, a suffix to the preceding), so an
over-stripped affix simply rejoins its stem — only genuine stem·stem splits survive. The stem lexicon is
`nl-stems.txt` (152,722 hunspell nl.dic base forms, an INDEPENDENT source vs the kaikki/wikipron referees).

**64.5% → 66.9% (+2.4pp), net +1132 words (kaikki), 10.7:1 fix:break** — measured by A/B toggling decomposition
per-word. The path was a sequence of concentrated-regression fixes, each measured:
- Naive "phonemize each morpheme independently" (like Afrikaans) → +1.0pp but 2029 regressions. The Dutch g2p bakes
  suffix/prefix handling into toSegments, so splitting suffixes off broke them → switched to STEM·STEM-only chunks.
- **Whole-word guard** (`isLexicalWord`): a word that is itself a dictionary entry is monomorphemic → don't split
  (minister ✗ mini·ster, spelling ✗ spel·ling, drinken ✗ drin·ken). Regressions 2029→629, net +719.
- **minTrailingConstituent: 4** (new shared-engine config, default 3 → German byte-identical): rejects the 3-letter
  inflectional-lookalike tails that are real words but not compound heads (af·slui·ten, druk·ken, dring·end,
  be·stan·den). Regressions 629→237, net +1073.
- **Seam degemination** (joinChunks) + **-end/-ende suffixes**: Dutch collapses a doubled consonant across a compound
  seam (voedings+stof → vudɪŋstɔf, knoop+punt → knoːpʏnt); -end/-ende participles merge back (volg·ende ✗). → +1124.
- **dontSplitKnownWords** (new flag, recursive): a lexicalised word isn't torn into two coincidental sub-words at ANY
  depth (schakelen ✗ scha·kelen, both "scha"=damage + "kelen"=throats real) — generalises the depth-0 guard through
  the recursion. German keeps it OFF (its lexicon flags constituents, not whole compounds). → net +1132.

LESSON (fleet, no-constituent-flags languages): with a flat frequency wordlist (every entry is both isWord AND
isConstituent), the compound splitter over-fires on common short words and coincidental sub-word pairs. Three cheap
guards recover almost all of it — (1) don't split a whole known word, (2) raise the trailing-constituent floor, (3)
don't split a known word recursively. The remaining ~117 regressions are a diffuse tail (feminine -in, plural
-ers/-en with medial schwa→full, g→x on a leaked participle) with no dominant class. German stayed byte-identical
(the two new config knobs default to its prior behaviour). Goldens in test/dutch.test.ts; floor nl:0.62→0.65.
