# Bavarian (bar) native bring-up — investigation

Boarisch, Upper German (Austro-Bavarian), ~14M speakers (Bavaria / Austria / South Tyrol), Latin script.
The user asked to bring it up **"check if possible"** — the feasibility gate was the crux, because Bavarian has
**no codified state orthography** (it's a spoken dialect continuum written ad hoc). Answer: **possible**, because the
Bavarian Wikipedia / Wiktionary uses a de-facto German-derived convention (⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩), and
that convention is exactly what the wikipron referee transcribes — so the g2p is well-defined *against that referee*.

## Run 1 — 2026-07-26 — feasibility probe

- **Q:** Is there a referee, and is the orthography consistent enough for a g2p?
- **Commands:** `curl` wikipron `bar_latn_broad` (1780 rows / **1380 unique headwords**), kaikki Bavarian (200 OK).
  Inspected the orthography inventory (⟨å⟩ 351×, ⟨ä ö ü é ß⟩ present) and the phone inventory.
- **Finding:** A real 1380-headword human referee exists (NOT a Rangpuri-style data desert). BUT it is a **narrow**
  transcription: lenis under-ring (b̥ d̥ ɡ̥), fine vowel qualities (ɑ/a/ɒ/ɛ/e̞), r-vocalization (ɐ̯ 259×), syllabic
  consonants (n̩ l̩), and **~1.29 pronunciation variants/headword** (dialect + narrowness).
- **Implies:** possible, but an Afrikaans-tier target — pick the central realization, credit-any via variant-merge
  (honest here: the variants differ on already-hard-to-predict dialect vowel-quality axes), heavy folding + the
  backbone strip of combining marks. Modeled the engine on the Luxembourgish greedy-scan Germanic template.

## Run 2 — engine build + the measure-and-fold loop

Greedy longest-match grapheme scan (`bavarian.jsonc` manifest) + code rules (`bavarian.ts`). Iterated against the eval:

| step | change | folded | symbol |
|------|--------|--------|--------|
| first pass | table + falling diphthongs ⟨ia ua oa⟩, ⟨ei au⟩, r-vocalization, ch split | 34.1% | 79.8% |
| lenition | **⟨t⟩→[d̥], ⟨p⟩→[b̥]** in the manifest + strip aspiration ʰ | 43.2% | 84.5% |
| coda rules | post-vocalic ⟨h⟩ silent, ⟨oi⟩→[oe], final ⟨-a⟩→[ɐ], ⟨k⟩→[ɡ̥] before a liquid | 53.3% | 87.3% |
| coalescence | word-final ⟨gn⟩→[ŋ], unstressed ⟨er⟩+C→[ɐ] (stressed keeps [eɐ̯]) | 58.0% | 89.2% |
| k-lenition | non-initial ⟨k⟩→[ɡ̥], ⟨tsch⟩→[d̥ʃ] | **60.4%** | **89.8%** |

**★ The story was the FORTIS/LENIS NEUTRALIZATION.** The first pass mapped ⟨p t k⟩→fortis [p t k] and ⟨b d g⟩→lenis
[b̥ d̥ ɡ̥] (the naïve German assumption). The referee showed the opposite: orthographic ⟨t⟩ surfaces as lenis **[d̥]**
near-categorically (385×: Taag→d̥aːɡ̥, Tand→d̥and̥), ⟨p⟩→**[b̥]** (Panier→b̥…), and ⟨k⟩→**[ɡ̥]** everywhere except a
word-initial prevocalic onset (Klass→ɡ̥lɑs, Dackn→…ɡ̥…). This is the well-known Austro-Bavarian **loss of the
fortis/lenis stop contrast** (neutralized to lenis). It belongs in the **engine** (emit the lenis realization), NOT a
fold — folding the voicing pairs would have inflated the number by merging a genuine contrast. That single insight
was +9pp folded / +4.7pp symbol.

Other real Bavarian rules mined from the residual sweep (each verified across its whole letter-class, per the
Rangpuri "don't infer a rule from one word" lesson): post-vocalic ⟨h⟩ silent (a length marker: Fruah→fruɐ̯,
Fühn→fyn); the falling diphthong ⟨oi⟩→[oe] (l-vocalization: Foi→foe); final unstressed ⟨-a⟩→[ɐ] (Bana→b̥ɑnɐ);
word-final ⟨gn⟩→[ŋ] (Regn→reŋ, Segn→seŋ); unstressed ⟨er⟩+C→[ɐ] but STRESSED ⟨er⟩ keeps [eɐ̯] (Glumpert→…bɐt vs
Bersch→b̥e̞ɐ̯ʃ — gated on "not the first vowel").

## Run 3 — stopping point + honest framing

Stopped at **60.4% folded / 89.9% symbol**. The remaining residual is genuinely fine-grained (no systematic class
left): narrow syllabic-nasal quality (ɱ̩ ɴ̩), the ⟨tz⟩ [t͡s]~[d̥s] split, unstressed-vowel reduction in closed final
syllables (⟨-an⟩→[-ɐn]), and inherent dialect vowel-quality variation the single g2p can't track across sub-dialects.
The 89.9% symbol accuracy is the honest headline: **the segments are essentially right; the folded number is dragged
by the narrow-transcription dialect spread**, not by engine errors. This is an Afrikaans-tier bring-up (af was 71.2%
on a shallower referee) — **🔷 single-source**, no-standard-orthography dialect continuum.

**Folds** (harmonize what the backbone does NOT strip): the vowel-quality spread the dialect variation opens up
(ɑ~a~ɒ→a, ɛ~e→e, ɔ~o→o, ɪ~i, ʊ~u, œ~ø), the rhotic (ʁ~ʀ→r), the labial approximant/fricative (ʋ~v~β→v), coda [ɫ]→l,
[χ]→x, and aspiration (kʰ→k). Vowel LENGTH, prosody/stress, and numbers are deferred.

**Deferred:** numbers; a stress model; the syllabic-consonant quality (ɱ̩/ɴ̩); a kaikki 2nd referee; closed-syllable
unstressed-vowel reduction.

## Run 4 — 2-agent review fixes

Two independent reviewers (a correctness pass on the engine + an honesty/consistency pass on the eval + surfaces).

- **Correctness — a real rule-ordering bug.** `lenitK` (⟨k⟩→[ɡ̥] non-initially) ran *before* `coalesceGN` and
  `degeminate`, so the lenited [ɡ̥] fed the wrong rules: a word ending in ⟨ckn⟩/⟨kn⟩ spuriously nasalized
  (Dackn→d̥ɑ**ŋ**, Fläckn→flɛ**ŋ**) because `coalesceGN` can't tell a genuine ⟨g⟩→[ɡ̥] from a lenited ⟨k⟩→[ɡ̥].
  **Fix:** run `degeminate` + `coalesceGN` **before** `lenitK` — gemination collapses while both stops are still
  identical, and ⟨gn⟩-coalescence sees only a genuine ⟨g⟩. Now Dackn→d̥ɑɡ̥n, Fläckn→flɛɡ̥n, while the genuine
  ⟨gn⟩ words (Regn→reŋ, Segn→seŋ) still coalesce correctly. Symbol accuracy 89.8→**89.9%**; folded unchanged (60.4%
  — those words were already missing on the narrow ɴ̩ syllabic-nasal quality, so the fix is a partial-credit gain,
  not a new whole-word match). Also mapped the stray ⟨â⟩ grapheme (was in the TOKEN regex but not the table → silent
  drop) and corrected a stale `velarNasal` comment.
- **Honesty — clean, no defects.** The reviewer confirmed the 14 folds are all standard narrow-referee-vs-phonemic
  harmonizations (the lax/tense folds merge only vowel QUALITY; length ː stays contrastive), that the **fortis/lenis
  neutralization was correctly put in the engine and NOT folded** (grep-confirmed: no t↔d / k↔g fold — the
  anti-inflation choice, which would have been the +9pp shortcut), and that all surfaces agree on 60.4% / 89.9% /
  1380. The one optional note — the "Afrikaans-tier" label (bar's 60.4% folded is ~11pp below af's 71.2%, the tiering
  leans on the higher symbol acc + the "af on a shallower referee" caveat) — was judged a defensible caveated call,
  not an overclaim.
