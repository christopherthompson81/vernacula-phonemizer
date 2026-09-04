# Offglide notation: the non-English languages that write their own diphthongs with ᶦ ᶷ ⁱ ᵘ ᶤ

#1261/#1262 measured, per language, whether the wav2vec2 recognizer hears a second segment where the engine
writes a superscript offglide. That was done to decide a scoring fold; #1263 asks what it says about the
NOTATION. Two instruments are read here that the scoring work did not: the referee's own transcription of
the same words, and the engine's stated reason for the letter.

## Run 1 — 2026-09-04 12:05 — who emits which letter, and what each referee fold does with it

```
grep -rl '<letter>' src/languages data/languages      # per engine
grep -n '<letter>' tools/referee-eval/langs/*.jsonc   # what the eval fold does before scoring
```

Engines emitting each letter (excluding the English family, whose convention #1252 settled):

```
ᶦ   welsh tamil galician greek spanish yoruba igbo santali sinhala sindhi odia telugu persian korean japanese wu bulgarian central-kurdish naija
ᶷ   welsh tamil galician greek spanish yoruba igbo hakka tagalog czech punjabi odia sinhala hindi indonesian japanese naija
ⁱ   irish mandarin hausa
ᵘ   welsh mandarin hausa
ᶤ   welsh
```

⚠ **mi, xh, zu, ny, sn, ru, mk emit NONE of these letters natively** — the offglides in their aligned rows
come from the English arm (Run 3). So the list of languages whose notation is in question is: cs, cy, gl, ta,
ha, cmn, ga, and the Indic/Sinitic/Nigerian engines above that have no referee data on the letter.

Referee folds that already say what the referee writes at that position:

```
cs   ᶷ → u      "the referee's combining u̯ is stripped by the backbone"          referee: NON-SYLLABIC u̯
cy   ᶤ → …      "our CENTRAL i-offglide (aᶤ) ↔ the referee's non-syllabic ɨ̯"     referee: ɨ̯  i̯  u̯
gl   ᶦ → j, ᶷ → w   "vs the referee's plain glide j / w"                         referee: GLIDE CONSONANT
ta   ᶦ → i      "vs referee ɐ ɪ̯"                                                 referee: NON-SYLLABIC ɪ̯
ha   ⁱ → i      "vs referee a i"                                                 referee: FULL VOWEL i
cmn  [ᶦⁱ] → i, [ᵘᶷ] → u                                                          referee: i̯ / u̯ (epitran)
ga   ⁱ → ""     "our i-offglide before a slender consonant — the referee OMITS it"   referee: NOTHING
```

⚠ Note the ga fold: `replace: ""`. That is the "fold deletes the axis" shape — the eval cannot see
whether the offglide is right because the fold deletes it before scoring. Every other fold maps the letter to
a segment the referee also writes.

Implication: for six of the seven, the referee writes a second segment (non-syllabic vowel or glide) exactly
where the engine writes the superscript — the two notations are equivalent and the recognizer's "one
segment" (Czech ⟨ou⟩ 111/1346) is the recognizer's inventory, not a notation error. Irish is the only case
where the referee agrees with the recognizer that nothing is there. Run 2 measures that per word.

## Run 2 — 2026-09-04 12:20 — what the referee writes at the glide position, word by word

```
python3 scratch/refglide.py <lang> tools/referee-eval/referees/<file> 4000
# phonemize the referee's headwords, align our folded string to the referee's, read the referee's unit
# right after the nucleus our superscript follows; the referee's combining ̯ is kept visible as a suffix
```

```
cs   ᶷ   n=196   u̯ 100%                                    Augusta   ours ˈaᶷɡusta      ref a u̯ ɡ u s t a
cy   ᶦ   n=484   i̯ 95%   ɨ̯ 3%                              Aberteifi ours ˌabɛrtˈeᶦvi   ref a b ɛ r t e i̯ v i
cy   ᶤ   n=670   ɨ̯ 67%   unaligned 28%   i̯ 2%              Aberdaugleddau  ours …daᶤɡl…  ref … a ɨ̯ ɡ l …
cy   ᶷ   n=190   u̯ 97%                                     Abertawe  ours ˌabɛrtˈaᶷɛ    ref a b ɛ r t a u̯ ɛ
cy   ᵘ   n=99    u̯ 63%   unaligned 35%                      Barbiwda  ours barbˈɪᵘda     ref b a r b ɪ u̯ d a
gl   ᶦ   n=383   j 89%                                      Almofrei  ours almofɾˈeᶦ     ref a l m o f ɾ e j
gl   ᶷ   n=143   w 97%                                      Austria   ours ˈaᶷstɾja      ref a w s t ɾ j a
ha   ⁱ   n=90    i 100%                                     Aiki      ours ˈaⁱki         ref ʔ à i k í
ha   ᵘ   n=73    u 100%                                     Attaura   ours attˈaᵘra      ref ʔ à t t á u r áː
cmn  ᶦ   n=43    i̯ 42%   unaligned 58%                      ai        ours ˈaᶦ           ref ai̯
cmn  ᶷ   n=35    u̯ 54%   unaligned 31%   $ 9%               bao       ours bˈaᶷ          ref pau̯
ta   ᶦ   n=712   unaligned 99%  (aligner fails on the Tamil vowel set; the 4 that align: ɪ̯ ×2, i ×2)
ga   ⁱ   n=232   unaligned 47%   ɾ 12%  n 10%  l 7%  ʃ 7%   baváir    ours bˠˈavˠɑːⁱɾʲ   ref bˠ ə vˠ ɑː ɾʲ
xh, mi:  0 and 2 referee words carry an offglide at all
```

Six of seven: the referee writes a SECOND SEGMENT — non-syllabic `i̯ u̯ ɨ̯`, the glide `j w`, or a full vowel —
exactly where the engine writes the superscript. The notations are equivalent; the recognizer merging Czech
⟨ou⟩ into one vowel (#1262: 111 closer / 1,346 further) is its inventory speaking, not an error in ours. And
Welsh `ᶤ` ↔ `ɨ̯` at 67% with `i̯` at 2% confirms the CENTRAL glide is a real distinction the engine keeps
and the recognizer (which wrote `ɨ` 22 times in 741) cannot.

⚠ **Irish is the one language where the referee writes NOTHING** — the unit after `ɑː` is the slender
consonant itself (`ɾʲ nʲ lʲ ʃ`), 100% of the aligned cases. The engine inserts `ⁱ` by rule (irish.ts
`offglide()`: long back vowel + slender consonant → `ɑːⁱtʲ`), the wikipron-broad referee omits it, the
recognizer does not hear it (97 / 1,869), and the eval fold DELETES it (`replace: ""`) so no score ever
tested it. Three instruments, none witnessing the segment. The rule is phonetically motivated — the
[i̯] transition into a slender consonant is described in the literature — but the referee is a broad
transcription and this repo's IPA is canonical-phonemic elsewhere. This is the single open notation
question the issue raises, and it is a decision about Irish, not about the offglide letters.

## Run 3 — 2026-09-04 12:50 — the "Bantu" cells of #1262 are English numerals, by corpus policy

Question: mi, xh, zu, ny, sn, ru, mk are in #1262's expansion table, yet Run 1 found none of their engines
emit an offglide letter. Where do their `ᶦ`/`ᶷ` come from?

```
sqlite: the most frequent tokens carrying ᶦ/ᶷ per language in align.sqlite
xh_za   1078   θˈaᶷzənd ×164   fˈaᶦv ×76   ˈeᶦt ×62   nˈaᶦn ×59   pʰɔᶦnt ×47   nˈaᶦnti ×43
ny_mw    609   θˈaᶷzənd ×115   nˈaᶦntˈiːn ×78   fˈaᶦv ×73   ˈeᶦt ×65
sn_zw          nˈaᶦntˈiːn sˈɛvənti sˈɛvən  (1977)     nˈaᶦn θˈaᶷzənd fˈɔːɹ hˈʌndɹəd  (9400)
zu_za          sˈɛvən nˈaᶦntˈiːn (07:19)   wˈʌn pʰɔᶦnt fˈaᶦv (1.5)
mi_nz   1322   juːnˈaᶦt̬ᵻd ×16   stˈeᶦts ×13   sˈoᶷviʲət ×13   lˈeᶦk ×11     — English proper nouns
ru_ru    164   ˈeᶦt͡ʃ  ˈɛɹlaᶦnz  ɹˈeᶦnboᶷ                                      — English loans and letter names
```

**English numerals, and on purpose.** `phonemize("ngo-2009", "xh")` today gives *ŋɡ̤ɔː amawaːkʼa amaɓiːni
nɛtʰɔːɓa* — the engine reads the year in Xhosa — but the corpus is built by `phonemize-fleurs.mts`, which
runs `numeralSegments()` from `tools/corpus/numeral_register.mts` first: a per-language policy, measured
by `score_numeral_register.py`, that a Xhosa/Zulu/Shona/Chichewa news reader voices digits in English. The
recognizer confirms the readers did: `ngo-2009` comes back as `t u z a z a n e n aɪ n`, `1600` as
`t aʊ z ə n d s ɪ k s h`. So #1262's xh/zu/sn/ny cells are real (the segment is heard, the expansion is
right) but they are the ENGLISH offglide inside a Bantu row and say nothing about Bantu notation.

⚠ A wrong turn, recorded: I first read this as a STALE `ipa` column — the current engine reads the digits
natively, so the DB must predate the numeral readers — and wrote that into the #1262 comment and README
before checking how `byid/` is produced. `refresh_ipa.py --check` reports 687 stale rows across 7
languages, none of them these, because the byid reference carries the register too. The corrected text
says "by corpus policy"; the phrase "the Bantu ai/au of ny sn xh zu" in #1262's merged commit message and
PR body is simply wrong, and this run is the correction.

Implication for #1263: the list of languages whose own notation is in question is exactly the Run 1 emitter
list, and of those only cs, cy, gl, ta, ha, cmn, ga have a referee to check against. Run 2 did that.

## Run 4 — 2026-09-04 13:05 — verdict per language

Native emitters, once the English-leak comments are set aside (grep of each engine's first hit): Spanish
(`aire → aᶦɾe` — a stated convention), Czech (`ou → oᶷ` in the scanner), Tamil, Sinhala (`ඓ → aᶦ`), Welsh,
Galician, Mandarin, Hausa, Irish. Every other engine's hit is a comment about an English letter name or
numeral leaking (`[ˈeᶦt͡ʃ]`, `θˈaᶷzənd`) — the same population Run 3 found in the aligned rows.

| lang | letter | referee writes | recognizer hears | eval fold | verdict |
|---|---|---|---|---|---|
| cs | `oᶷ` | `u̯` 100% | one vowel (111/1346) | `→ u` | **stands** — referee has the segment; recognizer inventory |
| cy | `ᶦ ᶤ ᶷ ᵘ` | `i̯` 95% / `ɨ̯` 67% / `u̯` 97% / `u̯` 63% | `ɪ` for all; no `ɨ` | `→ i/ɨ/u` | **stands** — and `ᶤ` is a real distinction the recognizer lacks |
| gl | `ᶦ ᶷ` | `j` 89% / `w` 97% | `ɪ` 55% / mostly none | `→ j/w` | **stands** — glide-consonant vs non-syllabic-vowel is the same segment |
| ta | `ᶦ` | `ɪ̯` (fold note; aligner failed on the vowel set) | `ɪ` 46% | `→ i` | **stands** |
| ha | `ⁱ ᵘ` | `i` 100% / `u` 100% | mostly none (373/1463, 236/848) | `→ i` | **stands** — referee writes the full vowel; a recognizer trained on other data absorbs it |
| cmn | `ⁱ ᵘ` | `i̯` / `u̯` (epitran) | `i` 95% / none (51/2981) | `→ i/u` | **stands** — the asymmetry is the recognizer's, not ours |
| es, si | `ᶦ ᶷ` | no referee cell measured | — | — | convention stated in-engine; nothing here contradicts it |
| **ga** | `ⁱ` | **nothing** (100% of aligned) | **nothing** (97/1869) | **`→ ""`** | **open** — no instrument witnesses it, and the fold deletes the axis |

So the answer to #1263's two questions is: (1) for every language but one, the superscript is a real second
segment that the referee also writes, and the recognizer merging it is the recognizer's inventory — the
scoring exclusion in `OFFGLIDE` is the right home for that fact and the notation should not move; (2) Irish
is the single case where the letter marks something no in-repo instrument sees. The `offglide()` rule in
irish.ts is phonetically motivated (a back vowel's transition into a slender consonant is described in the
literature as an [i̯] on-glide), but it is one engine's narrow choice inside a repo whose IPA is
canonical-phonemic, against a broad referee that omits it and a recognizer that does not hear it — and the
eval fold `replace: ""` means the referee headline has never scored it either way.

Not decided here: whether to drop the Irish rule. Dropping it would make the engine agree with both
instruments, at the cost of a phonetic detail the referee is too broad to confirm or deny. That is a choice
about Irish's transcription depth, and it should be made with an Irish-specific check (a narrow referee, or
the Connacht lexicon's own headwords), not on the strength of this measurement alone.
