# Nogai (nog) native bring-up investigation

Target: **Nogai** (ногай тили / ногайша) — a KIPCHAK Turkic language (Kipchak-Nogai / South-Kipchak
subgroup, close to Kazakh/Karakalpak), ~90k speakers (North Caucasus: Dagestan, Stavropol, Karachay-
Cherkessia; + Turkey), **Cyrillic** script. Canonical IPA, espeak-independent. The last of the espeak-
flagged Kipchak Turkic set (Crimean Tatar `crh` completed the other). Kipchak siblings already in the fleet:
Bashkir (ba), Kazakh (kk), Kyrgyz (ky), Tatar (tt), Karakalpak (kaa), Crimean Tatar (crh).

## Run 1 — referee landscape (2026-07-27): SEVERELY referee-poor

- **wikipron**: NONE (nog_cyrl_broad/narrow/latn all 404).
- **epitran**: none.
- **kaikki Nogai** (kaikki.org-dictionary-Nogai.jsonl, 484 entries): only **1** carries an IPA
  (туькен → /ty.ken/). The other 483 have NO pronunciation. So kaikki gives 1 IPA anchor + a large
  word→gloss lexicon (useful as an orthography source, see Run 2).
- **English Wiktionary "Nogai terms with IPA pronunciation"**: **1** member (the same туькен).
- **ASJP** (Lexibank, CC0): a NOGAI doculect exists (noga1249, ISO nog, transcribed by André Müller) —
  **48 Swadesh forms** in coarse ASJPcode (a DIFFERENT, independent transcriber). This is the Balochi/
  Umbundu avenue: coarse, orthography-free, corroborates the INVENTORY not the orthography, but genuinely
  independent. → the primary anchor.

**Conclusion:** Nogai has essentially NO orthographic-IPA attestation (1 word). This is an **authored,
referee-limited** bring-up in the st (Sesotho) / umb (Umbundu) / bal (Balochi) mold — the g2p is authored
from documented Kipchak-Nogai phonology and CORROBORATED (coarsely) by ASJP + the 1 kaikki word. The verdict
will carry the strongest honesty caveat (the % is an inventory check, not an orthographic accuracy signal).

## Run 2 — building an independent referee from ASJP × kaikki

ASJP gives (English gloss → independent phonetic form) but no Cyrillic; my g2p needs Cyrillic input. The
kaikki dump gives (Cyrillic word → English gloss). Joining the two on the gloss yields **Cyrillic →
independent-phonetic** pairs — the g2p never saw the ASJP form, so this is a genuine (coarse) cross-check.

Built `nog.asjp-swadesh.tsv` = 24 hand-curated Cyrillic→ASJP-coarse-IPA pairs (dropped the join's gloss-
collision noise: fish балык vs ASJP šabak; person сен; hand кол vs ASJP form — different lexemes; and the
⟨й⟩-diphthong citations ийт/бийт/коьруьв where ASJP gives the bare root). The 1 kaikki IPA (туькен→tyken)
goes in the GOLDEN, not the folded referee, so the coarse ASJP referee stays internally consistent.

## Run 3 — the g2p (documented Kipchak-Nogai phonology)

