# Māori (te reo Māori, mi) bring-up — Eastern Polynesian, Latin, New Zealand (~185k)

Māori — an Eastern Polynesian language of Aotearoa/New Zealand. One of the **phonologically simplest** languages in
the fleet: 5 vowels × length (macron), 10 consonants, strict CV syllables (no codas, no clusters, no diphthong
merging — every vowel is its own mora). Referee: **wikipron `mri_latn_broad`** (human, CUNY-CL, 1005 headwords) +
`mri_latn_narrow` (1012, correlated). espeak ships a Māori voice, but this is an independent cleanroom g2p.

## Run 1 — 2026-07-26 — the direct grapheme map

**A near-1:1 phonemic orthography.** Vowels ⟨a e i o u⟩→[a e i o u], the **macron = LENGTH** ⟨ā ē ī ō ū⟩→[aː eː iː oː
uː]. Consonants ⟨p t k m n h w⟩→[p t k m n h w], ⟨r⟩→[ɾ] (a tap; the broad referee writes it r ~ ɾ → fold), and the
two digraphs **⟨wh⟩→[ɸ]** (whenua→ɸenua; a bilabial fricative, [f]~[ʍ] dialectally) and **⟨ng⟩→[ŋ]** (ngā→ŋaː,
tangata→taŋata). Vowel sequences stay SEPARATE (Aotearoa→a.o.t.e.a.r.o.a — no glides), so no offglide rules.

**Stress is NOT emitted** — Māori stress is mora-based (roughly: the leftmost long vowel, else the leftmost of the
last three morae), predictable but the referee marks NONE → not emitted (the fleet convention for unmarked stress).

**FOLDED:** the rhotic r~ɾ (the broad referee is inconsistent), and ⟨wh⟩ [ɸ]~[f] (dialect). The phone inventory is
exactly {a aː e eː h i iː k m n ŋ o oː p ɸ r ɾ t u uː w} — no surprises. Expect near-ceiling.

## Run 2 — 2026-07-26 — the direct map → 99.8% folded / 100.0% symbol (FIRST PASS)

Wired the direct grapheme map + the two digraphs against wikipron `mri_latn_broad` (1005 headwords). **99.8% folded /
100.0% symbol on the FIRST pass** — no iteration needed. The only 2 "misses" are the single glyph **⟨Ḵ⟩** (K-with-line-
below, a non-Māori letter-name row → we drop it, referee has [k]); every real Māori word matches. The 100% symbol
accuracy confirms zero segmental error. This is a genuine near-ceiling: the orthography is near-1:1 phonemic, so there
is almost nothing to get wrong once ⟨wh⟩→ɸ, ⟨ng⟩→ŋ, and macron→length are in place.

**FOLDED:** the rhotic r~ɾ (broad inconsistent) and ⟨wh⟩ ɸ~f (dialect) — that's all. Stress not emitted (unmarked).
🔷 **single-source-family** (broad + narrow are the same Wiktionary scrape at two phonetic depths, correlated; no
independent 2nd source), but near-ceiling on a trivially-correct map.

**Known limitation (loan letters):** the grapheme table has ONLY the native Māori letters, so an unmapped Latin
letter (⟨b d f g l s v y⟩ — used only in un-nativized loan names) is DROPPED silently (Google→"ooe"). This is
invisible in the referee (which is all native words), but for FLEURS prose a foreign proper noun would lose those
consonants. Native Māori is unaffected; a loanword/transliteration pass is deferred.
