# Mooré (mos) native bring-up investigation

Mossi / Mooré — Niger-Congo **Gur** (Oti-Volta), the largest language of Burkina Faso (~8M). The **first Gur
language** in the fleet. Latin orthography (Burkinabé national alphabet). Non-obvious features: ATR-ish 9-vowel
system with dedicated letters ⟨ɛ ɩ ʋ⟩, nasal vowels (tilde), vowel length (doubling), and a **2-tone (H/L)** system
that the standard orthography **does not write** (tone is contextual) → deferred/folded, like the other tonal
bring-ups.

## Run 1 — 2026-07-23 — research + referee + orthography→IPA derivation

**Sources.** Wikipedia/Grokipedia phoneme inventory + the Burkinabé alphabet; the referee is **en.wiktionary
`Category:Moore terms with IPA pronunciation`** (75 members → 39 with a parseable `{{IPA|mos|…}}` in the `==Moore==`
section), scraped via the MediaWiki API (`/tmp/build_mos_referee.py`). kaikki has no per-language Mooré dump at the
usual URL (404) — Wiktionary is the same underlying source. Single-source, loanword-heavy (French/Arabic:
foto, leta, lampo, malɛka, fɩnetre) — noted as the breadth caveat.

**Inventory** (Wikipedia). Consonants /m n ɲ · p t k ʔ · b d ɡ · f s h · v z · r l j w/ (24). Vowels oral
/i ɪ e u ʊ o a/ + ⟨ɛ⟩ (the /ɛ ɔ/ are analysed by some as /ea oa/ — and indeed ⟨ɔ⟩ is NOT a letter; /ɔ/ surfaces
as the hiatus ⟨oa⟩). All vowels except /e o/ nasalise; all can be long.

**Orthography→IPA, derived from the referee** (word → referee IPA → correspondence):
- ⟨o⟩→**o** always (boko→bòkó, foto→foto, lore→lóɾè) — NOT ɔ; ⟨oa⟩ is hiatus o+a (laloa→lalóa, arozoaare).
- ⟨r⟩→**ɾ** (tap) everywhere (Afriki→áfɾiki, faare→fáːɾè); ⟨y⟩→**j** (lay→láj, yoko→jòkó); ⟨ɩ⟩→ɪ (fɩnetre→fɪnetɾe),
  ⟨ʋ⟩→ʊ (faktɩʋʋre→faktɪʊːɾe), ⟨ɛ⟩→ɛ (lakrɛ→lakɾɛ, lɛɛre→lɛːɾe). Plain e→e, i→i, u→u, a→a; b d f ɡ k l m n p s t z
  direct; g→ɡ.
- LENGTH = doubling: aa→aː, ee→eː (weefo→wèːfó, toeeme→tóeːme), ɛɛ→ɛː (lɛɛre), oo→oː (baoore→bàoːɾé),
  uu→uː (fulfuugu→fúlfuːɡu), ʋʋ→ʊː (faktɩʋʋre). ii/ɩɩ by pattern.
- NASAL = tilde: ã ẽ ĩ õ ũ (burkĩna→bùɾkĩná, rõde→ɾõde, fẽnetre→fẽnetɾe, esãase→esãːse). Nasal-long ⟨ãa⟩→ãː
  (esãase). ⟨ĩi⟩ stays ĩi (sikr zĩiga→…zĩiɡa) — so nasal-length is NOT general; only the attested ⟨ãa⟩ digraph added.
- GEMINATION: ⟨CC⟩→Cː (yelle→jélːé) — code rule (Wolof pattern). The referee also splits it (lekolle→lékolle);
  folded.
- ⟨ny⟩→ɲ, ⟨ŋ⟩→ŋ (no referee example — from the inventory); apostrophe ⟨ʼ⟩→ʔ (glottal stop; from Wikipedia).

**Tone.** The referee marks H (á) / L (à) per syllable, but Mooré orthography does NOT write tone (it is contextual —
Wikipedia). So the engine reads toneless orthography and does not emit tone; the referee's tone diacritics + syllable
dots are FOLDED (the Wolof-stress pattern). This is the principled deferral, not a gap in the mapping.

