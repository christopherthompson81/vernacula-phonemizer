# Bulgarian (bg) native bring-up

Bulgarian / български (bg) — South Slavic (the easternmost of the South Slavic group); ~8M speakers, Cyrillic.
Flagged "clean" — and it is: Bulgarian orthography is highly phonemic, so a left-to-right grapheme scan plus a small
set of well-defined phonotactic post-rules recovers the pronunciation. Scope gate: trivially passes (a standardised
national language with a deep literary tradition).

## Referees — two large independent HUMAN sources

- **wikipron bul_cyrl_narrow** (PRIMARY, human) — **46,034** entries, narrow transcription (marks vowel reduction
  and palatalisation, e.g. ɐbɐdʒiɛf).
- **kaikki bg** (SECONDARY, human, Wiktionary) — **47,616** entries (marks stress, e.g. ˈukɐs).
- epitran has NO bul-Cyrl map, so it is not used — but two large human referees is a far stronger setup than the
  usual single-referee bring-up.

## The g2p — grapheme scan + phonotactics

Base letter→phoneme from the manifest; the context-sensitive letters (л, я, ю, ь) and the assimilations are in
code (`applyPhonotactics`). The rules, all confirmed against the referees:

1. **Palatalisation** — ONLY before ⟨ь я ю⟩ (мляко→mlʲakɔ, бял→bʲaɫ). Bulgarian does NOT palatalise before ⟨и е⟩
   (език→ɛzik, not jɛzik) — cleaner than Russian.
2. **Dark-l** — ⟨л⟩→[l] before a front vowel (и/е), [lʲ] before ь/я/ю, [ɫ] elsewhere (before back vowels,
   consonants, word-final): България→bɤɫɡarija.
3. **Velar nasal** — ⟨н⟩→[ŋ] before the velar stops к/ɡ (Ангел→aŋɡɛl), but NOT before the fricative х
   (Копенхаген→…pɛnx…).
4. **Final devoicing** (град→ɡrat, хляб→xlʲap) + **regressive voicing assimilation** (сграда→zɡrada). Crucially
   **/v/ is voicing-transparent AS [v]** — it does not trigger assimilation (Квебек→kvɛbɛk, not ɡvɛbɛk) — but once
   /v/ itself devoices to [f] before a voiceless obstruent, that [f] does trigger the preceding one
   (безвкусен→bɛsfkusɛn). This feeding order was the fix for a whole residual class.
5. **Sibilant assimilation** — с/з→[ʃ] before a postalveolar ʃ/t͡ʃ (Касчиев→kaʃt͡ʃiɛf, висш→viʃʃ).
6. **Cluster simplification** — стк→ск (аболиционистка→…iska), and **stop**-geminate collapse (-стта→-ста); the
   **fricative/sonorant** geminates are KEPT (без+силен→bɛssilɛn, зоология→zooˑ…) — this asymmetry, discovered
   from the residual, was worth ~500 words.

## The one systematic fold — VOWEL REDUCTION

Bulgarian neutralises its unstressed vowels: {/a/, /ɤ/}→[ɐ] and {/ɔ/, /u/}→[o]. This is **stress-conditioned**, and
Bulgarian **stress is lexical and unwritten**. Without a stress model we cannot place the reduction, so we emit the
**full phonemic vowels** (а→a, о→ɔ, у→u, ъ→ɤ) and the eval **folds the two reduction classes** ({a,ɐ,ɤ}→A,
{ɔ,o,u}→O) — exactly the akanye / short-vowel-wall treatment used elsewhere in the fleet. This is the only large
fold; everything else (consonants, palatalisation, the front vowels ɛ/i) is measured directly.

## Result

`npx tsx tools/referee-eval/eval.ts bg`:
- **wikipron (human, primary): 99.6% folded (45,836 / 46,034).**
- **kaikki (human, secondary): 99.5% folded (47,388 / 47,616).**

Two large independent human referees both at ~99.5% — a decisive result. The ~0.4% residual is genuine
narrow-transcription noise: labiodental [ɱ] (folded), acronym letter-name spell-outs (БГ→бе-ге), rare loanword
vowel oddities (Андрю→…rʲo̟), and a few micro-cluster simplifications (здн→зн).

**Numbers** are implemented (the spoken contracted forms единайсет/двайсет) and compose with the Bulgarian **и**
connector (21→dvajsɛt i ɛdnɔ; 123→stɔ dvajsɛt i tri; 2025→dvɛ xilʲadi i dvajsɛt i pɛt).

## Verdict: ✅ reliable

The strongest verification in this batch — two large human referees, both ≥99.5% folded, with the entire fold being
the principled reduction neutralisation. Gold: `test/bulgarian.test.ts`. Floor `bg: 0.98`. Deferred: STRESS + the
reduction it conditions (would need a stress lexicon — the Russian `ru` path), and stress-dependent /ʃt/~щ edge
cases. None affect the consonant + phonemic-vowel backbone.
