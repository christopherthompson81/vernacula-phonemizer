# Maithili (mai) native bring-up

Maithili / मैथिली — Eastern Indo-Aryan (Bihari group), ~34M speakers in Bihar and Nepal, Devanagari. A scheduled
language of India with its own literary tradition. This bring-up is the follow-through on the earlier taxonomy
argument: Maithili was almost lumped with the ⛔ Hindi-belt clones (Awadhi, Bhojpuri), but a data check found it
**clears the ⛔ bar** — it has a small but real *independent* human referee, which those don't.

## Data availability (checked up front)

- **wikipron mai_deva narrow** — 167 human pairs. The ONLY referee. Small, so this is **🔷 single-source**, not a
  confident ✅ — but it is an independent human source, which is the whole difference from ⛔.
- **kaikki Maithili** — 404 (none). **epitran** — no Maithili (and would be a Hindi clone anyway).

The `bho` cannot-verify note warns that a *G2P clone* of the parent is circular; a small set of *human*
transcriptions is not. 167 words is thin, but it measures.

## The Maithili profile (from wikipron)

- **Inherent /ə/** (like Hindi, not Bengali/Odia's ɔ): अन्न→ənnᵊ, हुनका→ɦʊnᵊkaː.
- **The ultrashort ᵊ signature** — a cluster schwa that Hindi *deletes* instead reduces to an ultrashort [ᵊ]
  (इसपात→ɪsᵊpaːt, ऎकरा→ekᵊɾaː). A narrow phonetic detail; our Hindi-engine deletion + a `ᵊ~∅` fold align.
- **Short e/o**, including the **dedicated short-vowel letters ऎ (U+098E) / ऒ (U+0912)** — distinct codepoints
  from ए/ओ that Maithili actually uses (ऎकरा). Missing these dropped the initial vowel entirely (the +8.4pp fix).
- **Diphthongs ऐ→[əɪ], औ→[əʊ]** (बैसब→bəɪsəb, दौड़ब→dəʊɾəb) — kept, like the eastern group.
- **च/ज = alveolo-palatal [t͡ɕ]/[d͡ʑ]** in the narrow referee (Eastern-Indic), vs our [t͡ʃ]/[d͡ʒ] — folded.

## Runs (folded vs the wikipron primary)

- **Run 1 — Hindi engine + Maithili jsonc** (short e/o, ऐ→əɪ, inherent ə). 62.9%. Folds: ᵊ~∅ (ultrashort),
  dental t̪~t, gemination.
- **Run 2 — the short-vowel letters + ड़ flap.** Added ऎ/ऒ (U+098E/U+0912) + their matras (the initial vowel was
  being dropped) + folded ड़ ɽ~ɾ. → 71.3%.
- **Run 3 — alveolo-palatal + औ→əʊ + the ꣿ sign.** The big lever: folding च/ज = [t͡ɕ]/[d͡ʑ]~[t͡ʃ]/[d͡ʒ] (the
  backbone strips the tie bar, so the fold pattern is `tɕ`/`dʑ`, not `t͡ɕ` — a subtle fix worth +10.7pp).
  → **84.4%**.

## Verdict — 🔷 Single-source verified

**84.4% folded vs wikipron mai_deva narrow (167, human)** — the only referee, so single-source. The residual is
diffuse orthographic edge cases (the rare Maithili signs ꣿ/ऽ/꣱, the आए→[æ] verb-form monophthong variant, the
word-final य offglide the referee reads as a vowel). This is the Wu/Igbo/Naija 🔷 pattern but *measured* rather
than gold-anchored. Distinct from the ⛔ Awadhi/Bhojpuri stubs: those have no referee at all, whereas Maithili has
an independent (if small) human one — exactly the distinction the taxonomy is meant to track. Deferred: a larger
referee (none exists), the ultrashort-vs-deletion modelling (folded, not authored), the आए verb variants.
