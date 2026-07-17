# Malagasy (mg) native bring-up

Malagasy / Malagasy — Standard/Official Malagasy (Merina-based), Austronesian (the westernmost branch — Madagascar),
~25M speakers, Latin script. A cleanroom rule g2p, espeak-independent.

## Data availability (checked up front)

- **wikipron mlg_latn broad** — 187 human words (PRIMARY). Small.
- **kaikki mg** — 201 human words (SECONDARY). Both are **Wiktionary-derived** — the same human source parsed
  twice (weak, same-source corroboration), not independent triangulation.
- **epitran** — no Malagasy.
- Both referees, despite the "broad" label, are very **narrow**: glottal-h [ʔ], retroflex affricates written with
  a plain stop (t͡ʂ/d͡ʐ), and — the decisive point — they **delete the weak final vowel**, realising it as
  labialisation ʷ / palatalisation ʲ / devoicing on the preceding consonant (vary→[varʲ], aholo→[aʔulʷ]).

→ **single-source (🔷)**: one substantial-but-narrow human source, no independent second.

## The rule core

Malagasy orthography is fairly shallow; the notable rules:

- **⟨o⟩ → /u/** — the signature Malagasy value (olona→ˈuluna, telo→ˈtelu, rano→ˈranu).
- **⟨y⟩ → /i/** (only word-final: vary→ˈvari, fotsy→ˈfutsi); the loan/diacritic **⟨ô⟩ → /o/**.
- **retroflex affricates ⟨tr⟩ → ʈʂ, ⟨dr⟩ → ɖʐ**; ⟨ts⟩ → ts; **⟨j⟩ → dz**.
- **prenasalized stops** ⟨mb mp nd nt ndr ntr nts ng nk nj⟩ → single segments ᵐb ᵐp ⁿd ⁿt ⁿɖʐ ⁿʈʂ ⁿts ᵑɡ ᵑk ⁿdz
  (place-matched superscript nasal), longest-match first (ndr beats nd/dr).
- **penultimate stress** (Malagasy default).
- Numbers compose **units-first** with the connector "amby" (21 → iraika amby roapolo; the unit 1 is iray alone
  but iraika in a compound).

## The load-bearing fold — weak final vowels (46% → 80.7%)

The referees **delete Malagasy's famous weak final vowels** (the unstressed final a/o/y), realising them as a
secondary articulation on the preceding consonant. Our **broad canonical transcription KEEPS them** — the correct
choice for a synthesis target (the reduction is register/context-dependent allophony the model can learn). This is
a keep-vs-delete *representation* difference the narrow referee cannot adjudicate, so every -y/-o word would fail
on that final vowel alone.

The fold **strips a word-final vowel from BOTH sides** (after the ʷ/ʲ folds expose the referee's deleted vowel),
plus the notational allophony (ʔ→h, retroflex ʈ/ɖ→t/d, tap/uvular ɾ/ʁ→r, lax ɛ→e, prenasalisation marks). This
takes the primary **46.0% → 80.7%** — i.e. **the 80.7% measures the verifiable core (consonants + o→u + stress),
NOT the final vowels**, which the referee deletes and so cannot verify either way. This fold-depth is load-bearing
and stated here and in the floor comment.

## Run — vs the two referees

**80.7% vs wikipron (core) / 73.1% vs kaikki (core).** On the verifiable core the two Wiktionary parsings
corroborate the distinctive Malagasy rules (o→u, retroflex tr/dr, prenasalized stops, penult stress). The residual
is proper nouns / loanwords (Antananarivo, Arzantina, anglisy), extreme casual reductions the referee records
(adana→[ad]), and glide/diphthong details (aiay, akio).

## Verdict — 🔷 Single-source verified

The distinctive segmental rules are corroborated on the verifiable core against a substantial (if small + narrow +
same-source) human referee. **Outstanding:** (1) the weak-final-vowel realisation is a documented broad-vs-narrow
choice, not verified by the referee; (2) diphthong glides (⟨ai⟩→[aj], ⟨ao⟩→[aw]) and loanword vowels (⟨o⟩→[ɔ] in
some borrowings) are a small tail; (3) Malagasy number sandhi has finer detail than the broad compositor models.
No independent (non-Wiktionary) referee exists to lift this past 🔷.
