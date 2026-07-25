# Luo (Dholuo) native bring-up

Western Nilotic (Luo group), spoken around Lake Victoria in Kenya + Tanzania (~4–5M), Latin orthography. Goal: an
espeak-independent canonical-IPA greedy g2p (the wo/lg/ki/mos Atlantic/Bantu/Gur pattern). Dholuo is the FIRST Nilotic
language in the repo. Its hard, distinctive features: a **dental vs alveolar** stop/fricative contrast (⟨th dh⟩ vs
⟨t d⟩), **prenasalised** voiced stops (⟨mb nd nj ng⟩), a **9-vowel ±ATR** system that the orthography does NOT write,
and **register tone** (H/L) that the orthography also does not write.

## Run 1 — 2026-07-25 — referee, phonology, the plan

**Referee hunt.** No kaikki Luo dump (kaikki.org/dictionary/Luo → 404), no epitran luo-Latn map, no wikipron luo. The
only independent source is **en.wiktionary `Category:Luo terms with IPA pronunciation` — 17 words** (built via
`tools/corpus/build-referee.ts --lang luo --wnl Luo --code luo` → `referees/luo.wiktionary-luo.tsv`). Thin, but the 17
are HIGH-detail (tone, ATR, dental manner, prenasalisation all transcribed), so they pin the consonant system and
expose the vowel system. This is a **single-source 🔷** bring-up; the second authority is published phonology (Tucker
1994 *A Grammar of Kenya Luo (Dholuo)*; Okoth-Okombo 1982 *Dholuo Morphophonemics*), NOT a second numeric referee.

**What the 17 words establish (read off the referee):**
- **Dental fricatives** — dhiang'→`ðjæŋ`, so ⟨dh⟩→ð and (by symmetry) ⟨th⟩→θ. NOTE the adjudication: Tucker describes
  the Dholuo dentals as dental PLOSIVES /t̪ d̪/; the Wiktionary human transcriber writes fricatives /θ ð/. Both are
  attested for the ⟨th dh⟩ series; we emit /θ ð/ to match the only measured referee, and fold θ~t̪, ð~d̪ so the
  dental-vs-alveolar CONTRAST (the real phonemic fact) is what's scored, not the manner notation.
- **Palatals** — ⟨ch⟩→t͡ʃ (rech→`ré̙t͡ɕ`, chíeng'→`t͡ʃʲêŋ`; also written [c]/[t͡ɕ] — one palatal, folded), ⟨ny⟩→ɲ
  (nyang'→`ɲaŋ`), ⟨ng'⟩→ŋ (chíeng'/dhiang'/nyang' all →…ŋ), ⟨j⟩→d͡ʒ, ⟨y⟩→j.
- **9-vowel ±ATR, UNWRITTEN** — the orthography has 5 vowel letters a e i o u but the referee shows both series:
  −ATR kelo→`kɛlɔ`, kuno→`kʊnɔ`, ich→`ɪc`, lep→`lɛp` AND +ATR kidi→`kidi`, rech→`re̙`, ot→`o̘`, chogo→`coɡo`. ATR is
  lexical/harmonic and the standard orthography marks NO trigger (unlike Akan's ⟨ɛ ɔ⟩), so it is **unrecoverable from
  spelling** — we emit a default (+ATR tense i e o u) and FOLD [±ATR] in the eval. This is the principled cap (like
  tone), not a backlog item.
- **Tone** — register H/L marked à/á/ê in the referee (à.dêk, có.ɡó, kɛ.lɔ); unwritten → DEFERRED, folded.
- **Aspiration** on released final voiceless stops (ot→`o̘tʰ`) — phonetic, folded.
- **Glide in high-vowel + V hiatus** (dhiang'→ðjæŋ, chíeng'→t͡ʃʲeŋ) — the referee glides i→j / palatalises; a small
  effect, handled/folded like the Kikuyu glide.

**Plan (this run → next):** author the greedy manifest (dental/palatal/prenasal digraphs + 5 default-ATR vowels) + the
engine (prenasal units, glide), wire the eval with tone/ATR/aspiration/manner folds, measure against the 17, corroborate
consonants against Tucker. Tone + ATR + numbers deferred (documented caps).

## Run 2 — 2026-07-25 — authored, measured 100% folded (17/17)

Authored the module (`src/languages/luo/` — luo.jsonc manifest + manifest.ts + luo.ts engine), the eval config
(`langs/luo.jsonc`), the registry `case "luo"`, and `test/luo.test.ts`. The engine is a greedy longest-match scan
(ng' → the dental/palatal/prenasal digraphs → singles) with one code rule (high-vowel glide ⟨i u⟩+V → j/w) and an
input normalizer that strips tone-marked citation accents (chíeng' → chieng').

**Result vs the 17-word Wiktionary referee: raw 5.9% (1/17), folded backbone 100% (17/17).** The raw number is low
because tone + ±ATR are marked in the referee but UNWRITTEN in the orthography (so unrecoverable) — the folded 100% is
the real signal: every referee word's consonant skeleton + written-vowel identity is produced correctly. Folds (all
justified): precomposed/combining tone marks, syllable dots, ±ATR vowel quality (ɪ~i ɛ~e ɔ~o ʊ~u), the one-palatal
notation (c ~ t͡ʃ ~ t͡ɕ), the palatalisation glide (ʲ~j), released-final aspiration (ʰ), æ~a fronting, and the tap (r~ɾ).

The g2p was validated word-by-word against the referee and the consonant inventory corroborated by Tucker (1994): the
dental/alveolar contrast (dhano→ðano, thum→θum vs kidi/adek), the prenasalised voiced stops (ndalo→ⁿdalo,
ngano→ᵑɡano), ⟨ng'⟩→ŋ (ng'ato→ŋato) vs ⟨ng⟩→ᵑɡ, the palatals (rech→ɾet͡ʃ), the glide (dhiang'→ðjaŋ).

**Verdict: 🔷 single-source.** Correct on every one of the (thin, 17-word) referee's words and corroborated by
published phonology, but there is no independent SECOND numeric referee (no kaikki/epitran/wikipron Dholuo). The
adjudicated anchor is test/luo.test.ts. **Deferred (documented caps):** ±ATR harmony (unwritten — a lexicon would be
needed, like Akan tone), register TONE (H/L, unwritten + lexical), and numbers.