**Plan:** greedy longest-match scanner + gemination (the Wolof engine shape), the grapheme table above, folds =
tone (´ ` ˆ) + syllable dots + CC~Cː. Numbers + the tone layer deferred. Target: match wo/bm (~90%+ folded).

## Run 2 — 2026-07-23 — engine built, 94.9% folded (segmental backbone ~100%)

Built the Wolof-shaped engine: `src/languages/mossi/{mossi.jsonc, manifest.ts, mossi.ts}` (greedy longest-match +
consonant-gemination code rule), registered `mos` in registry.ts + the referee-eval PHON map, referee config
`langs/mos.jsonc` (folds = tone [̀́…] + syllable dots + CC~Cː; nasalisation NOT folded — it is written),
referee `referees/mos.wiktionary-mos.tsv` (39 words), gold `test/mossi.test.ts`, floor 0.9.

`npx tsx tools/referee-eval/eval.ts mos` → **folded 94.9% (37/39)**, raw 0% (the referee tone-marks every
syllable; we emit none). The TWO residuals are both **referee artifacts**, not engine bugs:
- `lekolle` (l'école): referee wrote `lé.kol.le` (split l.l) where it writes `jélːé` (lː) elsewhere — its own
  gemination-notation inconsistency.
- `yĩn-maasem`: referee wrote `yĩn…` keeping ⟨y⟩ as "y" — a typo; every other entry maps ⟨y⟩→j (lay→láj, yoko→jòkó).

So the segmental backbone is ~100%; the mapping derived in Run 1 holds across all 39 words (ATR ⟨ɛ ɩ ʋ⟩, ⟨o⟩=o,
doubling=length incl. ʋʋ→ʊː, tilde nasals incl. nasal-long ãa→ãː, ⟨r⟩→ɾ, ⟨y⟩→j, gemination). Spot-checked outputs
all match the referee minus tone (esãase→esãːse, faktɩʋʋre→faktɪʊːɾe, laloa→laloa hiatus).

**Status 🔷 single-source** (Wiktionary only, loanword-heavy, 39 words — like Wolof/Bambara/Akan). TONE (2-tone
H/L, unwritten) + numbers deferred. Verdict: a clean first Gur bring-up matching the wo/bm bar.

## Run 3 — 2026-07-23 — FSI Moré Basic Course corroboration + 2 grounded rules

A second authority surfaced: the **FSI Moré Basic Course** (Lehr, Redden & Balima 1966), which carries a full
Symbol/Orthography/Phonetics/Phoneme table. It **independently corroborates** the Run-1 mapping and adds two
FSI-documented rules the Wiktionary-only pass missed:
- **CONFIRMS**: ⟨r⟩ = the flap allophone of /d/ ([d, r] → /d/) → ⟨r⟩→ɾ is right; ⟨o⟩ = /o/ with [ɔ,o] allophones
  and the ⟨ao⟩ digraph for the ɔ realization → ⟨o⟩→o, no ⟨ɔ⟩ letter; ⟨ny⟩→ɲ, ⟨y⟩→j, ⟨ʼ⟩→ʔ; nasal vowels + length +
  lexical H/L tone (with mid/downstep). FSI's palatalised ⟨ky gy⟩, ⟨gh⟩→ɣ, and the front-vowel palatalisation of
  k/g/m/n/s are ALLOPHONIC (unwritten) → correctly not emitted.
- **ADDED (grounded)**: (1) **⟨n⟩→[ŋ] before a velar g/k** — FSI /n/⁴ = [n, ŋ], with real words tengá→[teŋɡa]
  (village), kéengdà, dɛŋɡ; the same rule Wolof has. Code rule (mossi.ts). (2) **⟨sh⟩→ʃ** — FSI lists ⟨sh⟩ as the
  [ʃ] spelling of /s/ before front vowels. Grapheme-table entry.
- **NOTED (kept modern)**: FSI (1966, pre-standard) COLLAPSES e/ɛ into one /e/ (a 5-vowel pedagogical analysis);
  the **modern** Burkinabé orthography (Nikièma 1978) I map — ⟨ɛ ɩ ʋ⟩ distinct, Wiktionary-validated — is the
  current standard, so the vowel mapping stands. FSI's transcription is also tone-marked (á/à) and uses its own
  digraphs, so it is NOT a drop-in word-list referee in the modern orthography → the referee-eval stays
  single-source (Wiktionary); FSI is corroborating PHONOLOGY (the ak-cites-Dolphyne / lg-cites-Wikipedia pattern).

Re-ran: typecheck clean, `test/mossi.test.ts` 6/6 (added tenga→teŋɡa + sh→ʃ), referee eval unchanged at **94.9%**
(the two additions don't touch the 39 referee words). The mapping is now **dual-grounded** (Wiktionary orthography
referee + FSI phonology). Verdict remains **🔷** (one numeric referee word-list; FSI corroborates but isn't a second
orthography-matched referee) — the standard first-Gur-bring-up outcome, now on firmer ground.
