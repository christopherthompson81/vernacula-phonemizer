# Kikuyu / Gĩkũyũ (ki) native bring-up investigation

Kikuyu — Niger-Congo **Bantu** (E51), Kenya (~8M), the largest language of Kenya. Latin orthography. Notable:
the classic Bantu **fricativization** (⟨b⟩→β, ⟨th⟩→ð, ⟨g⟩→ɣ), **prenasalized** stops, a 7-vowel ATR system where
**the tilde marks vowel QUALITY, not nasalization** (⟨ĩ⟩→e, ⟨ũ⟩→o — the opposite of Mooré), and a 2-tone (H/L) +
downstep system that the orthography does not write → deferred/folded.

## Run 1 — 2026-07-23 — referee (1062 words) + orthography→IPA derivation

**Referee.** en.wiktionary `Category:Kikuyu terms with IPA pronunciation` — **1062 words**, built in ~11s by the
new committed `tools/corpus/build-referee.ts` (batched MediaWiki generator API + cache — the espeak-corpus
"dumps/batching ≫ sequential live API" lesson; the old per-word scraper was minutes at ~57% coverage). A LARGE,
native-vocabulary human referee (far better than the mos/wo/bm ~40-75). No kaikki dump / epitran kik-Latn / wikipron.

**Orthography→IPA, derived directly from the referee:**
- **VOWELS (7, ATR; the tilde is QUALITY not nasal):** ⟨i⟩→i, **⟨ĩ⟩→e**, ⟨e⟩→ɛ, ⟨a⟩→a, ⟨o⟩→ɔ, ⟨u⟩→u, **⟨ũ⟩→o**
  (Gĩkũyũ→ɣèkòjó, -erũ→ɛ̀ɾó, bongwe→βɔ́ᵑɡwɛ̌, kameme→kàmɛ̀ːmɛ̀). Length = doubling (baara→βaːɾa, gĩthũũ→…òː; ĩĩ→eː,
  ũũ→oː — referee inconsistent VV~Vː → folded).
- **FRICATIVIZATION:** ⟨b⟩→β (baara→βaːɾa, baba→βàːβǎ), ⟨th⟩→ð (butha→βuða, borithi→βɔ̀ɾíðì), ⟨g⟩→ɣ (Gĩkũyũ,
  gatego→ɣàtɛ̀ɣɔ́), ⟨c⟩→ɕ (biacara→βiaɕaɾa, ndaci→ⁿdàːɕì), ⟨r⟩→ɾ, ⟨y⟩→j, ⟨w⟩→w. p t k f s h m n direct.
- **PRENASALIZED (explicit digraphs — post-nasal is a STOP, not the fricative):** ⟨mb⟩→ᵐb, ⟨nd⟩→ⁿd, ⟨nj⟩→ᶮdʑ
  (Njoroge→ᶮdʑɔ̀ɾɔ̀ɣɛ́), ⟨ng⟩→ᵑɡ (Ngai→ᵑɡàǐ; referee also writes plain ŋɡ → folded), ⟨nt nc nk mp⟩ parallel.
  ⟨ng'⟩→ŋ (velar nasal, kĩng'ang'i→kèŋàŋí — distinct from ⟨ng⟩→ᵑɡ), ⟨ny⟩→ɲ (nyama→ɲàmà).
- **DAHL'S LAW is ORTHOGRAPHIC** — already baked into the spelling: a word where k dissimilates is spelled with ⟨g⟩,
  and ⟨g⟩→ɣ handles it (gathuku→ɣàðùkǔ). ⟨k⟩→k always, ⟨g⟩→ɣ always → NO live rule needed.
- **TONE (2-tone H/L) + DOWNSTEP (ꜜ)** are NOT written in the orthography → not emitted; the referee's tone
  diacritics (á à â ǎ), downstep ꜜ, syllable dots, and parenthetical optionals `(ː)(ꜜ)(w)` are FOLDED.

**Plan:** a pure greedy longest-match scan over the fricativized 7-vowel + prenasal-digraph table (no code rules —
no gemination, no pre-NC lengthening: the referee shows none). Folds = tone + downstep + dots + optional-parens +
VV~Vː + prenasal-notation ŋɡ~ᵑɡ. Numbers + tone deferred. Target: the big referee should push well past the small-
referee bring-ups.

## Run 2 — 2026-07-23 — engine built, 99.4% folded (1056/1062)

Built the pure greedy-scan engine: `src/languages/kikuyu/{kikuyu.jsonc, manifest.ts, kikuyu.ts}` (no code rules —
the fricativization + prenasalization live in the grapheme table), registered `ki` in registry.ts + the
referee-eval PHON map, referee config `langs/ki.jsonc`, referee `referees/ki.wiktionary-ki.tsv` (1062 words), gold
`test/kikuyu.test.ts`, floor 0.98.

