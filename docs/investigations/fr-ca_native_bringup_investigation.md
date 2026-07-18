# Québécois French (fr-CA) native bring-up — and why "African French" is NOT built

## Two things, not one

The prompt paired "Québécois / African French". These are **two genuinely different things**, and only one is a
buildable accent variant:

- **Québécois French (fr-CA)** — Canadian/Quebec French, ~7M native speakers. A **well-defined variety** with a
  small set of systematic, rule-expressible features (affrication, high-vowel laxing). Buildable as a post-process,
  the es-419/en-IN pattern. **Built here.**
- **"African French"** — ~120M speakers, but **NOT a single phonology**. It is a cover term for dozens of national
  varieties (Senegalese, Ivorian, Cameroonian, Congolese, Maghrebi, …) whose realisations are driven by *different*
  substrate languages (Wolof, Bambara, Lingala, Arabic, …) and often conflict (e.g. front-rounded /y ø œ/ are kept
  in some, merged to /i e/ in others; /ʁ/ is apical [r] in many but not all). There is **no single target and no
  referee**. Building one "fr-AF" phonemizer would be a fiction — the analogue of trying to build a single "African
  English". **Deliberately NOT built.** If a specific national standard is wanted later, it must be picked and
  sourced individually (a describable phonology + ideally a corpus), not lumped.

Neither is a FLEURS training locale (FLEURS French is `fr_fr`), so this is accent **coverage** for the universal
model, not training-audio labelling.

## The Québécois delta (France French → fr-CA)

Sourced from Walker 1984, *The Pronunciation of Canadian French*, and Côté 2012. Two signature features carry it,
both context-sensitive surface remaps on the France-French `fr` output (`toQuebecois()`), plus final-/a/ backing:

1. **Affrication** (the signature): /t d/ → [t͡s d͡z] before the high FRONT vowels /i y/ and the glides /j ɥ/
   (tu→t͡sy, dire→d͡ziʁ, tuile→t͡sɥil, dimanche→d͡zimɑ̃ʃ). NOT before back /u/ (tout→tu). Implemented as
   `t(?=[ˈˌ]?[iyɥj])→t͡s` (skips an intervening stress mark).
2. **High-vowel laxing**: /i y u/ → [ɪ ʏ ʊ] in a **closed** syllable, UNLESS the coda is a "lengthening" consonant
   /ʁ v z ʒ/ (which keeps the vowel tense/long). petite→pt͡sɪt, six→sɪs, jupe→ʒʏp, route→ʁʊt; but dire→d͡ziʁ,
   musique→myzik stay tense. Open syllables keep the tense vowel (petit→pt͡si). Implemented as a lookahead: high
   vowel + a non-lengthening coda consonant that is NOT a syllable onset.
3. **Word-final /a/ → [ɑ]** (posterior): Canada→kanadɑ.

### The one interaction bug (and the fix)

Affrication and laxing interact. Affrication runs FIRST (it needs the underlying /i y/ before laxing rewrites them
to /ɪ ʏ/). But then the new affricate `t͡s` fooled the laxing lookahead: in politique→pɔlit͡sik, the first ⟨i⟩ is
followed by `t` then the tie U+0361, and the naïve "coda" test (consonant not followed by a vowel) treated that `t`
as a coda → wrongly laxed the first ⟨i⟩. Fix: add the tie U+0361 to the laxing lookahead's "onset" exclusion class,
so a consonant followed by the tie is recognised as an affricate ONSET, not a coda. politique→pɔlit͡sɪk (only the
final closed ⟨ik⟩ laxes). Verified across difficile→d͡zifisɪl, stupide→st͡sypɪd, musique→myzik.

## Verification

No fr-CA pronunciation corpus exists (wikipron/kaikki French is France French; epitran has no fr-CA), so — as for
en-GB/en-IN — the anchor is a **25-word hand-adjudicated diagnostic gold** (`french-ca.test.ts`), one group per
feature, adjudicated from the cited phonology. All pass. Context-free delta → no circularity (shipped == rule path).

Sample: tu→t͡sy, petite→pət͡sɪt, dire→d͡ziʁ, route→ʁʊt, habitude→abit͡sʏd, stupide→st͡sypɪd, politique→pɔlit͡sɪk.

## Deferred (fine-grained, variable, no referee)

- **Nasal-vowel shifts** — /ɛ̃/→[ẽ]~[ẽɪ̯̃], /ɔ̃/→[õ], /ɑ̃/→[ã]~[aɔ̯̃] (/œ̃/ retained, already shared with the France
  engine). Diphthongal and register-variable; kept as the France nasals.
- **Long-vowel diphthongisation** in closed stressed syllables — père→[paɛ̯ʁ], fête→[faɪ̯t]. A distinctive QF trait
  but highly variable and hard to bound without a referee.
- **/ɑ/–/a/ lexical distinction** — pâte [pɑːt] vs patte [pat]. The France engine merges them (both [pat]), so the
  distinction is unrecoverable from its output (a lexical, not rule, split — the en-GB BATH problem).

## Status: 🟡 accent variant — diagnostic-gold-anchored

The two loud, categorical, won't-infer QF features (affrication, laxing) + final-/a/ backing are shipped and
gold-verified. The residual is the fine vowel-quality/diphthongisation tail, which is referee-blocked.
