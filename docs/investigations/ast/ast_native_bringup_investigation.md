# Asturian (asturianu, ast) bring-up — Ibero-Romance (Astur-Leonese), Latin, Spain (~110k)

Asturian — an Astur-Leonese (Ibero-Romance) language of Asturias, NW Spain (+ Leonese/Mirandese relatives). Close to
Spanish/Galician; distinción dialect (c/z → [θ]). Referee: **wikipron `ast_latn_broad`** (human, CUNY-CL, 4170 (merged)
headwords) + kaikki. espeak ships NO Asturian (beyond-espeak); added for **FLEURS** coverage.

## Run 1 — 2026-07-26 — the Ibero-Romance g2p (the Spanish/Galician pattern)

**The Asturian signatures (verified from the referee):**
- **⟨x⟩ → [ʃ]** (xente→ʃente, Alexandru→aleʃandɾu, baxu→baʃu) — THE Asturian hallmark; Asturian writes ⟨x⟩ where
  Spanish writes ⟨j/g⟩, so ⟨g⟩ stays [ɡ] (NO jota) and ⟨j⟩ → [h] (aspirate, in loans: guaje→ɡwahe).
- **distinción**: ⟨c⟩ before e/i → [θ] (cielu→θjelu, once→onθe), ⟨z⟩ → [θ] (zapatu→θapatu, voz→boθ); ⟨c⟩ else → [k].
- ⟨ll⟩ → [ʎ] (lleche→ʎet͡ʃe, no yeísmo in the referee), ⟨ñ⟩ → [ɲ] (añu→aɲu), ⟨ch⟩ → [t͡ʃ], ⟨y⟩ → [ʝ] (ye→ʝe).
- ⟨qu⟩/⟨gu⟩ before e/i → [k]/[ɡ] (u silent); ⟨gu⟩/⟨gü⟩ before a back vowel → [ɡw] (guaje→ɡwahe, güeyu→ɡweʝu).
- the RISING glides ⟨i⟩→[j] / ⟨u⟩→[w] before a vowel (Asturies→astuɾjes, nueche→nwet͡ʃe); a falling ⟨ai au⟩ keeps
  the offglide (Aida→ai̯da, backbone strips the breve). ⟨v⟩→[b] (betacism), ⟨h⟩ silent, single ⟨r⟩→[ɾ] / ⟨rr⟩+initial→[r].

**No final-consonant deletion** (unlike Occitan): Asturian keeps final ⟨n s r⟩ (Aragón→aɾaɡon, Abillés→abiʎes,
falar→falaɾ). **Stress** is written with accents (á é í ó ú) + the Ibero penult/oxytone rule, but the referee marks
NONE → not emitted. **SPIRANTIZATION** (intervocalic b/d/g→β/ð/ɣ) is not marked in the broad referee → emit the stops.

**FOLDED:** stress (unmarked), spirantization (β/ð/ɣ→b/d/ɡ if present), the rhotic tap/trill notation. 🔷 single
source (wikipron; kaikki is a candidate 2nd).

## Run 2 — 2026-07-26 — the Ibero-Romance g2p → 97.8% folded / 99.6% symbol

The direct Ibero-Romance map scored **97.6% folded on the FIRST pass** (Asturian is a shallow orthography). Three
small residual-driven fixes → **97.8%**:

- the **Western-Asturian dialect letters** ⟨ḥ⟩→[h] (Copenḥague→kopenhaɡe) and ⟨ḷḷ⟩→[t͡ʂ] (the *che vaqueira*,
  abeḷḷugu→abet͡ʂuɡu) — added to the table + TOKEN + a ʂ→s fold;
- **⟨y⟩ → [i] as a coda offglide** (Olay→olai, Uruguay→uɾuɡwai) vs [ʝ] as an onset (ye→ʝe, güeyu→ɡweʝu);
- **⟨pt ct⟩ → [t]** (WRONG — reverted in Run 3).

**FOLDED:** stress (unmarked), spirantization (β/ð/ɣ→b/d/ɡ), the rhotic tap/trill, the ⟨ḷḷ⟩ ʂ~s. 🔷 single source
(wikipron 4170; kaikki a candidate 2nd).

## Run 3 — 2026-07-26 — 2-agent review fixes → 99.0% folded / 99.8% symbol

The review checked my rules against the referee word-by-word and found two systematic errors:

- **⟨pt ct⟩→[t] was NET-WRONG** — the referee KEEPS the cluster in 30 of 35 pt/ct words (aceptar→aθeptaɾ,
  doctor→doktoɾ, dialectu→djalektu). Asturian marks the vocalization at the ORTHOGRAPHY level: words that vocalize
  are spelled with ⟨u⟩ (aceutar→aθeutaɾ), and a ⟨pt ct⟩ spelling is a LEARNED word that retains the stop. **Removed
  the rule** (it was right for 5, wrong for 30).
- **⟨n⟩→[m] before a labial** (b/p/m) was missing — 25 referee words (bienvenida→bjembenida, convencíu→kombenθiu). A
  standard Ibero-Romance assimilation. **Added** `labialNasal`.

Net **+1.2pp → 99.0% folded / 99.8% symbol** — near-ceiling. The residual is now the STRESS-conditioned hiatus glides
(Llión→ʎion, Riosa→ɾiosa — Asturian keeps some hiatus that Spanish glides; needs a stress/hiatus model), loan finals
(Madrid→madɾi), and letter-name rows. Also reconciled the intro referee count (4170 merged). 🔷 single source.
