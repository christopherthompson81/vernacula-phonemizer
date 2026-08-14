# Silent deletion — an instrument for input characters that contribute NOTHING to the output

The defect class: a character reaches the engine, is not rejected, and produces nothing. Sometimes it splits
its word, sometimes it deletes a phonemic contrast. **No leak class, DROP counter, referee or corpus diff can
see it**, because nothing appears that should not — something simply fails to appear.

Found six times by HAND and never by an instrument:

| language | character | scale | how it was found |
|---|---|---|---|
| bm | ε U+03B5 ×179, ԑ U+0511 ×26, ᴐ, ɳ — homoglyphs for ɛ ɔ ɲ | ~222 chars | a corner surfaced as vowelless ASCII runs |
| ki | ű ī ū û î — keyboard substitutes for ĩ ũ | 7% of paragraphs | reading the corpus |
| bal | a letter outside the token class | 38.9% of paragraphs | reading the corpus |
| gn | ⟨ꞌ⟩ U+A78C SALTILLO — the puso, a PHONEME | ×301 in 433 segments | a character census |
| ee | ◌͂ U+0342 perispomeni for the nasal tilde | ×6 | a character census |
| sat | U+1C7B RELAA, inside the word class, claimed by no branch | — | a character census |

The model for the design note and for the measurement discipline is `rawLatinIn` in
`tools/normalization/defects.ts` (commit `9a3626c`): every rejected design measured on the whole fleet before
shipping, and the residual false-positive population NAMED rather than narrowed around.

---

## Run 1 — 2026-08-13 — is the differential even cheap enough for a fleet sweep?

**Command** (harness outside the repo; `census(lang, lines, opts)` over `tools/corpus/mined/<lang>.jsonc`):
per candidate character, take up to 8 distinct corpus words containing it and compare `say(w)` against
`say(w without c)` and `say(w with c → space)`.

**Question.** Is a per-word differential affordable across 162 artifacts, and does it see anything?

**Raw finding.** gn: **92 ms** for the whole artifact, 2 findings. A per-word differential is ~3 phonemize
calls on a SHORT string per (character, word) pair, and the candidate alphabet of a corpus is ~50–150
characters — so the whole fleet is minutes, not hours. Both probes are needed and they are not the same test:

* `say(w) === say(w.replace(c,""))` — c is INERT inside the token (the gn/ee/sat shape).
* `say(w) === say(w.replace(c," "))` — c is being treated as a WORD BOUNDARY despite being a letter (the
  bal/bm shape: the word splits and the character's phoneme is lost).

**Implication.** The instrument is affordable. Everything now rests on specificity.

---

## Run 2 — 2026-08-13 — the naive designs, and their false-positive rates

Measured before writing anything into `defects.ts`, in the order they were tried.

| design | fires on | verdict |
|---|---|---|
| **D0** "an input character absent from the output" | every space, every pause mark, every silent letter, every abugida's inherent-vowel machinery — 100 % of lines in every language | useless by construction; this is the trap named in the brief |
| **D1** per-word differential, ANY character (punctuation included) | every punctuation mark the engine correctly reads as a pause, in every language | rejected — it re-reports what `DROPPABLE` already discriminates properly, with none of that machinery's REDUNDANT test |
| **D2** per-word differential, letters/marks only, single probe word | a character silent in ONE word is not silent in the language: French `parlent` vs `table`, Spanish `ch` vs `Honshu` | rejected — non-universal evidence; the same character's OTHER words disprove it |
| **D3** = D2 + universal over ≤8 native probe words + candidate must be `\p{L}`/`\p{M}` | **736 findings in 64 of 162 languages** | rejected — SEE BELOW. Not noise-free enough to read |

**D3's fleet distribution** (`fleet_v3.txt`): gan 417, hsn 122, cjy 20, shn 16, ug 12, skr 11, tt 7, ary 7,
ki 6, bal 6, arz 6, then a tail of 55 languages with ≤5 each.

**The two false-positive populations D3 exposed, read by hand:**

1. **IPA PRONUNCIATION GLOSSES INSIDE THE WIKI TEXT.** ki fires on `ə ː ˈ ɾ ɑ ɡ`; haw on `ˈ ː ɑ ɪ ʊ`; mos on
   `ɒ ə ˈ ı ɑ`; sn, so, nya, ee, lt, bar likewise. The probe words are not words — they are transcriptions
   copied out of an article's lead (`ˈhɑːn`, `kaʊˈɑɪ`, `əˈkrɑː`). A Kikuyu engine deleting the ⟨ɑ⟩ of an
   English gloss is not a Kikuyu defect. **This is the single largest FP family: ~60 % of D3's non-Han hits.**
2. **HAN DICTIONARY COVERAGE.** gan 417 + hsn 122 + cjy 20 + wuu 2 = 561 of 736 findings, i.e. **76 % of the
   whole class**, and every one of them is the same fact: a hanzi outside the engine's dictionary reads as
   nothing. That is real, it is already instrumented — `cjy`'s own dict-silence probe, commit `10741c3` — and
   a per-character detector over a Han corpus measures DICTIONARY COVERAGE, not a defect class. Left in, it
   swamps every other language 4:1 and teaches the reader to skip the section (trap 57).

---

## Run 3 — 2026-08-13 — the core-inventory filter: 736 → 176

**Question.** Can the gloss family be removed without a hand-written list of IPA symbols? (A blacklist of
⟨ɛ ɔ ŋ ɲ ɖ ƒ ʋ⟩-style characters is impossible: those ARE the orthography in bm, ee, ig and thirty more.)

**The rule tried.** A probe word is admissible only if **every character in it other than the candidate is a
CORE character of the corpus** — where core = occurring at least `max(20, 0.05 %)` of the corpus's
letter/mark occurrences. The candidate itself is explicitly EXEMPT from that floor, because the whole point is
that the intruder is rare (ee's perispomeni is ×6 in its artifact).

**Raw finding.** **736 → 176 findings, 64 → 47 languages.** Every gloss-driven hit in ki, haw, mos, sn, so,
nya, ee disappears, because `ˈhɑːn` and `kaʊˈɑɪ` are built out of characters that are themselves rare in a
Kikuyu or Hawaiian corpus. Not one hand-written IPA symbol was needed. Residual gloss hits: ki `ə` (probe
words `sə`, `shə`, `nə`), bm `ʃ` ×3, lt `ˈ` ×11, bar `ː` ×4 — four languages, all at occ ≤ 11.

**Implication.** Keep. The filter is a statement about the CORPUS, not about IPA, so it cannot fall behind an
orthography the way a symbol list would.

---

## Run 4 — 2026-08-13 — REJECTED: "the character is not mentioned by the engine's own source"

**Question.** The brief's third suggested direction, and the shape of sat's RELAA — a character inside the
token class that no branch claims. Can "claimed by no rule" be approximated by "does not appear in the
language's own source"? Implemented as: registry `case "<code>"` → `create…` → its import path → that
directory's `.ts`/`.jsonc`/`.tsv`, plus the `src/core/*.ts` modules those files import; `\uXXXX` escapes
decoded and small `a-b` ranges expanded.

**Raw finding — the filter is non-discriminating: 41 of 46 sampled hit characters are "declared".**

| finding | declared? | what it actually is |
|---|---|---|
| es/an/gl/it/oc/mt `H` (silent h) | **DECL** | a REAL false positive that the filter fails to remove |
| wo `h`/`H` | **DECL** | ditto |
| ary `پ ڤ ڭ ݣ گ` (Darija's own letters, deleted) | **DECL** | a REAL defect the filter would have SILENCED |
| gn `◌̃` on ⟨g̃⟩, ti `ኲ ቊ`, shn `ၻ ၿ`, cdo `◌̆`, nan `◌͘` | **DECL** | real defects, all silenced |
| skr `ة ۃ ك ؒ ڊ ؔ ؐ`, pnb `ݪ`, shi `ε`, shn `ꧦ`, hsn `濟`, tt `ی` | – | the only 5 % it would keep |

**Why it fails, and why no tightening rescues it.** This repository's engines are written with very large
design-note comments that QUOTE the corpus — the exact characters under test appear a dozen lines above the
rule that does not handle them. Stripping comments does not help either, because the discrimination wanted is
not "is this character mentioned" but "is this character claimed IN THIS COMBINATION": gn's ⟨g̃⟩ fails while
the same U+0303 on ⟨ẽ⟩ is handled, and Spanish `h` is genuinely, correctly, mapped to nothing.

**Implication.** REJECTED as a filter. It removes true positives at ~7× the rate it removes false ones. The
only honest version of "claimed by no rule" is the DIFFERENTIAL itself, which asks the engine rather than its
text.

---

## Run 5 — 2026-08-14 — case folding, Han exclusion, and the residual read by hand

**Question.** D3+core leaves two FP families: the Romance/Maltese/Wolof silent ⟨H⟩ and the Han dictionary
sweep. Can either be removed by a rule rather than by a list?

**Han.** Excluded by SCRIPT, and the exclusion is stated rather than hidden: a Han corpus's candidate
alphabet is its whole character set, so this detector degenerates into a dictionary-coverage meter there, and
that meter already exists (`10741c3`). Measured cost of the exclusion: it removes 561 findings, of which the
`gan` 76 that survive the core filter are real dictionary gaps and are still reported by their own probe.

**Case folding.** ⟨H⟩ fires in an, ast, es, gl, it, mt, oc while ⟨h⟩ does NOT, and the reason is the ⟨ch⟩
digraph: lowercase `h` demonstrably contributes, so the engine's `h` is claimed — only the capital, which
occurs in names, is silent. A letter's case variants are the SAME LETTER, so the probe set for a candidate is
built from every case variant of it, and one contributing variant claims the character.

**Raw finding.** See the table in Run 6. Case folding removes the whole ⟨H⟩ family except Wolof, where `h`
never contributes in any case — which is the correct outcome, since Wolof's ⟨h⟩ IS a phoneme /h/ and its
silence in `sahraa → saraː` is a real deletion.

**Raw finding (both changes, measured through the harness).**

| step | findings | languages |
|---|---|---|
| D3 (universal, letters/marks, native words) | 736 | 64 |
| + core-inventory probe words | 176 | 47 |
| + Han/Kana corpora excluded | 100 | 45 |
| + case folding | **90** | **39** |

**Implication.** Ship this shape. Two more removals were then made in the shipped version rather than the
harness: a candidate matched by any `LEAK_CLASSES` pattern is not this class's business (eu's ⟨º⟩ U+00BA is
`\p{L}` to Unicode and RAWMARK's to this repo — DERIVED from that table, never re-listed, since three drifted
copies of it were found this week), and the two `ORTHOGRAPHIC_SILENCE` entries move from SILENT to
ACCEPTED-ORTHOGRAPHIC. Final: **87 SILENT + 4 ACCEPTED-ORTHOGRAPHIC in 39 of 162 languages.**

---

## Run 6 — 2026-08-14 — the regression fixture: all six, at the commit before each fix

**Command.** For each case, a tree extracted read-only at the commit BEFORE the fix
(`git archive <fix>^ src tools … | tar -x -C <tmp>`, no `.onnx`), the artifact taken from the fix commit
itself (the corpus is usually added by the same commit that reads it), and the detector run against that
engine. ⚠ `git checkout`/`stash`/`restore` are never used; nothing in any working tree is touched.

**Question.** Would this instrument have caught each of the six by itself?

**Raw finding — SIX OF SIX, with the character named and the scale right.**

| language | pre-fix commit | reported |
|---|---|---|
| bm | `304f41d^` | **ε U+03B5 ×166**, **ԑ U+0511 ×26**, **ᴐ U+1D10 ×9**, **ɳ U+0273 ×8** — all four homoglyphs, `bε → b` |
| ki | `58c1512^` | **ű U+0171 ×69**, **ī ×37**, **ū ×23**, **û ×10**, **î ×8** (+ í é ó) — `andű → aⁿd` |
| bal | `e4f7b51^` | **ݔ U+0754 ×101, mode `separator`** — `مسترݔن → mast̪ir n`, the word split in two — plus ۏ ×122, ې ×21, ي ×14 |
| gn | `6d24232^` | **ꞌ U+A78C ×301** — `heꞌõporã → heõpoˈɾã` |
| ee | `bf1ba66^` | **◌͂ U+0342 ×6** — `ha͂ → ha`, `kata͂ → kata` |
| sat | `23a6615^` | **ᱻ U+1C7B ×7** — `ᱵᱮᱲᱟᱻᱫᱚ → beɽadɔ` |

**And the same six languages TODAY**: ee 0, sat 0, gn only the ⟨g̃⟩ residual below, bal only its harakat, bm
only ⟨ʃ⟩ ×3, ki only ⟨ə⟩ ×5. Every character that was fixed has gone to zero, which is the second half of a
regression fixture and the reason the pre-fix readings are pinned in
`test/normalization-silent-deletion.test.ts` rather than left in this document.

⚠ **bal is why the space probe exists.** `مسترݔن → mast̪ir n` is not `say(word without ݔ)`; the two fragments
are phonemized separately. A deletion-only detector reads that corpus CLEAN — 38.9 % of its paragraphs.

---

## Run 7 — 2026-08-14 — the fleet distribution, and which hits are real

`silentCharsIn` over all 162 mined artifacts, through the shipped code path exactly as `mine.ts scan` calls
it: **87 SILENT + 4 ACCEPTED-ORTHOGRAPHIC in 39 languages**; 123 languages report nothing. Largest per
language: skr 10, ary 8, shn 7, arz 6, bal 5; 24 of the 39 have exactly one. 16 of the 87 are `separator`
mode — a letter breaking its own word.

**Read by hand, the 87 fall into seven families.**

1. **A letter of the language's own extended alphabet that the engine has no rule for — 27 hits, the biggest
   real family.** ary ⟨پ ڤ ڭ ݣ گ⟩ are Darija's own consonants: `السوپر → ˈasw r`, the /p/ deleted AND the word
   split. arz ⟨ڤ پ چ⟩, ug ⟨ڧ ک ی⟩, pnb ⟨ݪ ء ى⟩, skr ⟨ڊ ۃ ك⟩, ckb ⟨ك ى⟩, bal ⟨ښ⟩, ti ⟨ኲ ቊ⟩ (`ኲናት → nat`
   loses a whole syllable), shn's six Burmese-block letters and ⟨ၻ ၿ ꧦ⟩, bo ⟨ྥ ཿ ྋ⟩.
2. **Ta marbuta and the Arabic vowel diacritics — 16 hits.** ar/ary/arz/skr ⟨ة⟩ (×3,168 in arz) and bal's
   ⟨ِ َ ُ ّ⟩ ×454 together. Real, though a maintainer may decide an unvocalised reading is the engine's
   contract; the detector's job is that the decision is made rather than defaulted into.
3. **The Cyrillic COMBINING ACUTE U+0301 — 7 languages (ab, ba, be, chv, mn, tg, tt), 6 of them `separator`.**
   `Абіса́ль → abʲisa lʲ`, `А́страхань → ˈɑ strɑˈxɑn`: a dictionary stress mark BREAKS the word in two and the
   engine then stresses both halves. Cross-fleet, one character, and nothing else in the repo sees it.
4. **Latin homoglyphs — the bm defect, alive elsewhere. ak ⟨ε⟩ U+03B5 ×85** (`εwɔ → wɔ`) is Greek epsilon for
   Akan ⟨ɛ⟩, exactly bm's case in a language nobody has checked; shi ⟨ε⟩ ×3 the same; hr ⟨w⟩ ×19 / ⟨y⟩ ×10
   (`Downing → doninɡ`); wo ⟨h⟩ ×252 (`sahraa → saraː`, and ⟨h⟩ is not in the Wolof alphabet, so this is a
   foreign-letter deletion rather than an orthographic silence — which is why wo is NOT in the exemption
   table beside mt).
5. **Romanisation marks that carry a vowel contrast — 3 hits, all large.** nan ⟨◌͘⟩ ×366 (`tō͘ → tə`, the
   Tâi-lô ⟨o͘⟩/⟨o⟩ contrast), cdo ⟨◌̆⟩ ×295, gn ⟨◌̃⟩ ×82 on ⟨g̃⟩ — gn's saltillo was fixed and its OTHER
   nasal mark was not, which is the clearest argument in this log for an instrument over a reading.
6. **Cyrillic soft/hard sign and script leftovers — 12 hits.** chv/ky/tg/tt ⟨ь⟩, chv/mn ⟨ъ⟩, mn ⟨ї⟩, ba ⟨ӊ ѳ⟩,
   ab ⟨щ⟩, he ⟨א⟩ ×4,618 and ⟨ְ⟩, plus the Indic ⟨ऽ ॑ ৃ⟩ and as ⟨ʼ⟩. ⚠ The soft sign is the arguable one: it
   has no segment of its own, and whether its palatalisation should surface is a per-engine judgement. It is
   REPORTED and not exempted, because "arguable" is a thing to decide, not to hide.
7. **RESIDUAL FALSE POSITIVES — 3 of 87 (3.4 %):** ki ⟨ə⟩ ×5, lt ⟨ˈ⟩ ×11, bar ⟨ː⟩ ×4. All three are IPA
   glosses whose probe words are short enough (`sə`, `shə`, `nə`) to survive the core-inventory filter.
   ⚠ NOT NARROWED AROUND. The two rules that would remove them — an occurrence floor, or a blacklist of IPA
   symbols — are exactly the rules that would have missed ee's ×6 and blinded the class in bm, ee and ig,
   where ⟨ɛ ɔ ŋ ɲ ɖ ƒ ʋ⟩ ARE the orthography. Three stray reports at ×5 is the cheaper error.

Comparable to the precedent: `rawLatinIn` shipped with 3 residual false positives in 45,830 lines.

---

## Run 8 — 2026-08-14 — the gate runs: does it swamp anyone?

`npx tsx tools/normalization/mine.ts scan` and `review.ts --lang` on gn, ee and bm.

* **gn** — one new line: `SILENT ̃ U+0303 ×82 — inert, 8 words — og̃uahẽ → owaˈhẽ`, beside 3 pre-existing
  defect lines. `review.ts` still reports the same 2 FAILING checks as before.
* **ee** — zero new lines. The perispomeni is fixed and the class says so by silence.
* **bm** — one new line, `SILENT ʃ U+0283 ×3`, against 10 pre-existing `LEAK RAW-LATIN` lines.
* **ak** — not part of the gate, but it is the live find: `SILENT ε U+03B5 ×85`.

⚠ THE COUNT IS OCCURRENCES, NOT LINES, and `bump` grew an increment parameter to allow it. Every other class
in the scan counts lines; this one is decided once for the whole corpus, so a `×1` would make ee's ×6 and
gn's ×301 look the same size.

**Gates.** `npx tsc --noEmit` clean. `npx vitest run`: 4,078 passed, 1 failed — `test/onnx-optional.test.ts`,
the known 5-second timeout under load, discounted per the brief. The 16 new tests pin both directions: the six
pre-fix defects fire, and Spanish ⟨h⟩/⟨ch⟩, a capital ⟨H⟩, a French-style silent final ⟨t⟩, a two-word
character, a Han corpus and a RAWMARK character do not.
