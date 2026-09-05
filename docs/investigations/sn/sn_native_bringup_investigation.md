# Shona (sn) native bring-up

Bantu (Guthrie S10), Standard Shona (Zezuru-based), the Latin orthography.
Cleanroom canonical-IPA rule g2p, espeak-independent. Referee: **epitran sna-Latn
only** (programmatic, INDEPENDENT) — the single substantial Shona pronunciation
source → 🔷 single-source.

## Run 0 — 2026-07-17 — data check

- **wikipron**: no Shona (`sna_latn_*` all 404/empty).
- **kaikki Shona**: 529 entries but only ~20 with IPA — too few for a referee.
- **epitran `sna-Latn`**: works (mhuri→m̤uri). The only usable referee.

So the referee is epitran (rule-based, independent of our engine). I took the 447
single-word lowercase headwords from the kaikki Shona dump as the wordlist and ran
epitran over them to build `sn.epitran-sna.tsv`. This measures rule-AGREEMENT with
an independent g2p — a regression guard, not a human gold. → 🔷 single-source.

epitran's naiveties (probed up front, cross-checked against the grammar):
- ⟨b⟩→[b], ⟨d⟩→[d] — but the grammar (Wikipedia Shona phonology; Doke) has the
  plain letters as IMPLOSIVES [ɓ]/[ɗ], with ⟨bh⟩/⟨dh⟩ the breathy [b̤]/[d̤].
- ⟨sv⟩→[sʷ], ⟨zv⟩→[zʷ] — labialised, but these are the famous WHISTLED sibilants
  ([ȿ]/[ɀ]). epitran even ships ⟨ȿ ɀ⟩ as dictionary headwords (dropped — they're
  IPA symbols, not Shona words).
- prenasalisation as full nasals (nd, ŋɡ) rather than a superscript unit.

Decision (per the explicitness principle): render the grammar-correct/explicit
forms (ɓ ɗ, ȿ ɀ, ᵐb ⁿd ᵑɡ) and FOLD to epitran's naive forms in the eval config.
The backbone already strips the breathy mark ̤ (U+0324) and tie bars, so ⟨bh⟩=b̤→b
and the affricates fold for free.

## Run 1 — 2026-07-17 — first compile: 96.0%

A pure greedy longest-match scan over the grapheme table (no syllabification —
Shona is open-CV with the prenasal cluster as one onset). Two residual classes:

1. **⟨nh⟩** — chinhu→ours [t͡ʃin̤u] vs epitran [t͡ʃinhu]. epitran has ⟨mh⟩→m̤ but
   LACKS the parallel ⟨nh⟩→n̤ rule (emits a literal n+h). Ours is correct per the
   grammar; folded epitran's spurious h (ours never emits a literal ⟨nh⟩ substring).
2. **junk headwords** — ⟨ȿ ɀ tȿ dɀ⟩, IPA symbols not words → dropped (443 left).

## Run 2 — 2026-07-17 — 99.3%

After the ⟨nh⟩ fold + cleanup: **440/443 (99.3%)**. Remaining 3:
- `muzvcazi` — a source typo (`zvc` is not valid Shona); ours drops the stray c.
- `mvura`, `mvuu` — ⟨mv⟩: ours [ᶬʋ] (prenasalised labiodental + approximant, per
  the grammar) vs epitran [mʷ] (drops the v, adds labialisation). **Ours is more
  correct**; left as an honest residual rather than folded away.

## Result

- epitran sna-Latn: **99.3%** (440/443). Floor 0.96. → 🔷 single-source.

Verified signatures (spot-checked): ɓaɓa vs b̤azi, ɗoᵐbo vs d̤orob̤a, m̤uri, n̤ema,
ȿoⁿdo, ɀino, t͡ȿiᵐbo, ⁿdeɡe, ᵑɡa, d͡ziᵐba, b͡vuⁿza, ɲika, ʃamwari, p͡fumo; and the
ng'/ng contrast: ng'ombe→[ŋoᵐbe] vs nanga→[naᵑɡa].

**Deferred:** Shona tone (H/L, phonemic but unwritten — the standard orthography
marks no tone) and the noun-class **number concord** (20 = makumi *maviri*; our
composer uses the bare unit *piri*). Numbers are unmeasured (the referee is
word-only). No independent second source exists to lift this beyond 🔷.