`npx tsx tools/referee-eval/eval.ts ki` → 92.1% first pass → **99.4% folded (1056/1062)** after the notation folds:
TONE (H/L á/à + rising ǎ) + DOWNSTEP (ꜜ) + syllable dots + optional-realisation parens `(ː)(ꜜ)(w)`; LENGTH (Kikuyu
phonemic length is UNRELIABLY written — orthographic doubling and the referee's length disagree BOTH ways,
kana~kaːna vs kahĩĩ~kahee → folded, we still emit it); and the GLIDE/SIBILANT/TAP notation (the referee's vocalic
labial glide w~o/u — mwana→moana vs our phonemic [mw]; ⟨c⟩ ɕ~ʃ; tap~trill r~ɾ). The 6 remaining residuals are all
referee-side (glide-edge cases + ĩ~i/u~o vowel-quality variants) → segmental backbone ~99.5%.

Every spot-check matches: Gĩkũyũ→ɣekojo, mũndũ→moⁿdo, Njoroge→ᶮdʑɔɾɔɣɛ, kĩng'angi→keŋaᵑɡi (ng'→ŋ vs ng→ᵑɡ),
bongwe→βɔᵑɡwɛ, thaatũ→ðaːto. Highest folded score of any bring-up — a LARGE (1062) human referee + Kikuyu's regular
phonemic orthography. Verdict **🔷** (single-source Wiktionary, but large + human; Englebretson sketch grammar
corroborates the phonology). TONE (2-tone H/L + downstep, lexical + grammatical) + numbers deferred.

**Tooling:** this bring-up's referee was built by the NEW committed `tools/corpus/build-referee.ts` — a batched
(MediaWiki generator, 50 pages/call) + cached Wiktionary word→IPA builder, ported from the espeak-ng-portable
`tools/corpus` "dumps/batching ≫ sequential live API" lesson. 1062 words in ~11s (the old per-word scraper was
minutes at ~57% coverage). Replaces the throwaway per-language /tmp scrapers.

## Run 3 — 2026-07-23 — second authority (Wahome & Subiyanto 2023) — pure corroboration

A user-supplied second authority: **Wahome & Subiyanto (2023), "Phonological Processes of the Kikuyu Dialectical
Words" (IJIRD 12(3))** — a distinctive-features phonology paper with an explicit phoneme/orthography table. It
**independently confirms the Run-1 mapping** and required NO engine change:
- **Table 3 (Vowel Phoneme/Orthography) matches EXACTLY:** ⟨i⟩→i, ⟨ĩ⟩→e (mid-high), ⟨e⟩→ɛ (mid-low), ⟨a⟩→a,
  ⟨o⟩→ɔ (mid-low), ⟨ũ⟩→o (mid-high), ⟨u⟩→u — the counterintuitive tilde-is-QUALITY finding, corroborated by a
  second source. (The paper's prose loosely calls the tilde "nasalization", but its authoritative TABLE is the
  quality mapping we use; the referee agreed.)
- **Table 2 (Consonants) matches:** ⟨mb⟩=ᵐb, ⟨nd⟩=ⁿd, ⟨ng⟩=ᵑɡ, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ, ⟨r⟩=ɾ, ⟨b⟩=β, ⟨th⟩=ð, ⟨g⟩=ɣ, ⟨h⟩,
  ⟨w⟩, ⟨y⟩=j. Notational-only difference: the paper writes ⟨c⟩=ʃ / ⟨nj⟩=ⁿdʒ (postalveolar) where the Wiktionary
  referee + our output use ɕ / ᶮdʑ (alveolo-palatal) — the same sound; already folded (ʃ~ɕ). We keep the
  referee-matched ɕ.
- **All the paper's phonological PROCESSES are MORPHOPHONEMIC** (consonant strengthening /n+koma/→gome, consonant/
  nasal coalescence /n+ruta/→nduti·, /n+ʃuha/→njuhe, glide formation /mo+ona/→mwonere, insertion hitha→hithia,
  final-a deletion) — they operate at morpheme boundaries during word FORMATION and are reflected in the SURFACE
  spelling (the paper's "word" column), which our greedy scan reads correctly → none is a within-word g2p rule we
  lack. This validates the pure-surface-orthography approach.
- **Validates two judgment calls:** the glide-formation section confirms ⟨mw⟩=[mw] (mwonere, mwethere) — so our
  [mw] output is the standard and the referee's vocalic [mo] was the broad variant (our glide fold was right); and
  the 2-tone (low grave / high acute), unwritten-in-the-orthography analysis matches our tone deferral.

Net: the phonology is now **dual-authority-grounded** (Englebretson sketch grammar + Wahome & Subiyanto 2023) on
top of the 1062-word Wiktionary referee. Verdict stays **🔷** (still one orthography-matched NUMERIC referee; the
paper corroborates but is not a second word→IPA referee — the ak-cites-Dolphyne / mos-cites-FSI pattern). No code
change; 99.4% unchanged.
