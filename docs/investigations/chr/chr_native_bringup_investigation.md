# Cherokee (chr) native bring-up investigation

Target: **Cherokee** (ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ / Tsalagi Gawonihisdi) — Iroquoian, ~2k L1 speakers (Oklahoma/NC),
written in the **Cherokee syllabary** (Sequoyah, 85 characters, U+13A0–U+13F4 + Supplement U+AB70–U+ABBF).
Canonical IPA, espeak-independent. **The fleet's FIRST IROQUOIAN family.** Reference: Montgomery-Anderson,
*Cherokee, A Reference Grammar of Oklahoma* (the falsifiable published phonology — the bho/Crawford mold).

## Run 1 — referee landscape (2026-07-28)

Cherokee is genuinely WELL-RESOURCED (unlike the recent thin ones — this has a real quality signal):
- **wikipron `chr_cher_broad`** (183 rows) — SYLLABARY-keyed, broad IPA, space-separated segments with FULL
  prosody (6 tones à á ǎ â ȁ a̋, length ː, aspiration ⁽ʰ⁾, intrusive h, glottal ʔ). → **PRIMARY.**
- **kaikki Cherokee** (185 IPA entries) — SYLLABARY headwords + romanization forms + tone/length IPA. Independent
  SECONDARY. (chr_latn_* : none; the syllabary is the writing system, so both referees key on it.)
- Reference grammar (Montgomery-Anderson) — the g2p phonology anchor.

★★ The two referees DISAGREE on obstruent voicing: wikipron writes the unaspirated series **voiceless** [k t]
(mostly), kaikki writes it **voiced** [ɡ d d͡ʒ] (ᏣᎳᎩ→/d͡ʒɑlɑˈɡî/). The grammar RESOLVES it: Cherokee obstruents
are **phonemically VOICELESS**, contrasting unaspirated/aspirated (NOT voiced/voiceless) — the voicing is
allophonic surface detail. So emitting voiceless /k t t͡s/ is grammar-faithful AND matches wikipron; kaikki's
intervocalic voicing folds.

## Run 2 — the phonology (Montgomery-Anderson, Ch. 2)

★ **6 vowels** (Table 3/4): i e a o u + **⟨v⟩ = [ə̃]** (nasal mid-central; the one nasal vowel — grammar analyses
it as non-contrastive-for-nasality but the character is realised nasal). Length (doubled) + **6 TONES** (low,
high, rising, lowfall, falling, highfall) — BOTH unwritten in the syllabary.
★ **23 consonants** (Table 1/2), aspiration-not-voicing contrast, NO /b f v/, rare /m/:
- Stops: kʷ t k ʔ (unasp) / kʷʰ tʰ kʰ (asp)
- Affricates: t͡s~t͡ʃ (unasp, romanized ⟨j⟩) / t͡sʰ t͡ʃʰ (asp, ⟨ts ch⟩)
- Fricatives: s h ; lateral fricative ɬ (⟨hl⟩)
- Lateral affricate: t͡ɬ (⟨tl⟩ unasp / ⟨thl⟩ asp)
- Sonorants: l m n (+ voiceless n̥ ⟨hn⟩), glides w j (+ voiceless w̥ ⟨hw⟩ y̥ ⟨hy⟩)

★★ **THE SYLLABARY IS A SHALLOW PHONEMIC SKELETON** (grammar p.95, §4): it "does not differentiate aspiration
and never shows vowel length or tone", never the glottal stop, never the intrusive /h/. **Table 13** is the
definitive 85-char map (13 consonant-series rows × 6 vowel columns A E I O U V), with split cells only for
ga/ka (Ꭶ [ka] vs Ꭷ [kʰa]), da/ta, de/te, di/ti, dla/tla, and the bare Ꮝ = /s/. So syllabary→IPA is inherently
lossy: it recovers the SEGMENTAL melody but NOT aspiration / tone / length / glottalisation / intrusive-h. This
is the Scottish-Gaelic / Faroese pattern in the extreme → **SYMBOL accuracy is the honest headline; tone /
length / aspiration / glottal / intrusive-h are the folded residual.**

## Run 3 — architecture

