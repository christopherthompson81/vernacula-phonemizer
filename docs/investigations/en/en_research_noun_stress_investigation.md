# en: does the NOUN `research` take initial stress?

Issue #1280. The lexicon had only the final-stressed reading for `research`, while `researcher` and
`researchers` — nouns off the same stem — carried initial stress. The issue proposed a POS-gated heteronym
and explicitly asked for it to be checked "against the referee and by ear before landing", noting that the
distinction is stronger in some varieties than others.

## Run 1 — 2026-09-11 18:05 — the dictionaries do not settle it

```
our lexicon   research R IY0 S ER1 CH   ɹisˈɝt͡ʃ        researcher R IY1 S ER0 CH ER0  ɹˈiːsɚt͡ʃɚ
espeak-ng     research ɹᵻsˈɜːtʃ          researcher ɹᵻsˈɜːtʃɚ          ← FINAL for both
en-US referee no rows for research / researches / researcher
en-GB referee researcher ɹiːsɜːt͡ʃə · ɹɪsɜːt͡ʃə   (BOTH)    researches ɹɪsɜːt͡ʃɪz
Merriam-Webster  noun \ri-ˈsərch, ˈrē-ˌsərch\  — the FINAL-stressed noun listed FIRST
```

⚠ **This is the shape that usually ends in "leave it alone."** Both readings are real, the US referee has
no coverage, the UK referee attests both for the derived noun, espeak makes no noun/verb distinction at
all, and M-W lists the final-stressed noun first. The house rule for that situation is to take the
news-anchor reading — and nothing above says which one that is.

⚠ **It also contradicts the issue's central argument.** The report leans on `researcher` being
initial-stressed as internal evidence that the bare noun should be too; espeak says `researcher` is
FINAL-stressed, so that row is not the settled fact the argument treats it as.

## Run 2 — 2026-09-11 18:06 — the instrument that does witness register

`/mnt/data/omnivoice_ipa/work/asr_align/align.sqlite` holds what wav2vec2 actually heard on the FLEURS
recordings. It is the one instrument here that hears a speaker rather than reading a convention, and the
two candidate readings are separable in its output without any stress mark: the prefix is either the full
FLEECE vowel (`ɹ iː`, initial stress) or a reduced one (`ɹ ɪ` / `ɹ ə`, final stress).

Every en_us utterance containing the stem:

```
…therefore it narrows the | research     → ɹ iː s ɚ tʃ     INITIAL
…cautioned that the       | research     → ɹ iː s ɚ tʃ     INITIAL
…a medical doctor and     | research     → ɹ iː s ɚ tʃ     INITIAL   (research scientist)
                          | Research     → ɹ iː s ɚ tʃ     INITIAL   (sentence-initial, ×2)
…The / Lead               | researchers  → ɹ iː s ɚ tʃ     INITIAL   (×4)
…said                     | researcher   → ɹ iː s ɚ tʃ     INITIAL   (×4)

initial-stress: 14        final-stress: 0
```

**14 of 14, zero counterexamples**, and the unambiguous noun slots — `the research` twice — are among them.
That settles what the dictionaries could not, and it settles it against espeak.

⚠ **espeak is a reference for ALIGNMENT, not an oracle for register.** It is the right instrument for
#1268's money reading and the wrong one here; where recordings exist they outrank it.

## The change

```
"research": { "default": "ɹˈiːsɚt͡ʃ", "verb": "ɹisˈɝt͡ʃ" }
```

`default` is the noun reading because that is what the corpus attests and what unknown-POS text will most
often be. The verb keeps the final-stressed form — ⚠ **and that half rests on the dictionaries alone**: the
corpus contains no verb instance, so it is unverified by the instrument that decided the other half.

Heteronyms win over the flat lexicon, so no lexicon row changes. The `-es` form inherits the gate
(`he researches it` → final, `the researches were` → initial), and `researcher`/`researchers` were already
initial-stressed — the internal contradiction the report identified, now resolved in the attested direction.

## ⚠ Known limit: en-GB inherits this

`en-GB` is an accent delta over the `en` engine and shares the heteronyms block, and the corpus has **zero
en_gb rows** for this stem. BrE leans final-stressed for both parts of speech, so the noun reading here is
the American one applied to both varieties. The only mitigation in the evidence is that the UK referee
lists initial-stressed `researcher` (`ɹiːsɜːt͡ʃə`) FIRST of its two variants, so initial stress is not
foreign to the variety. Recorded in the jsonc beside the entry; revisit if en_gb audio lands.
