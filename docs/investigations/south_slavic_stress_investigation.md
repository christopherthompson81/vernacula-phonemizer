# sr / hr / bs stress — building the lexicon

Follows `south_slavic_stress_sources_investigation.md`, which established that a source exists. This is the
build. One lexicon, three engines: Croatian and Bosnian import `phonemizeWord` from `serbian.ts`, and
Wiktionary ships sr/hr/bs as one unified "Serbo-Croatian" dump — the code shape and the data shape already
agreed.

## Run 1 — 2026-08-17 — index the IPA or the spelling?

kaikki carries both an IPA and an accented spelling per entry. Indexing the IPA is the obvious move and it is
wrong here, because the two do not have the same number of nuclei:

    rijeka   IPA /rjěːka/   2 nuclei     spelling  rijéka   3 nuclei
    brijeg   IPA /brjêːɡ/   1 nucleus    spelling  brijȇg   2 nuclei

That is the Ijekavian ⟨ije⟩ reflex — the source writes its ⟨i⟩ as the glide /j/. This g2p is a strict
one-grapheme-one-phoneme scan, so it emits /i/ there and its nucleus count follows the SPELLING.

Measured over the dump: indexing the IPA disagrees with the spelling on **960 of 51 162** accented entries
(1.9%), in two classes — Ijekavian ⟨ije⟩ (`rijeka`, `brijeg`, `svijet`, `stijena`) and the source's
inconsistent marking of syllabic ⟨r⟩ (`trgovati` is `/trɡǒʋati/`, r unmarked, but `trgòvati` in spelling).

Indexing the spelling has neither problem — the mark already sits on the letter the engine will pronounce.
Verified on the hard cases:

    krv → kȓv        prst → pȑst      srce → sȑce      država → dr̀žava     (accent ON the syllabic r)
    rijeka → rijéka  brijeg → brijȇg  mlijeko → mlijéko                     (Ijekavian, accent on the ⟨e⟩)
    trgovati → trgòvati   Srbijanka → Srbìjānka   četiri → čètiri

## Run 2 — 2026-08-17 — the ⟨ć⟩ trap

⟨ć⟩ decomposes to ⟨c⟩ + **combining acute U+0301** — the same character that spells the long-rising accent —
and ⟨č š ž⟩ are letters + combining caron. A naive "find the combining mark" reader stresses the ⟨c⟩ of
`ćelav`.

The fix is a one-line test that is also the linguistically correct statement: **a mark is an accent only when
it sits on a nucleus.** On a consonant it is part of the letter. The macron U+0304 is excluded separately — it
writes post-accentual *length* (`àbdāl`), not accent, and treating it as one moves the mark off the accented
syllable.

## Run 3 — 2026-08-17 — build, and the script gap

`tools/serbian/build_sh_stress_lexicon.py` → `src/languages/serbian/stress.tsv`, in Russian's format exactly
(`word<TAB>0-based stressed-nucleus ordinal`, `loadTsvMap(..., Number)`) because Russian is the other
lexicon-driven Slavic engine here and had already solved the same problem.

    entries                  70075
    with an accented form    56591
    distinct keys            98812
    dropped, ambiguous         989   (two recorded placements — homograph or dialect split; no tie-break invented)

First pass covered only **35.0%** of `sr_rs` tokens against 42.8% for Latin `hr_hr`. Cause: the dump ships
52 190 accented **Latin** forms but only 27 530 Cyrillic ones, and FLEURS `sr_rs` is Cyrillic. Adding a Gaj's
Latin → Cyrillic transliteration (a letter-level bijection; the ordinal is unchanged because ⟨lj nj dž⟩ are
consonants) adds 4 363 keys and closes the gap to **43.7%**. Its one ambiguity — ⟨nadživeti⟩ is над+живети,
not на+џивети — is benign: it produces a key that spells no Serbian word, so it is never looked up, and an
existing Cyrillic key from the dump always wins.

Final: **101 965 rows**, both scripts.

## Run 4 — 2026-08-17 — ⚠ the coverage figure in the previous investigation was wrong

The sources doc reported 83–84% token coverage. **That was measured wrong and the real figure is ~43–44%.**

FLEURS TSVs have seven columns and **column 5 is character-separated** (`i m a m o | j e d n o g o…`). Reading
the whole file with a word regex made every individual letter a token, and single letters like `i a u o e` are
all in the lexicon as one-letter words. Re-measured from column 3 (the raw transcription) only:

| corpus | polysyllabic tokens | lexicon covers | first-nucleus right, on covered |
|---|---|---|---|
| `sr_rs` (Cyrillic) | 69.7% of tokens | **43.7%** | 85.5% |
| `hr_hr` | 70.7% | **43.2%** | 82.2% |
| `bs_ba` | 70.3% | **44.1%** | 83.0% |

The conclusion of the sources doc survives — 43% still exceeds the 37.2% that justified the Afrikaans change in
#828 — but the margin is much smaller than claimed, and the claim has been corrected there.

