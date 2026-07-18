# Zhuang (za) native bring-up

Tai-Kadai (Kra-Dai), Standard Zhuang / Vahcuengh (Wuming dialect basis), the 1982
Latin orthography. Cleanroom canonical-IPA rule g2p, espeak-independent — a fresh
family for the fleet. Referees: wikipron `zha_latn` broad (PRIMARY, HUMAN, 1682) +
kaikki `za` (SECONDARY, HUMAN, 1709), both Wiktionary-derived (same-source, a
breadth caveat → 🔷 single-source). The eval is SEGMENTAL: the backbone strips the
Chao tone letters (˥˦˧˨˩) + length ː, so tones + length fold.

## Run 1 — 2026-07-17 — first compile

Built the manifest (`zhuang.jsonc`) + scanner (`zhuang.ts`) from the Standard
Zhuang orthography: the pinyin-style stops (⟨b d g⟩ = unaspirated /p t k/, ⟨p t
k⟩ aspirated), implosives ⟨mb⟩→ɓ/⟨nd⟩→ɗ, fricatives ⟨s⟩→θ/⟨r⟩→ɣ/⟨c⟩→ɕ/⟨v⟩→β,
and the syllable-final tone letters (⟨z j x q h⟩ = tones 2–6, none = tone 1, a
p/t/k coda = checked). ⟨z x q j⟩ are never onsets; ⟨h⟩ is an onset before a vowel
and tone-6 otherwise.

    npx tsx tools/referee-eval/eval.ts za
    → wikipron 82.9%, kaikki 38.8% (segmental)

Two problems. Residual inspection surfaced two systematic orthographic rules I'd
missed, plus a kaikki format mismatch.

## Run 2 — 2026-07-17 — the two orthographic rules

Reading the wikipron residuals:

- **⟨e⟩ is a silent nucleus-marker after a high vowel** — cieng→[ɕiːŋ] (not
  ɕiːeŋ), suen→[θuːn], rwed→[ɣɯt]. I.e. ⟨ie⟩→[iː], ⟨ue⟩→[uː], ⟨we⟩→[ɯ]. Added to
  `vowelDigraphs`.
- **⟨ae⟩ is context-sensitive** — [ai] in an OPEN syllable (bae→[pai],
  sae→[θai], gyae→[kʲai]) but short [a] before a CODA (caet→[ɕat], haemh→[ham]).
  Handled inline in the scanner (a coda-lookahead), NOT as a fixed digraph.

Also: coda stops must be PLAIN (bak→[paːk], not paːkʰ — Zhuang codas never
aspirate; only onset p/t/k aspirate) and coda ⟨ng⟩→[ŋ] (mwngz→[mɯŋ]). Both fixed
in the scanner (a `CODA` map + a coda-⟨ng⟩ branch).

    → wikipron 97.4%

## Run 3 — 2026-07-17 — the kaikki 38.8%

kaikki was low despite confirming individual words. The residual dump showed it:
kaikki marks **syllable boundaries with a dot** (minzcuj → `min˧˩.ɕu˥`), which the
backbone doesn't strip. Added a preFold-agnostic fold `\.`→"".

    → kaikki 97.8%

## Result

- wikipron `zha_latn` broad: **97.4%** (1638/1682) — PRIMARY, HUMAN
- kaikki `za`: **97.8%** (1671/1709) — SECONDARY, HUMAN

Both Wiktionary-derived (same-source) → **🔷 single-source verified**. A clean
~97.5% with no load-bearing segmental fold (unlike Malagasy). Floor 0.94.

**Segmental only.** The eval backbone strips the Chao tone letters + length, so
the tone system — deterministic from the orthographic tone letters, rendered in
the output — is not measured here. A measured tone-accuracy check and the finer
checked-tone height split (55/35/33 by the coda + vowel length) are the
outstanding work.

Numbers: decimal, tens = unit+cib (ngeih cib = 20), hundreds/thousands multiply;
covered 0 … <10⁶, digit-by-digit above.

## Run 4 — 2026-07-17 — adversarial review → a real syllabifier (97→99.5%)

The PR review (PR #285) found a coherent cluster of scanner bugs, all rooted in
the absence of syllabification:

1. **Interior vowel-initial syllables never got [ʔ]** — the glottal was a
   word-start-only regex on the finished output. ajaeu→[ʔaː...au] (ref [ʔa.ʔau]).
2. **Cross-boundary clusters invented phonemes** — the greedy multi-letter onset
   loop consumed a coda+onset span as one complex onset: Yindu (India)→[jiːɗuː],
   *inventing* the implosive ɗ (ref [jin.tu]); denyingj→[teːɲiːŋ] inventing ɲ;
   lwgvuengz→[lɯkʷuːŋ] inventing kʷ.
3. **⟨'⟩ dropped** — the tokenizer's `[a-z]+` discarded the apostrophe, which
   Standard Zhuang uses as an explicit syllable boundary (Sih'anh, ndwen'it).

I checked the residuals against the referee before coding. wikipron has only 21
interior-ʔ words, and they split into: post-tone/coda closes (baenzaen→[pan.ʔan]),
apostrophe boundaries, and VV-hiatus (boad→[po.ʔat], ciok→[ɕi.ʔok]). The rule for
hiatus: a following **high** vowel {i,u,w} is a diphthong offglide (au→[au],
oi→[oi]); a **non-high** vowel {a,e,o} after a nucleus is a new syllable.

**First attempt regressed hard (97.4→86.4%).** A blanket "coda-first" (any
coda-capable C after a nucleus = coda) broke two things: (a) tone letters left
`sylVowel` true, so coda-first stole the *next* syllable's onset (Bahgih→spurious
[k]); (b) a single C before a vowel is the next syllable's onset by **maximal
onset** (Cinanz→[ɕi.nan]), not a coda.

**The minimal correct fix (→99.5%):** coda-first fires only when the coda-capable
C is **not** followed by a vowel — which is exactly the original coda test, just
moved *ahead* of the multi-onset loop so the loop can't grab a coda+onset cluster.
Tone letters (and tone-6 ⟨h⟩) now **close** the syllable. Added the VV-hiatus
split, the onset-less-vowel [ʔ], and ⟨'⟩ as a boundary.

Then one more residual class: the **⟨ae⟩ coda rule** was shortening [ai]→[a]
before ANY coda-capable letter, but "bae" (the morpheme *go*) stays open before a
following syllable's onset: baedangq→[pai.taːŋ] not [pa.taːŋ]. Refined ⟨ae⟩→[a]
to fire only before a *real* coda (the consonant is followed by a non-vowel).

**Result: wikipron 99.5% (1674/1682), kaikki 99.5% (1701/1709).** Floor 0.97.

**Residual (~8 words) = morpheme-boundary syllabification**, not recoverable from
spelling without a lexicon: a coda before a vowel at a morpheme seam (mak+it →
referee [mak.ʔit], we give [ma.kʰit] by maximal onset) and, conversely, a genuine
implosive/palatal onset that coda-first splits (saw+ndip → referee [saɯ.ɗip], we
give [saɯn.tip]). These two pull in opposite directions on the same ⟨V·C·V⟩ /
⟨V·nd·V⟩ shape, so no spelling-only rule wins both — a morpheme lexicon is the
principled fix (deferred). The goldens (mbwn, Cuengh, bak, gvaq, bae, cieng …) are
byte-unchanged.
