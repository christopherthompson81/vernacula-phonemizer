# Zhuang (za) native bring-up

Tai-Kadai (Kra-Dai), Standard Zhuang / Vahcuengh (Wuming dialect basis), the 1982
Latin orthography. Cleanroom canonical-IPA rule g2p, espeak-independent — a fresh
family for the fleet. Referees: wikipron `zha_latn` broad (PRIMARY, HUMAN, 1682) +
kaikki `za` (SECONDARY, HUMAN, 1709), both Wiktionary-derived (same-source, a
breadth caveat → 🔷 single-source). The eval is SEGMENTAL: the backbone strips the
Chao tone letters (˥˦˧˨˩) + length ː, so tones + length fold.

## Run 1 — 2026-07-17 — first compile

Built the manifest (`zhuang.jsonc`) + scanner (`zhuang.ts`) from the Standard
Zhuang orthography: the pinyin-style stops (⟨b d g⟩ = unaspirated /p t k/, ⟨p t
k⟩ aspirated), implosives ⟨mb⟩→ɓ/⟨nd⟩→ɗ, fricatives ⟨s⟩→θ/⟨r⟩→ɣ/⟨c⟩→ɕ/⟨v⟩→β,
and the syllable-final tone letters (⟨z j x q h⟩ = tones 2–6, none = tone 1, a
p/t/k coda = checked). ⟨z x q j⟩ are never onsets; ⟨h⟩ is an onset before a vowel
and tone-6 otherwise.

    npx tsx tools/referee-eval/eval.ts za
    → wikipron 82.9%, kaikki 38.8% (segmental)

Two problems. Residual inspection surfaced two systematic orthographic rules I'd
missed, plus a kaikki format mismatch.

## Run 2 — 2026-07-17 — the two orthographic rules

Reading the wikipron residuals:

- **⟨e⟩ is a silent nucleus-marker after a high vowel** — cieng→[ɕiːŋ] (not
  ɕiːeŋ), suen→[θuːn], rwed→[ɣɯt]. I.e. ⟨ie⟩→[iː], ⟨ue⟩→[uː], ⟨we⟩→[ɯ]. Added to
  `vowelDigraphs`.
- **⟨ae⟩ is context-sensitive** — [ai] in an OPEN syllable (bae→[pai],
  sae→[θai], gyae→[kʲai]) but short [a] before a CODA (caet→[ɕat], haemh→[ham]).
  Handled inline in the scanner (a coda-lookahead), NOT as a fixed digraph.

Also: coda stops must be PLAIN (bak→[paːk], not paːkʰ — Zhuang codas never
aspirate; only onset p/t/k aspirate) and coda ⟨ng⟩→[ŋ] (mwngz→[mɯŋ]). Both fixed
in the scanner (a `CODA` map + a coda-⟨ng⟩ branch).

    → wikipron 97.4%

## Run 3 — 2026-07-17 — the kaikki 38.8%

kaikki was low despite confirming individual words. The residual dump showed it:
kaikki marks **syllable boundaries with a dot** (minzcuj → `min˧˩.ɕu˥`), which the
backbone doesn't strip. Added a preFold-agnostic fold `\.`→"".

    → kaikki 97.8%

## Result

- wikipron `zha_latn` broad: **97.4%** (1638/1682) — PRIMARY, HUMAN
- kaikki `za`: **97.8%** (1671/1709) — SECONDARY, HUMAN

Both Wiktionary-derived (same-source) → **🔷 single-source verified**. A clean
~97.5% with no load-bearing segmental fold (unlike Malagasy). Floor 0.94.

**Segmental only.** The eval backbone strips the Chao tone letters + length, so
the tone system — deterministic from the orthographic tone letters, rendered in
the output — is not measured here. A measured tone-accuracy check and the finer
checked-tone height split (55/35/33 by the coda + vowel length) are the
outstanding work.

Numbers: decimal, tens = unit+cib (ngeih cib = 20), hundreds/thousands multiply;
covered 0 … <10⁶, digit-by-digit above.
