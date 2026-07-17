# Hungarian (hu) native bring-up

Hungarian / magyar — Uralic (Finno-Ugric — a fresh family, not Indo-European), ~17M speakers, Latin script. A
cleanroom regular longest-match g2p, espeak-independent.

## Data availability (checked up front)

- **wikipron hun_latn narrow** — 64,286 human words (PRIMARY). Large; a narrow transcription (marks length,
  assimilation, h-voicing).
- **epitran hun-Latn** — programmatic (SECONDARY, INDEPENDENT). Two independent referees.

## The rule core — a regular, digraph-rich orthography

Hungarian spelling is deep-ish but *regular*, so the g2p is a longest-match scan over a rule table (trigraphs /
geminate-digraphs / digraphs before single letters). The signature points:

- **⟨s⟩→[ʃ] but ⟨sz⟩→[s]** — the reverse of the naive reading (szív→[siːv], és→[eːʃ]); ⟨zs⟩→[ʒ], ⟨z⟩→[z].
- **⟨gy⟩→[ɟ]**, **⟨ty⟩→[c]** (palatal stops), **⟨ny⟩→[ɲ]**, **⟨ly⟩→[j]** (merged with ⟨j⟩); ⟨cs⟩→[t͡ʃ], ⟨c⟩→[t͡s].
- **⟨a⟩→[ɒ]**, and the full 14-vowel long/short + front/back-round system (á→aː, ö→ø, ő→øː, ü→y, ű→yː, …).
- **Gemination**: a geminate digraph doubles the *first* letter (ssz→[sː], ggy→[ɟː], nny→[ɲː]); a doubled single
  consonant → [Cː] (jj→[jː]).
- **FIXED first-syllable stress** (Hungarian) — the ˈ precedes the word onset.

## The assimilations — real Hungarian phonology (the big lever)

The narrow human referee marks Hungarian's productive assimilations, and implementing them was the difference
between 77.6% and 91.3%:

- **REGRESSIVE voicing assimilation** (+12.5pp) — an obstruent takes the voicing of a following obstruent:
  biztat→[bistɒt] (z→s before t), lég·szivattyú→[leːk…] (ɡ→k before s), vas·golyó→[vaʒɡ…] (ʃ→ʒ before ɡ). Applied
  right-to-left so clusters propagate; /v/ and /h/ are excluded as triggers (v devoices but doesn't voice a
  preceding). **epitran does NOT model this**, which is why its secondary number (87.6%) is *lower* than the human
  wikipron (91.3%) against our now-correct output — the naive referee, not us.
- **j-palatalization** — a coronal d/t/n/l + ⟨j⟩ → a long palatal (feddj→[fɛɟː], adj→[ɒɟː]) — the productive
  imperative/3sg assimilation, a large verb-form class.
- **Nasal place assimilation** — /n/→[ŋ] before k/ɡ (hang→[hɒŋɡ]).

## Run — vs the two referees

**91.3% vs wikipron / 87.6% vs epitran.** Two independent referees; the human wikipron is the authoritative one and
it confirms the assimilations. Folds are the two allophonic layers we don't emit: ⟨h⟩→[ɦ] (voiced between vowels)
and the predictable hiatus [j]-glide (biblia→[biblijɒ]). The residual is: the ⟨szs⟩→[ʃː] sibilant assimilation
(egészség — a place+voicing assimilation we don't special-case), the final-⟨h⟩ drop (Cseh→[t͡ʃɛ]), some v-cluster
edge cases, and proper nouns.

## Verdict — ✅ Reliable

A regular orthography with the productive assimilations modeled, verified against two independent referees (the
human at 91.3%). Numbers (one-word compounds, huszon-/tizen- bound tens, 2→két before a scale) are done.
**Outstanding:** the ⟨szs⟩ sibilant assimilation + final-h-drop (small lexical/assimilation tails); Hungarian
vowel harmony is *already in the spelling* (suffixes are written with their harmonic vowel), so it needs no
modeling.