Engine (chr.ts): deterministic per-CHARACTER lookup over the 85-char syllabary (built from the standard
U+13A0-ordered value table; Cherokee Supplement lowercase folded via toUpperCase). Each char → its CV IPA
(voiceless-unaspirated obstruent baseline; ⟨v⟩→ə̃). Aspirated split-cell chars (Ꭷ→kʰ, Ꮤ/Ꮦ/Ꮨ→tʰ, Ꮭ→t͡ɬ) emit the
richer aspirated form (folds for the referee). No tone/length/glottal/intrusive-h (none are in the source
orthography). The eval BACKBONE already strips tone accents (U+0300–036F), length ː, tie-bars, and the nasal
tilde / voiceless ring on BOTH sides — so those fold for free. The config folds neutralise what remains:
- **voicing** (kaikki + wikipron intervocalic): ɡ→k, d→t, d͡ʒ→t͡s, ɡʷ→kʷ, b→p, z→s, ʒ→s
- **aspiration** ⁽ʰ⁾ → strip (our kʰ tʰ + referee's aspiration)
- **glottal** ʔ → strip (never in the syllabary)
- **intrusive/onset h** → strip (the syllabary marks only onset h, folded together with the unpredictable
  intrusive/coda h — symmetric, so onset-h words still align; the h signal is sacrificed, disclosed)
- notation: ɰ→w, ʃ→s, ɔ→o (wikipron variants)

Primary eval: wikipron.

## Run 4 — measurement (2026-07-28)

First pass: wikipron **88.0% folded / 96.2% symbol**, kaikki 88.8% / 96.5%. Three cheap fixes from the residuals:
- **Ᏽ (U+13F5 CHEROKEE LETTER MV) → empty**: Unicode added MV *after* the grammar (which recorded /mv/ as the
  one gap); the referees use it. Added → [mə̃].
- **⟨dla⟩ series → referee [d͡ɮ]** (voiced lateral affricate): fold ɮ→ɬ (voicing).
- **the 6th vowel ⟨v⟩: mine [ə] vs wikipron [ʌ]** (one phoneme, notation variant): fold ʌ→ə.

Second pass: **wikipron 91.3% folded / 97.2% symbol; kaikki 91.6% / 97.3% symbol** — two HUMAN referees
corroborating tightly (a genuine quality signal, unlike the recent thin bring-ups). The remaining ~9% residual
is exactly the predicted, unrecoverable class:
- ★ the grammar's **MORPHOPHONOLOGICAL vowel-deletion** — the syllabary preserves the underlying vowel, speech
  deletes it (ᎪᎵᎦ written `kolika`, spoken `kolhka` 'understand' — Table 14; ᎠᎪᏩᏘᎭ `akowatia`→`akowtia`).
  Recovering this needs morphology, not the syllabary. The core disclosed limitation.
- fine allophony: glide epenthesis at a hiatus (ᎠᎰᎧ a.o→a.jo), affricate lenition (ts→[z] intervocalic).
None is a segment-mapping bug. Goldens (test/cherokee.test.ts) pin ᏣᎳᎩ→t͡salaki, ⟨v⟩→ə̃, MV, the aspirated
split-cells (Ꭷ→kʰa), the labialised velar (Ꮖ→kʷa), the lateral affricate (Ꮬ→t͡ɬa), bare Ꮝ→s, and the
Supplement lowercase fold. Full suite 1383/1383, typecheck clean, DB implemented=189.

## Run 5 — two-agent review (2026-07-28)

**Code/wiring reviewer — CLEAN.** Independently reconstructed the 85 codepoints and matched every index against
the canonical Unicode letter names: ZERO drift, no off-by-one. Verified the special-cased bare Ꮝ (idx 45 =
U+13CD) and obsolete NAH (idx 32 = U+13C0) land right, the multi-letter onset split (qu/dl/tl/ts/hn), the
appended MV (U+13F5, added after the loop — no double-count), the TOKEN ranges, that toUpperCase folds all 80
Supplement chars 1:1 onto the main block with no empties, that every char in U+13A0–U+13F5 is non-empty, and
that the folds are valid regex in a sound order (multi-char before single). No bugs, no dead code. (I had
independently confirmed the zero-mismatch array + the Supplement fold before the review — corroborated.)

**Phonology reviewer (with grammar access) — SOUND, grammar-faithful, no gross errors.** Matched the value list
cell-by-cell against Table 13 + Tables 1–2; all split cells correct (incl. the Unicode-name inversion Ꭶ"GA"=
unaspirated /ka/ vs Ꭷ"KA"=aspirated /kʰa/, grammar p.95). **STRONGLY endorsed the voiceless-obstruent choice**
as "the grammar's own phonemic analysis, not a judgment call — the single strongest decision in the bring-up"
(p.47/48/50: obstruents contrast aspiration NOT voicing; kaikki's [ɡ d d͡ʒ] is the English-perception artifact
the grammar explicitly warns against). Confirmed the no-tone/length/glottal/intrusive-h folds, qu→[kʷ],
j/ch/ts→ts-series, hn split, and the vowel-deletion residual attribution. Drove FIVE fixes (all APPLIED): (1)
"marks NO aspiration" overstated → "does not differentiate aspiration EXCEPT the split cells" (engine already
behaved correctly; prose tightened in chr.ts + chr.jsonc); (2) ⟨v⟩ citation → the grammar's symbol is [ɔ̃] (not
[ə̃]); added the latent-fold caveat that a future [ɔ̃]-writing referee would collide with the ɔ→o fold; (3) the
Oklahoma **tɬ→ɬ deaffrication** is SYSTEMATIC (grammar Table 1/2 + ex.12), not "fine allophony", and was NOT
folded → added the `tɬ→ɬ` fold (91.3→91.8% wikipron, 91.6→92.2% kaikki); (4) the Table-14 string was
transposed — the grammar gives ka-oolihka→**kolhka** (l/h metathesis), not "kohlka" → fixed across all docs; (5)
the MV comment now acknowledges the grammar calls /mv/ "non-existent"/"the only gap" (pragmatic Unicode
concession), not merely that Unicode postdated the grammar.

**Final: 🔷 Cherokee, the fleet's FIRST IROQUOIAN language, authored from Montgomery-Anderson. Well-resourced —
two corroborating HUMAN referees at ~92% folded / 97.3% symbol.** The syllabary is a shallow phonemic skeleton
(tone/length/most-aspiration/glottal/intrusive-h folded); the residual is the unrecoverable morphophonological
vowel-deletion + the Oklahoma tɬ→ɬ shift. Deferred: the vowel-deletion morphophonology (needs morphology), a
tone/length lexicon, the Latin romanization front-end, numbers.
