# Spanish (es) native bring-up — investigation

Fourth native language. Shallow-orthography, rule-based (no lexicon) — closest to a clean g2p engine.
Sole census provider of β ʎ ʝ.

## Target convention: BROAD CASTILIAN
From the espeak 1.52 shim (validated) minus espeak's idiosyncratic vowel laxing:
- distinción: c(before e/i)/z → θ ; lleísmo: ll → ʎ, y → ʝ ; j / g(before e/i) → x
- spirantization: b/v,d,g → β,ð,ɣ EXCEPT word-initial / after nasal (d also after l) → stops b,d,ɡ
- rr → r (trill), r → ɾ (tap) but word-initial / after n,l,s → r ; ñ → ɲ ; ch → t͡ʃ ; qu/gu(e,i) → k/ɡ (u silent)
- güe/güi → gw ; x → ks ; h silent ; glides i/u → j/w
- FOLDED: espeak's e→ɛ / o→ɔ closed-syllable laxing → plain e/o (allophonic, not in broad referees, espeak-idiosyncratic)
- Stress: written accent > (ends in vowel/n/s → penult; else final). ˈ before the stressed nucleus.

## Referees
- epitran spa-Latn: LatAm broad (SESEO s, YEÍSMO ʝ, NO spirantization) — differs on 3 DIALECT features;
  fold θ↔s, ʎ↔ʝ, β↔b, ð↔d, ɣ↔g when validating.
- wikipron spa: not cached (fetch if needed).
- shim canonical ref: /tmp/es_canonical_ref.tsv (3000 words) — regression target (fold ɛ→e, ɔ→o).

## Plan
1. g2p engine (grapheme→phoneme context rules + glides) + spirantization + syllable/stress.
2. Validate vs shim ref (folded) + epitran (dialect-folded).
3. Numbers. 4. Register, tests, PR.

## Results — Phase 1 complete

Rule-based g2p (g2p.ts: scan + glides) + spirantization + syllable/stress (spanish.ts) + numbers.ts + text()
routing (words / numbers / punctuation, function-word de-accenting). NO lexicon, NO data files — pure rules.

VALIDATION (tools/es-ref-sweep.mts; ref = /tmp/es_canonical_ref.tsv from the espeak 1.52 canonical engine):
- vs shim (folded ɛ→e, ɔ→o, ŋ→n, drop ˌ): 93.5% (2804/3000). Residual = espeak quirks where OURS is more
  standard: word-final d→ð and d-after-l→d (Navarro Tomás), diphthong-over-hiatus (luego→lweɣo), ɣ before
  consonant; plus -mente double stress (deferred), foreign words, abbreviation expansion (out of scope).
- vs epitran spa-Latn (dialect-folded θ↔s, ʎ↔ʝ, β↔b, ð↔d, ɣ↔ɡ): 95.8% (479/500). Residual = epitran errors
  (word-initial ɾ instead of trill, y→i instead of ʝ), not ours.

CONVENTION DECISIONS (all referee-aligned, folding espeak's narrow allophony):
- broad Castilian: distinción θ, lleísmo ʎ/ʝ, spirantization β ð ɣ (provides census gaps β ʎ ʝ).
- FOLDED to broad: e→ɛ / o→ɔ laxing, nasal place assimilation (n→ŋ/m), heuristic secondary stress ˌ.
- offglides ᶦ/ᶷ (after nucleus), onglides j/w — matches espeak's dominant form + our cmn convention.
- function words (monosyllabic clitics) de-accented in running text.

DEFERRED: -mente adverb double stress; sentence nuclear-tonic; decimal reading detail; C# mirror.
