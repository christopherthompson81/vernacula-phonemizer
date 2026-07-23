# Hebrew (he) native bring-up investigation

Modern Hebrew — Afro-Asiatic (Semitic), the Hebrew **abjad**, ~9M speakers, Israel. Like Arabic, Hebrew is normally
written **unvocalized** (consonants only; the niqqud vowel points are omitted in everyday text), so the full problem
is **vowel restoration**. The bring-up is phased like Arabic: PHASE 1 = the deterministic niqqud→IPA g2p on
VOCALIZED (pointed) input; PHASE 2 = a neural nakdan that restores the niqqud for bare consonantal text (deferred).

## Run 1 — 2026-07-23 — Phase-1 niqqud→IPA g2p, 87.1% folded (2561 words)

**Referee.** en.wiktionary Hebrew headwords are UNVOCALIZED (0/3394 carry niqqud) — so the raw category can't
grade a niqqud g2p. But each ==Hebrew== entry ALSO carries (a) the **vocalized citation form** in its headword
`wv=` param and (b) the **Modern Israeli IPA** in the `{{IPA|he|/…/|a=IL}}` tag (vs the Tiberian/Biblical reading
some entries also list). `tools/hebrew/build_g2p_referee.py` pairs those (reading the batched build-referee.ts
cache) → **2561 clean (vocalized-form, Modern-IPA) pairs** (3189/3394 IL-tagged). This grades the Phase-1 segmental
g2p directly, independent of restoration.

**Engine** (`src/languages/hebrew/`): a stateful scan — each consonant gathers its trailing points (dagesh,
shin/sin dot, a vowel) and resolves them:
- **bgdkpt dagesh split** (the only bgdkpt residue in Modern Hebrew): בּ→b / ב→v, כּ→k / כ→χ, פּ→p / פ→f; גדת lost
  the split → always ɡ/d/t. ⟨ש⟩ shin-dot→ʃ / sin-dot→s. ⟨ר⟩→ʁ, ⟨ח⟩/⟨כ⟩→χ, ⟨צ⟩→t͡s, ⟨ק⟩→k.
- **⟨ו⟩ vav specials**: shuruk וּ→[u], holam male וֹ→[o], else consonant [v].
- **mater lectionis / quiescent**: silent final ⟨ה⟩ (mater/mappiq), quiescent ⟨א⟩; ⟨י⟩ is a SILENT mater only as a
  hiriq/tsere male (after [i]/[e]) — ELSEWHERE a consonant/glide [j] (onset יוּם→jum, offglide אֲבוֹי→avoj).
- **patach genuvah**: a word-final guttural ח/ע/ה with patach surfaces the [a] BEFORE the consonant (מָשִׁיחַ→maʃiaχ).
- **⟨א⟩/⟨ע⟩ = ʔ** (emitted; the referee marks it optional (ʔ) → folded, Modern Hebrew drops it variably).

**Result:** 81.1% first pass → **87.1% folded** after the notation folds (stress unwritten; variable glottal ʔ;
velar-nasal ŋ~n; resh ʁ~r~ʀ; the referee's optional (ʔ)(h)(ʕ) unwrapped, (e)/(j) dropped). Spot-checks all correct:
אֲבַטִּיחַ→ʔavatiaχ, שָׁלוֹם→ʃalom, מָשִׁיחַ→maʃiaχ, בַּיִת→bajit, יְרוּשָׁלַיִם→jʁuʃalajim, סֵפֶר→sefeʁ.

**SHEVA-NA is the residual ceiling.** The sheva ְ is na (→[e]) or nach (→∅), and Modern Hebrew ELIDES it pervasively
(clusters/loanwords: astʁo, anɡli, aleksandʁija — all silent), while native words realise it (begadol, aʃkelon).
Every simple pointing-only rule tried — word-initial→e, second-of-two-shevas→e — NET-HURT (loanword clusters
outnumber native na, and the referee marks realised sheva optional (e) which the paren-fold already drops). So
sheva→∅ is the best pointing-only choice; the realised-na tail needs MORPHOLOGY (native prefix vs loanword) →
deferred to Phase 2 (with the nakdan). Other residuals: Tiberian-convention leakage (ɔ/θ/ː) in the few entries with
no a=IL tag, and per-loanword vocalization ambiguity.

**Verdict 🔵🔷** — in-development (Phase 1 segmental core only; unvocalized restoration is the big deferred piece,
so the SHIPPED phonemizer currently needs vocalized input) + single-source (Wiktionary a=IL). Numbers deferred.
Tooling: the referee reused the new `tools/corpus/build-referee.ts` cache. Next: Phase 2 (a Hebrew nakdan — the
Arabic-diacritizer analogue) + the sheva-na morphology it unlocks.