Self-contained Cyrillic scan (nogai.ts), the Tatar template minus the harmony inference (Nogai WRITES the
uvulars). Letter→IPA: ⟨к г⟩→[k ɡ] always; DIGRAPHS ⟨къ гъ нъ⟩→[q ʁ ŋ] (hard-sign ъ) + ⟨аь оь уь⟩→[æ ø y]
(soft-sign ь) + ⟨дж⟩→[d͡ʒ]; ⟨ы⟩→[ɯ], ⟨ж⟩→[ʒ], ⟨ш⟩→[ʃ], ⟨ч⟩→[t͡ʃ], ⟨х⟩→[x]; iotated ⟨я ю ё⟩ + initial/
post-vocalic ⟨е⟩→[je]; ⟨в⟩→[w] post-vocalic coda / [v] onset (the crh precedent); word-final stress.
- **туькен→tyˈken EXACTLY matches the kaikki /ty.ken/** (the one attestation — a real anchor).
- **100.0% folded / 100.0% symbol** on the 24-word ASJP referee (after the coarseness folds y→i, ø→e,
  ɯ→u, w→v — ASJP cannot represent those, so this corroborates the INVENTORY, not the fine detail; the
  real distinctions are kept in the output + asserted in the goldens). One referee typo fixed (ASJP N=[ŋ],
  so янъы→jaŋu not janu).

**Honesty:** the 100% is on a COARSE, orthography-free referee with heavy inventory folds — it says "the
g2p is consistent with an independent transcriber's skeleton" + "the one precise attestation matches", NOT
"broad orthographic accuracy is proven" (there is no orthographic-IPA corpus to prove that). This is the
st/umb/bal tier: authored from documented phonology, coarsely corroborated. Floor 0.90.

## Run 4 — 2-agent review (2026-07-27)

**Phonology reviewer — SIGN-OFF, all distinctive claims confirmed** against documented Kipchak-Nogai
(Baskakov). Confirmed: the explicit-uvular orthography (къ/гъ/нъ → q/ʁ/ŋ, ⟨к г⟩ always [k ɡ], the Bashkir
pattern); the front-vowel digraphs аь/оь/уь → æ/ø/y; ⟨ы⟩→[ɯ]; **⟨ж⟩→[ʒ] is the right call** — Nogai did NOT
undergo the Common-Turkic *y-→[ʒ] shift that Kazakh/Karakalpak did (Nogai йол vs Kazakh жол), so native ж is
rare and, in loans, the fricative [ʒ] (reserving [d͡ʒ] for ⟨дж⟩ is correct — do NOT change ж to [d͡ʒ]); ⟨ч⟩→
[t͡ʃ]/⟨ш⟩→[ʃ] retained (no Kazakh č→š→s shift); coda ⟨в⟩→[w]; final stress; full 39-letter inventory covered;
edge cases (альбом→albom, no spurious аь) clean. ★ ONE substantive residual DISCLOSED (not a wrong value):
**intervocalic NATIVE ⟨в⟩→[w]** (бавыр should be [bawɯr], тавык [tawɯk] — Common-Turkic *bagïr/*tağuk) is
emitted [v] by the coda-only rule. It is a genuine LEXICAL split (intervocalic LOAN в is [v]: совет→sovet),
unrecoverable from spelling — the same deferral carried from Crimean Tatar (crh "native intervocalic needs
lexicon"). Conservative coda-only never produces a wrong [w]; a lexicon is the only clean fix. → DEFERRED,
disclosed. Minor notes (no change): ⟨а⟩→[a] fine (phonemic; [ɑ] a narrow variant); ⟨дж⟩ commented as a
defensive loan mapping.

**Code/wiring reviewer — SIGN-OFF, honest at the data level.** Scan traces clean; 9/24 referee words exercise
a fold; the folds are minimal and NOT a blanket mask (ɯ→u only masks a u-for-ɯ confusion — a wrong [i] for ⟨ы⟩
would still MISMATCH [u]; only the exact ASJP-unrepresentable pairs i↔y/e↔ø/u↔ɯ/v↔w collapse, which IS ASJP's
real coarseness); the "100% = inventory check, not accuracy" disclosure is consistent across nog.jsonc / floor
/ maturity / catalogue. Referee lexemes + ASJP→IPA conversion (S=ʃ, N=ŋ, y=j) spot-check out. ★ ONE latent
edge-case BUG FIXED: the coda-⟨в⟩ and ⟨е⟩-iotation tests read the raw prior char `chars[i-1]`, which after a
front-vowel digraph is the soft sign ь (not a vowel) → суьв gave [syv] not [syw], аье didn't iotate. FIX =
test the last EMITTED segment (`isVowelSeg(segs[at-1])`) so the digraph vowel [æ ø y] is seen; added a golden
(суьв→syw, аье→æje). No real corpus word hits it today, but the fix is strictly correct. Consistency: wiring/
counts/columns all correct; кеше "person" spot-noted (Tatar-shared; the ASJP source's attested form).

**Final: 100% folded / 100% symbol on the coarse 24-word ASJP referee (inventory-only) + туькен==the 1 kaikki
IPA. 🔷 authored, referee-limited. Floor 0.90.** Full suite green, typecheck clean. Deferred: numbers, an
orthographic-IPA referee (none exists), **intervocalic native ⟨в⟩→[w]** (lexical, collides with loan [v]).
