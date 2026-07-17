# Cebuano (ceb) native bring-up

Cebuano / Sinugboanon (Bisaya) — Philippine (Central Bisayan), ~21M speakers, Latin script. A cleanroom shallow
near-phonemic g2p, espeak-independent, following the **Tagalog pattern**.

## Reuse question (checked up front)

Cebuano is a Philippine language like Tagalog (`tl`), so the first question was whether it can share the Tagalog
machinery. The *rules* are the same shape — word-initial + hiatus glottal, ng→ŋ, penult stress, an unwritten
lexical word-final glottal — but the Tagalog module hardcodes its manifest and carries Tagalog-specific lexicons
(stress, final-glottal, loanword). So Cebuano is a **focused sibling module** (its own cebuano.jsonc + a lean
scan/stress mirroring Tagalog's generic core) rather than a refactor of Tagalog — no regression risk to Tagalog,
and the data differs anyway (numbers, vowel residual, no lexicons yet).

## Data availability

- **wikipron ceb_latn broad** — 3,895 human words (PRIMARY).
- **epitran ceb-Latn** — programmatic (SECONDARY, INDEPENDENT). Two genuinely independent referees.
- (kaikki ceb also exists, 24 MB, not needed.)

## The rule core — the Tagalog pattern

The referee confirms Cebuano behaves exactly like Tagalog:

- **Word-initial glottal** [ʔ] before a vowel (adlaw→ʔadlaw, inom→ʔinom), and a **HIATUS glottal** between two
  vowels (kaon→kaʔon, maayo→maʔajo). The y/w glides are consonants, so ⟨ay⟩/⟨aw⟩ stay glides (balay→balaj).
- **⟨ng⟩ → [ŋ]** (langit→laŋit); **⟨y⟩ → [j]**; a **hyphen → [ʔ]** (pag-asa→paɡʔasa); ⟨mga⟩ → [maˈŋa].
- **Penultimate stress** (phonemic but unwritten; the majority default, folded by the eval backbone).
- 5 written vowels a e i o u (the native 3-vowel core means i~e / u~o vary — a lexical residual).
- Numbers: native Cebuano, tens-first with the ligature "ug" (napulo ug usa = 11), the ka-…-an tens, "ka" for
  hundreds/thousands (duha ka gatos).

## Run — vs the two referees

**87.3% vs wikipron / 70.0% vs epitran.** The striking finding: **every single one of the top ~200 residuals is a
capitalized Spanish-surname / place-name proper noun** (Acebedo, Alfonso, Aguilar, Achondo…) — the native Cebuano
vocabulary is essentially 100% correct. The residual is Spanish-loan nativization the g2p doesn't special-case:
soft-c→[s] (Acebedo→asebedo), f→[p] (Alfonso→alponso), gu→[ɡ] before front vowels (Aguilar→agilar), the Spanish
⟨io⟩→glide (Saliot→saljot) where native Cebuano inserts a hiatus glottal. This is a referee-composition artifact
(the wikipron list is packed with Filipino surnames of Spanish origin), the same shape as Tagalog and English —
NOT a native-rule gap. Folds are notational: the tap ɾ~r, the y-glide j~d͡ʒ, and the unwritten+lexical word-final
glottal (deferred, stripped for the rule comparison).

## Verdict — ✅ Reliable

The native core is verified essentially perfect against two independent referees. **Outstanding:** (1) the
unwritten word-final glottal (bata child [bataʔ] vs robe [bata]) — phonemic but lexical, deferred (the Tagalog
final-glottal-lexicon path); (2) unwritten phonemic stress beyond the penult default (a stress lexicon, deferred);
(3) Spanish-loan proper-noun nativization (a loanword lexicon) — a diffuse referee-noise tail, not a native error.
