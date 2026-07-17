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

## Run — vs the two referees

**61.0% vs kaikki (primary) / 61.2% vs wikipron (secondary).** The two Wiktionary parsings agree to within 0.2pp,
so 61% is a real ceiling for the pure rule core, not a referee artifact. The residual is:

1. **The referee's composition.** Both are dictionary-lemma lists dense with Dutch **proper nouns / place-names**
   (Achterbos, Beisterveld, Batenburg) and **loanwords** (Champagne, America, Archipel) — out-of-distribution for
   a native-Dutch rule set. On the native core the g2p is far better than 61% (all 31 hand-diagnostic words correct).
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
