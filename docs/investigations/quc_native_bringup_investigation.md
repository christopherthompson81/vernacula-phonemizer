# K'iche' (quc) native bring-up investigation

Target: **K'iche'** (Qatzijob'al), the largest **MAYAN** language (~1.1M, Guatemala),
Latin script (ALMG — Academia de Lenguas Mayas de Guatemala orthography), canonical IPA,
espeak-independent. The fleet's FIRST Mayan family.

## Run 1 — referee landscape

- **wikipron**: NONE (no quc). **epitran**: NONE (no quc-Latn). **kaikki**: NONE (only
  Yucatec exists for Mayan).
- **English Wiktionary**: the category "K'iche' terms with IPA pronunciation" has **128
  entries** → **127 with IPA** (HUMAN, `IPA|quc|`), pulled directly via the MediaWiki API
  (kaikki doesn't extract a K'iche' dictionary). The ONLY machine referee → 🔷 single-source.
- espeak ships an AUTHORED `quc` (not independent attestation).

ALMG orthography is near-1:1 PHONEMIC → a longest-match grapheme scan.

## Map mined from the Wiktionary referee

MAYAN hallmarks: the **EJECTIVE / glottalized series** ⟨b'⟩→[ɓ] (implosive), ⟨t'⟩→[tʼ],
⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ] (uvular), ⟨tz'⟩→[t͡sʼ], ⟨ch'⟩→[t͡ʃʼ]; and the **plain voiceless stops
are ASPIRATED** ⟨p t k q tz ch⟩→[pʰ tʰ kʰ qʰ t͡sʰ t͡ʃʰ] (allophonic, predictable → emitted).
Uvular ⟨q⟩→[qʰ]/⟨q'⟩→[qʼ]. Other: ⟨x⟩→[ʃ], ⟨j⟩→[x], ⟨w⟩→[ʋ], ⟨r⟩→[ɻ] (retroflex approx),
⟨y⟩→[j], plain ⟨b⟩→[ɓ] (K'iche' has only the implosive), ⟨'⟩ (glottal stop)→[ʔ]. Vowels
a e i o u; the SIXTH vowel ⟨ä⟩→[a] (central, short). **VOWEL LENGTH** (aː) is PHONEMIC but
UNWRITTEN in ALMG (the referee marks it, unpredictable from spelling) → NOT emitted, FOLDED
(backbone strips ː). FINAL stress (emitted; folded). Iterate the consonant/vowel skeleton
against the 127-pair referee in Run 2.

## Run 2 — engine + tuning

ALMG grapheme scan (longest-match: glottalized C+ʼ units, then aspirated affricates).
First pass **84.3% folded / 95.1% symbol**. Fixes: fold ASPIRATION ʰ (the plain stops
are aspirated but INCONSISTENTLY in the referee — chaj→t͡ʃ but achaq→t͡ʃʰ; the ejective ʼ
contrast is untouched), split multi-word phrases, ü/ö/ë/ï + accented vowels → base, fold
q'~ʛ. → **89.8% folded / 96.0% symbol.**

★ NEGATIVE (reverted): a word-initial glottal onset [ʔ] on vowel-initial words — the
referee OMITS it on the majority (ab→aːɓ, achi→aːt͡ʃʰiː) and marks it only on a handful
(ali→ʔaːliː, ikan→ʔikan), so prepending it categorically DROPPED the score 84→50%. The
initial glottal is inconsistent/lexical in the referee → not modelled (residual).

Residual (~13, all 1×) = Wiktionary ARTIFACTS (a few rows whose IPA doesn't match the
headword — achaq chʼimil shows the "amolo" pronunciation; the "(d)"/"(oq)" optional-
segment notation) + the inconsistent initial glottal + kyej→kʰeːx (ky). 🔷 single-source.
The ejective↔aspirated contrast (the Mayan hallmark) is verified correct on the goldens
(k'icheʼ→kʼit͡ʃʰeʔ, chʼaqabaʼ→t͡ʃʼaqʰaɓaʔ). Deferred: numbers, the lexical initial-glottal
+ vowel-length.

## Run 3 — 2-agent review

Core verified CORRECT (both reviewers): the ejective↔aspirated↔glottalized series, the
longest-match ordering (chʼ before ch), the standalone glottal ⟨'⟩→[ʔ], ⟨j⟩→[x], ⟨r⟩→[ɻ],
final stress, no-length, no-initial-glottal. Fixes:
- **Non-native consonants silently DROPPED** (Spanish loans: Dios→ios, ⟨d g f v z c⟩ lost).
  FIX: map the loan consonants (d→d g→ɡ f→f v→b z→s c→k; ⟨h⟩ stays a documented silent
  drop, Spanish convention). Dios→diˈos now.
- **⟨ä⟩ (the SIXTH vowel) → [ə]** (was [a]): with length folded, ä→a collapsed the a/ä
  contrast entirely. Emit the faithful central [ə] (restoring the contrast) and FOLD ə→a
  for the referee (which renders ä bare [a]) — the Ewe emit-faithful-fold-for-referee
  pattern. abäj→aˈɓəx.
- TOKEN regex: added the uppercase accented vowels (Ö Ü Ë Ï Á É Í Ó Ú) so a capitalized
  accented-initial word tokenizes.
Kept (folded, defensible): categorical aspiration on plain stops (allophonic, referee-
inconsistent). Deferred (dialectal/rare): the ⟨ky⟩ palatalized series (Nahualá), SIL
double-vowel long spellings. **89.8% folded / 96.1% symbol.** All repo tests pass.