The commonest OOV words are `godine`, `može`, `ima`, `bila`, `bili`, `imaju`, `rekao` — inflected forms.
Exactly the mobile-paradigm problem the sources doc predicted, now with names.

## Run 5 — 2026-08-17 — the referee had it all along

`sr.wikipron-hbs-latn.tsv` **is already in the repo** marking the pitch accent on its own vowels — its header
says so: *"Marks the lexical PITCH ACCENT (â ǎ ê ô, rising/falling) + length ː + syllabic r̩ — all folded."*
26 126 of 26 486 rows (98.6%). `referee-eval`'s backbone strips exactly those marks, so the ordinary eval is
blind to stress by construction and nothing else looked at them.

So the audit's "no stress-marked source committed" was wrong even about the working tree, not just about
Wiktionary.

`tools/serbian/eval_stress_placement.mts` reads them:

    comparable 24556   (skipped 1318 monosyllabic, 612 with no referee accent)
      lexicon-covered      23895/24254 = 98.5%
        of 359 misses, 192 are the ⟨ije⟩ counting convention (same vowel, different ordinal)
        genuine disagreement 167/24254 = 0.7%  →  agreement 99.3%
      OOV first-nucleus    111/302 = 36.8%

⚠ **Correlated, not independent.** wikipron and kaikki are two extractions of the same Wiktionary tradition.
This measures whether we USE the source correctly — parse, index, place, script-map — not whether the source
is right about the language. A build-correctness check, not a linguistic one.

The 167 genuine disagreements are the sr/hr norm split on loans (`Pakistan`, `Kanada`, `Bolivija`,
`Kazahstan`), where the two extractions record different standard accentuations. Not obviously our error.

⚠ **The 36.8% OOV figure does not generalize** and is labelled as such in the tool's own output: only 302 rows
are OOV, because the referee and the lexicon are both Wiktionary, and what remains is the long rare tail where
first-nucleus is weakest. The frequency-weighted corpus figure (83–86%) is the one that describes running text.


## Run 6 — 2026-08-17 — the clamp was hiding 34 rows

`phonemizeWord` clamps a lexicon ordinal to the last nucleus it actually found. Asking how often that fires is
the adversarial version of "does the builder's nucleus rule match the engine's": **34 of 102 186 rows (0.033%)**,
every one a Torlakian dialect entry spelled with ⟨ă⟩ — a letter the engine's table has no rule for, so it is
dropped outright and `akăl` comes out as `akl`, one nucleus short.

None of them spells anything in standard sr/hr/bs, so the fix is to not ship them: the builder now keeps only
keys made entirely of the engine's own alphabet (read out of `serbian.jsonc`, so it cannot drift) and drops
Wiktionary's affix entries (`-ajlija`, `-irajući`) too. 101 965 rows, and the out-of-range count is **0**. The
clamp stays as a seatbelt; it is no longer also a storage place for known-bad data.

## Design decisions, and why

**A monosyllable carries no mark** — following Russian, the other lexicon-driven Slavic engine, whose file
format this copies. The mark carries no information there, and it buys something real: Serbo-Croatian
proclitics (`je se li ga mu su sam bi`) are prosodically unstressed in running speech but dictionaried with
citation accents, and they are almost all monosyllabic. Skipping monosyllables declines to assert a stress the
utterance does not have.

**OOV falls back to the first nucleus.** For a disyllable this is a **rule, not a guess**: the standard
language does not accent the final syllable of a polysyllabic word, so a disyllable must be initial-stressed.
The lexicon agrees on 98.9% of its own 2-nucleus entries. Beyond that it degrades honestly — 78.1% at three
nuclei, 42.4% at four — but the long words are the rare ones, so the frequency-weighted figure stays high.

**Position is emitted; tone and length are not.** The lexicon carries the full four-way contrast (short-rising
84 361, long-rising 48 154, short-falling 45 440, long-falling 12 420). Emitting it would add symbols to the
phone inventory and change what every downstream consumer sees. That is the next step, and it is now a data
question rather than a sourcing one.

## Verification

- `phonemizeWord` output is byte-identical to before once `ˈ` is stripped — the change adds a mark and nothing
  else. The referee backbone is unchanged at 26055/26486 (98.4%), symbol accuracy 99.8%, as expected: the eval
  strips the mark.
- 176 test literals changed across four files. Because stress here is *lexical*, these cannot be predicted from
  a rule the way the af/is/lb ones were — so they were updated from the engine and then audited against the
  independent wikipron marks (Run 5), which is the check that matters. The diff is also an identical multiset
  once `ˈ` is stripped.
- ⚠ The mechanical update corrupted three **input** strings where a test's argument and its expectation were
  the same literal (`phonemizeWord("mlijeko")` → `phonemizeWord("mlijˈeko")`). Caught by the suite. This is the
  second time in this session that a blanket replace has damaged inputs; the guard is to grep for a stress mark
  inside a call argument afterwards, which is now part of the routine.

## Still open

