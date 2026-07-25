# Kamba (Kikamba, kam) bring-up — Niger-Congo Bantu (E55), Kenya

Kamba / Kikamba, Bantu (E55), Kenya (~4M speakers), Latin orthography. A close relative of Kikuyu (both Central Kenya
Bantu) — the Kikuyu greedy-g2p pattern (`src/languages/kikuyu/`) is the template. Beyond-espeak, authored.

## Run 1 — 2026-07-25 — referee scoping (thin) + the vowel-system anchor

**The referee is THIN — this is a weak-referee bring-up (like the fleet's lg/wo/bm).** Checked every source:
- en.wiktionary `Category:Kamba terms with IPA pronunciation` → **only 5 words** (via tools/corpus/build-referee.ts):
  `mbiti→mbítí` (hyena), `mũkonyo→mòkɔ́ɲɔ̀`, `mũtĩ→mòté` (tree), `ngingo→ŋɡíŋɡɔ́` (neck), `ũtukũ→òtúkò` (night).
- kaikki: no per-language Kamba dump (404); ~7 raw entries.
- epitran: no `kam-Latn`; wikipron: no Kamba. So NO independent numeric second source.

**The 5 human words are an INDEPENDENT anchor and already fix the vowel system** — Kamba mirrors Kikuyu's 7-vowel ATR
where the TILDE marks QUALITY not nasalisation: `mũtĩ→mòté` gives ⟨ũ⟩=o, ⟨ĩ⟩=e; ⟨o⟩=ɔ, ⟨u⟩=u, ⟨i⟩=i; `mũkonyo`
gives ⟨ny⟩=ɲ; `ngingo` gives ⟨ng⟩=[ŋɡ] prenasalised. Tone is marked (á/à) in the referee but Kamba orthography does
NOT write tone (contextual) → fold, like Kikuyu.

**Plan:** author a Kamba-specific greedy g2p (NOT a blind Kikuyu clone — Kamba differs on the consonants, e.g. the
⟨b⟩/⟨v⟩/⟨th⟩ series and a reported implosive) grounded in a phonology sketch + the 5 Wiktionary anchors; validate on
those 5 (tone folded) + a hand-adjudicated common-word gold. Honest status will be 🔷 (single thin source) unless a
larger independent gold surfaces — per the cannot_verify lesson, avoid a circular Kikuyu-clone validation.

## Run 2 — 2026-07-25 — table authored + validated 5/5

Phonology researched (Omniglot Kikamba chart + Wikipedia/Roberts-Kohno 2000). The table is NOT a Kikuyu clone — Kamba
diverges on the consonants:
- **⟨v⟩=β** (Kamba spells the Bantu [β] as ⟨v⟩, not ⟨b⟩ — the biggest divergence); standalone ⟨b⟩ also →β (older
  mission/Bible orthography, so both spelling traditions work).
- **⟨sy⟩=ʃ, ⟨ky⟩=tʃ** — a palatal series Kikuyu lacks; Kamba has **NO ⟨c⟩** and **NO ⟨g⟩=ɣ** ([ɡ] only post-nasally).
- **⟨nth⟩=ⁿð** (prenasalised dental); ⟨th⟩=ð, ⟨nz⟩=ⁿz. Shared with Kikuyu: 7-vowel ATR (tilde=quality), length-by-
  doubling, ⟨mb nd ng⟩ prenasal, ⟨ny⟩=ɲ, ⟨ng'⟩=ŋ, tone unwritten.
- **The reported implosive ɓ was a Kambaata (Ethiopia) mix-up — dropped.**

Built `src/languages/kamba/` (kamba.jsonc table + manifest.ts + kamba.ts greedy scan, the Kikuyu pattern), registered
(`kam`), test/kamba.test.ts (5 verified anchors + Kamba-specific signatures), tools/referee-eval/langs/kam.jsonc.

**Result: referee-eval 5/5 folded (100%) / symbol 100%** vs the 5 en.wiktionary anchors (tone + prenasal-notation +
length folded); raw 0/5 (all differ only by tone marks). Signatures verified: ngavu→ᵑɡaβu, syana→ʃana, kyama→tʃama,
nthakame→ⁿðakamɛ, ng'ombe→ŋɔᵐbɛ, mũndũ→moⁿdo.

**Status 🔷 — thin single referee** (5 words), corroborated by two curated authorities (Omniglot + Wikipedia), not a
second numeric source. **Open/contested (documented, not silently guessed):** ⟨th⟩ voicing [ð]~[θ] (went with [ð] per
Omniglot/Wikipedia + Kikuyu parallel — the #1 thing to revisit if more human IPA surfaces); ⟨sy⟩=ʃ / ⟨ky⟩=tʃ are
single-sourced; ⟨r⟩=ɾ tap is dialectal (⟨l⟩ dominates). Tone + numbers deferred.

## Run 3 — 2026-07-25 — 4-angle review fixes

Adversarial review (g2p/wiring · phonology-table · test-golds/folds · conventions/docs) — golds + wiring clean; three
real table bugs fixed + doc honesty:
- **⟨d⟩ was silently dropped** (no table entry, unlike the g/j/z loan values) — `Daudi`→`aui`. Added ⟨d⟩=d and ⟨c⟩=tʃ
  so borrowings/names keep their consonants; fixed the self-contradictory noGloss comment.
- **Bare ⟨'⟩→ʔ injected a phantom glottal** on quoted words (`'mũtĩ'`→`ʔmoteʔ`); Kamba has NO phonemic glottal stop
  (the apostrophe's only role is the ⟨ng'⟩ trigraph, matched first) → removed the '→ʔ mapping (a bare quote now drops).
- **Apostrophe normalisation missed U+02BC ʼ** (the modifier-letter apostrophe common in Kenyan Bantu orthographies) —
  `ngʼombe`→`ᵑɡɔᵐbɛ` instead of `ŋɔᵐbɛ`. Now folds ' / ’ / ʼ → ' (test locks all three variants).
- **Honesty:** the 5-word referee exercises ONLY vowels + prenasals (ᵐb/ᵑɡ/ɲ), NOT the divergent consonants
  (β/ʃ/tʃ/ð) — a wrong β/ʃ/tʃ/ð would still score 5/5. Disclosed explicitly in the maturity row + eval secondaryGap.
- Raw source note (per the raw-finding rule): the [θ] variant of the contested ⟨th⟩ came from Grokipedia (AI-generated,
  low trust) — NOT relied on; the shipped [ð] rests on Omniglot + Wikipedia + the Kikuyu parallel.

Regression tests added (Daudi/daktari, the three apostrophe variants, no-phantom-ʔ). tsc + suite green.
