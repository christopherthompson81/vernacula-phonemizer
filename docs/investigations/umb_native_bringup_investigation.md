# Umbundu (umb) bring-up — investigation

Bring up Umbundu (umb), a FLEURS-102 language: Bantu (R11, Benguela/Angola, ~6M), Latin script, espeak-independent
canonical IPA. Umbundu is TONAL (H/L + downstep, marked with accents) but tone is often unwritten.

## Run 1 — 2026-07-24 — referee scoping + phonology

**Referee situation — SCARCE (authored-Bantu case).** Probed: en.wiktionary Umbundu IPA = **0 entries**; kaikki umb =
none (Wiktionary-derived); epitran has **no umb-Latn** map (162 maps, none umb); wikipron umb = none. The only
independent data is the **ASJP Umbundu-3 wordlist** (40 Swadesh concepts, Segerer & Wichmann) — but it is in coarse
ASJP-code phonetic transcription with NO standard orthography and NO tone/length, so it can corroborate the phoneme
INVENTORY and rough sound values but can't serve as an orthography→IPA referee directly. This is the ig/ha authored-
beyond-espeak situation (a distinct, documented language with a phonemic orthography — NOT the bho circular-clone
trap): author from the documented phonology + a hand-curated gold, ASJP-corroborated. 🔷 single-source at best.

**Phonology (Wikipedia Umbundu_language, Schadeberg-consistent).** Vowels /i e a o u/ + nasal counterparts
(ĩ ẽ ã õ ũ), **NO length contrast**. Consonants: plain stops/affricate **p t t͡ʃ k**; voiced obstruents occur ONLY
**PRENASALISED** — ᵐb ⁿd ᶮd͡ʒ ᵑɡ (there is no plain /b d g d͡ʒ/); fricatives **f s h** (voiceless), **v** (voiced);
nasals **m n ɲ ŋ**; approximants **w l j**. Tone: á = High, à = Low, downstep (subsequent acutes); unmarked
syllables copy the preceding tone.

ASJP corroboration (rough): one=mohi, two=vali, water=wawa, fire=ndaru, sun=kombi, night=tEkE, tongue=lakala,
big=Cakola (⟨c⟩=t͡ʃ ✓), fish/rain=mbEra (prenasal ✓) — consistent with c=t͡ʃ, prenasalised voiced stops, v, l.

→ Next: author the greedy g2p (Chichewa pattern: open CV, prenasalised clusters as single onsets) with the Umbundu
inventory; build a curated gold; mark honestly.

## Run 2 — 2026-07-24 — authored engine + gold (🔷 shipped)

Built the module (Chichewa greedy-g2p pattern): `umbundu.jsonc` (grapheme table), `manifest.ts`, `umbundu.ts`
(greedy longest-match scan + tone-accent stripping keeping the nasal tilde). Registered `case "umb"`. The scan sorts
grapheme keys length-desc so the trigraph ⟨ng'⟩→ŋ and the prenasal digraphs beat the singles. Verified sound output on
common vocabulary: Umbundu→uᵐbuⁿdu, omunu→omunu (person), ovava→ovava (water), ondalu→oⁿdalu (fire), ekumbi→ekuᵐbi
(sun), ocitumba→ot͡ʃituᵐba, Kalunga→kaluᵑɡa, onjo→oᶮd͡ʒo (house), nyama→ɲama (meat), ng'ombe→ŋoᵐbe.

Referee gap handled the Igbo way: `tools/referee-eval/langs/umb.jsonc` with `referees: []` documenting the gap +
ASJP corroboration; the correctness anchor is the hand-adjudicated `test/umbundu.test.ts` (5 tests, prenasalisation +
c=t͡ʃ + v + ɲ/ŋ + tone-strip + a sentence). **🔷 single-source** — Umbundu is a distinct, documented language (not a
clone), so the authored gold is meaningful, but there is no independent orthography→IPA referee to measure accuracy
against (only ASJP inventory corroboration). Catalogue umb→implemented 🔷; maturity-doc row added.

DEFERRED: **tone** (H á / L à + downstep — Umbundu is tonal but tone is usually unwritten, so accents are stripped and
segmental output only), **cardinal numbers** (the Umbundu numeral system wasn't reliably sourceable), and the
nasal-vowel orthography edge cases (tilde kept; VN sequences fall to the prenasal digraphs / plain n).

## Run 3 — 2026-07-24 — Schadeberg (1982) validation (review + user-supplied primary source)

The user supplied Schadeberg (1982) "Nasalization in UMbundu" (J. African Languages & Linguistics) — the authoritative
R11 phonology. Its Table 1 systematic-phonetic inventory + rules RESOLVED every point the adversarial phonology review
had flagged as contested, and upgrades this from Wikipedia/ASJP-grounded to GRAMMAR-grounded (the Igbo/Emenanjo tier):
- **⟨c⟩ = palatal obstruent [t͡ʃ]/[c]**, NOT the fricative [ʃ] Omniglot's chart shows → keep t͡ʃ (ASJP "Cakola" corroborates).
- **mid vowels [e o] CLOSE-mid** (Schadeberg's notation), not [ɔ] → keep e/o.
- **NO native /r/** — the inventory lists only /l/ → the review's r→ɾ was wrong; **fixed ⟨r⟩→l** (loan adaptation).
- **⟨v⟩ = labiodental [v]** (not [β]) ✓; **voiced stops b/d/j/g occur ONLY after a homorganic nasal** (rule (1):
  b/d/j/g /N_ ~ v/l/y/∅ elsewhere), written ⟨mb nd nj ng⟩ → exactly our prenasal-digraph handling.
- Schadeberg-attested verb forms now pinned as goldens: mbanja→ᵐbaᶮd͡ʒa (I look), ndanda→ⁿdaⁿda (I buy), njeva→ᶮd͡ʒeva
  (I hear), ngenda→ᵑɡeⁿda (I go), cila→t͡ʃila.

DEFERRED (documented): Schadeberg's rare NASALIZED continuant consonants ṽ/l̃/h̃/ỹ/w̃ (no clean orthographic marking)
and the morphophonological N+C rules (N+k→h in the class-9 prefix). Provenance/convention/maturity updated to cite
Schadeberg as the primary source. Engine review found no code bugs. 🔷 single-source, now grammar-grounded.