- **Tone.** Carried by the lexicon, not emitted. Needs an inventory decision.
- **Paradigmatic accent.** 303 134 of the dump's 455 000 inflected forms have no accent, which is why coverage
  is 43% and not 90%. Deriving them needs the accent paradigm, which is real linguistic work.
- **`sl`.** Slovene has its own dump (5 380 accented headwords, 56.8% token coverage) and a separate engine
  with no shared g2p. Not done here.


## Run 7 — 2026-08-18 — tone: is there a fallback, and what notation?

The stress work left tone carried-but-not-emitted, with two open questions.

**Is there a positional fallback?** Serbo-Croatian's textbook constraint is that a *falling* accent occurs
only word-initially. Tested against the dump:

| accent sits on | rising | falling |
|---|---|---|
| the FIRST nucleus | 19 297 | 16 882 |
| a LATER nucleus | 20 609 | **346 (1.65%)** |

The constraint holds at 98.35%. But it buys nothing here: our OOV fallback puts the accent on σ1, and σ1 is
exactly where the split is a 53/47 coin flip. **So there is no usable tone fallback for OOV** — which is a real
difference from stress, where first-nucleus is a rule for disyllables.

The house answer to partial pitch annotation already exists: `japanese/pitch.ts` ships a partial lexicon,
renders OOV unmarked, and exports `pitchLexiconHas` precisely because an OOV-defaulted-flat reading is
indistinguishable in the output from a genuine one. Copied, with one honest difference recorded in the code:
in Japanese "unmarked" is *heiban*, a real category, whereas Serbo-Croatian has no toneless words, so an absent
tone letter here means **not in the lexicon**, never *no accent*. `accentLexiconHas()` is the predicate.

**What notation?** The sources write the accent as a combining caron (rising) / circumflex (falling) on the
vowel — `ǎbdaːl`, `ôːn` — and so does the committed referee. Every *other* tone language in this fleet writes
Chao tone letters after the nucleus instead (`kʰˈaː˥˩w`, `mˈaː˧˥`). Chao letters win: one notation for tone
across 190 languages beats one notation per philological tradition, and it turns out to cost nothing —

    ˩˥  already emitted by lingala, zulu, hausa, xhosa
    ˥˩  already emitted by thai, burmese, minnan, punjabi

**zero new symbols enter the fleet inventory**, which was the entire reason tone had been held back.

Emitted shape: `onset + ˈ + nucleus + ː(if long) + tone letter + coda`. Accented-syllable length is emitted
because the four-way contrast *is* tone × length; post-accentual length (the macron of `àbdāl`) stays folded.

**Monosyllables take their tone though they take no ˈ.** The reason ˈ is skipped — no information on one
syllable — simply does not apply to the contour, which is phonemic there: `grâd` "city" vs `grȁd` "hail".

## Run 8 — 2026-08-18 — the homograph check the first build only half-did

The stress build dropped keys with conflicting *positions* (989). Asking the same question about *contours*
found a much commoner case: **366 entry-keys (2486 rows after inflected forms and both scripts) have the same
position and two different contours** — `grad`, `alat`, `bar`, `ada` — and first-wins had been shipping a coin
flip as fact.

Fixed by abstaining: the ordinal stands, the tone becomes `--`, and the engine emits `ˈ` with no tone letter.
Same posture as OOV, for the same reason. Measured effect, against the referee's own caron/circumflex marks:

| | before abstention | after |
|---|---|---|
| contour | 99.2% (25 244 words) | **99.7%** (24 407) |
| length | 99.4% | **99.8%** |
| position | 99.3% | 99.3% (unchanged) |

## Run 9 — 2026-08-18 — two review findings

**Clitics were being treated inconsistently.** The exclusion list suppressed the *tone* but still let a
polysyllabic clitic take its `ˈ` — so `je`/`se` came out bare (monosyllables take no mark anyway) while
`ćemo`/`bismo`/`biste` were marked. An enclitic is unstressed whatever its length, so a clitic now returns
unmarked outright.

**And the edit that made that change broke the list.** Reformatting the set put a `//` comment mid-line, which
swallowed `"o", "po", "za", "od", "do", "iz", "s", "sa", "k", "ka", "uz", "niz"` — every Latin preposition
silently left the set and `od` came back as `o˥˩d`. Caught by the suite (9 failures across three files), not by
reading. Worth recording because the damage was invisible in the diff: the line still *looked* like a list.

## Still open, after tone

- **Paradigmatic accent** — unchanged and still the ceiling: 303 134 of the dump's 455 000 inflected forms
  carry no accent, which is why coverage is 43% and not 90%.
- **Syllabic ⟨r⟩ is not marked as syllabic.** `krv → krː˥˩ʋ` — the length and tone attach to the ⟨r⟩ correctly,
  but nothing says it is the nucleus. The referee writes `r̩`. Pre-existing (the engine never marked it), but
  emitting length on it makes the gap more visible than it was.
- **Post-accentual length.** The macron is in the source and is not emitted.
- **`sl`.** Slovene has its own dump and no shared g2p. Untouched.
