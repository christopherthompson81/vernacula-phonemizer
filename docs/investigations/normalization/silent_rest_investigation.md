# The rest of the silent-deletion findings, and the lone foreign letter

Two jobs in one branch. **Item 1** is the triage of the silent-deletion findings not owned by the three
sibling batches (Perso-Arabic, Cyrillic, and `nan cdo shn bo ti`): `ak gn he ca wo hr bpy awa mag mai`.
**Item 2** is the lone-foreign-letter deletion the entity run isolated — a run of ≥2 Greek letters routes to
the Greek reader everywhere, a run of ONE was deleted.

The instrument is `silentCharsIn` (`tools/normalization/defects.ts`); its design and its rejected designs are
in `docs/investigations/normalization/silent_deletion_detector_investigation.md`, and nothing here re-litigates them.

---

## Run 1 — 2026-08-14 — re-deriving the counts through `mine.ts scan`

**Command.** `npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/<l>.jsonc --lang <l>` for each
of the ten codes, reading only the `SILENT`/`ACCEPTED-ORTHOGRAPHIC` lines.

**Question.** The brief's counts came from a quick probe with a filter disabled and were known to
over-report. What does the shipped code path actually say?

**Raw finding.**

| language | reported | mode | examples |
|---|---|---|---|
| ak | `ε` U+03B5 ×85 | inert, 8 words | `εwɔ → wɔ` ; `Neε → ne` ; `εmaa → maa` |
| ak | `ʻ` U+02BB ×3 | separator, 3 words | `Puleʻanga → pule aŋa` ; `Fakatuʻi → fakatu i` |
| gn | `◌̃` U+0303 ×82 | inert, 8 words | `og̃uahẽ → owaˈhẽ` ; `ág̃a → ˈaɰa` |
| he | `א` U+05D0 ×4,618 | inert, 8 words | `קלארק → klʁk` ; `כאל → χl` |
| he | `ְ` U+05B0 ×43 | inert, 4 words | `ינְג → jnɡ` ; `נְג → nɡ` |
| wo | `h` U+0068 ×252 | inert, 8 words | `sahraa → saraː` ; `Mohamad → mɔamad` |
| hr | `w` U+0077 ×19 | inert, 8 words | `Whitehallu → xitexallu` ; `Downing → doninɡ` |
| hr | `y` U+0079 ×10 | inert, 6 words | `Toyota → toota` ; `Dylana → dlana` |
| awa | `ऽ` U+093D ×12 | inert, 8 words | `लोगऽन् → lˈoːɡən` ; `भागऽन → bʱˈaːɡən` |
| mag | `ऽ` U+093D ×37 | inert, 8 words | `रहऽ → ɾˈəɦ` ; `होवऽ → ɦˈob` |
| mai | `॑` U+0951 ×45 | inert, 6 words | `म॑ → mˈə` ; `क॑ → kˈə` |
| **ca** | **nothing** | — | — |
| **bpy** | **nothing** | — | — |

**Two of the brief's twelve do not exist.** `ca` ⟨h⟩ ×64 and `bpy` ⟨ৱ⟩ are artefacts of the disabled filter
and are NOT reported by the shipped detector. For `ca` the reason is the case-folding rule (Run 5 of the
detector log): Catalan reads ⟨ch⟩, so lowercase ⟨h⟩ demonstrably contributes and one contributing case
variant claims the letter. The reading is confirmed correct anyway — `hora → ˈɔɾə`, `home → ˈɔmə`,
`hivern → iβˈɛɾn`, `ahir → əˈi` — Catalan ⟨h⟩ IS silent, and the detector clears it without needing an
`ORTHOGRAPHIC_SILENCE` entry. ⚠ **No entry was added for it**, because an entry that duplicates a rule the
instrument already applies is a table row that can only drift.

**Implication.** Ten characters in eight languages to triage, not twelve in ten. Every count below is the
re-derived one.

---

## Run 2 — 2026-08-14 — the ak census: the instrument found one homoglyph and missed a bigger one

**Command.** Every character in `tools/corpus/mined/ak.jsonc` that is a letter/mark and is neither ASCII nor
one of Akan's own ⟨ɛ ɔ Ɛ Ɔ ◌̃⟩, counted.

**Question.** ⟨ε⟩ ×85 is Bambara's defect in a language nobody had read for it (detector log, Run 7, family
4). Is it alone?

**Raw finding — no. The census names a SECOND substitute the detector cannot see:**

```
ε U+03B5 x164     כ U+05DB x70      é U+00E9 x25     а U+0430 x7 …
```

⟨כ⟩ HEBREW LETTER KAF, ×70, is standing in for ⟨ɔ⟩. Its words settle it without any appeal to the code
chart: `כhene` `כyɛ` `כbεfa` `כbaa` `כdwene` `כtan` `wכn` `awoכ` `soכ` `wɔnbכ` are ɔhene, ɔyɛ, ɔbɛfa, ɔbaa,
ɔdwene, ɔtan, wɔn, awoɔ, soɔ, wɔnbɔ — and `ɔkככ` (ɔkɔɔ) and `כbofoכ` (ɔbofoɔ) carry the correct letter and
the substitute **in the same word**, which is one writer's input method rather than a different letter. The
⟨ε⟩ half is the same shape: `yε sε deε kεseε mmerε εkwan εnti εfiri`, with `ɛmmerɛ` ×2 sitting beside
`mmerε` ×2 in the same artifact.

**⚠ WHY THE INSTRUMENT REPORTED ONE AND NOT THE OTHER, which is the useful part.** `silentCharsIn` admits a
probe word only when the corpus's own script holds a MAJORITY of it (`majorityScript`) — the filter that
removes the IPA-gloss false positives. `כyɛ` is one Hebrew character against two Latin ones and `wכn` two
against one, so the ⟨כ⟩ words never reach the differential; the same filter is why ⟨ε⟩ arrived as ×85 rather
than the artifact's ×164. **A homoglyph inside a SHORT word is the shape this detector structurally cannot
see**, and the character census remains the instrument for those. That is a real limit, recorded here rather
than patched: loosening `majorityScript` is the change that brings back 60 % of the fleet's false positives.

**Also in the census, and NOT defects:** the Greek (`τ σ ς ν μ δ ο ρ ι`), Cyrillic (`а и о р л к н`) and
Tibetan runs are genuine foreign text — Russian and Greek names, quoted words — reached by the script
router, not homoglyphs. They occur in RUNS; the two homoglyphs occur inside Akan words.

**Implication.** ⟨ε⟩→⟨ɛ⟩ and ⟨כ⟩→⟨ɔ⟩, in `src/languages/akan/normalize.ts`, on the Bambara model
(`304f41d`) and for the same reason that fold cannot be global: `core/unicode.ts`'s `foldLatinConfusables`
folds toward the ASCII letter, i.e. ⟨ε⟩→`e`, and `e`/`ɛ` are two Akan phonemes. Worse than losing a vowel:
`akan.ts` resolves ATR harmony from ⟨ɛ ɔ⟩ as its unambiguous −ATR triggers, so a deleted ⟨ε⟩ removes the
evidence the REST of the word's vowels are read from.

---

## Run 3 — 2026-08-14 — item 2: where the ≥2 threshold lives, and what it was protecting

**Command.** Read `src/core/clauses.ts` (`FOREIGN_RUN`, `emitUnclaimed`), `src/core/foreign.ts`
(`pushHost`/`readForeignRun`) and `src/core/scripts.ts` (`readerFor`).

**Question.** Where is the threshold, why is it there, and what is the right behaviour?

**Raw finding — one line, `core/scripts.ts:206`, and it is GREEK-ONLY:**

```ts
if (script === "Greek" && [...run].filter((c) => /\p{Script=Greek}/u.test(c)).length < 2) return undefined;
```

`undefined` reaches `emitUnclaimed`, whose only fall-through is the Latin-to-English path — and a Greek
letter is not Latin, so control hits `continue` and the run is DISCARDED. Not passed to the host, not left
literal: gone, and (per `scripts.ts`'s own header) invisible to every leak-based check.

The reason it exists is stated in the file's KNOWN LIMIT and it is a GOOD reason: a lone Greek letter in
another script is usually MATHEMATICS, whose reading is the letter's NAME ("alpha", "pi"), not a Greek
word's phonology. Routing `α` to the Greek reader would emit /a/ — a phone where a word belongs, i.e. a
wrong reading put where there had been a silence, which is the worse trade. The recorded blocker on doing
better was that a letter-name table is "lexical data and belongs in the host language" — 193 tables.

**The blocker is false, and that is the whole fix.** A Greek letter's name is a GREEK WORD; the
international names (alpha, beta, delta, sigma) are those words borrowed. So the letter's own script
supplies its own lexical data — ONE table — and the Greek engine speaks it. Reading an embedded run with the
phonology of the script's own language is what this router already does everywhere else.

Measured against `el` before writing anything: `άλφα → alfa`, `βήτα → vita`, `γάμμα → ɣama`,
`δέλτα → ðelta`, `πι → pi`, `σίγμα → siɣma`, `ωμέγα → omeɣa`, `θήτα → θita`, `φι → fi`, `χι → çi`,
`έψιλον → epsilon`, `ταυ → tav`, `λάμδα → lamða`. Every one is recognisably the letter name.

**Implication.** Add `GREEK_LETTER_NAME` to `core/scripts.ts`, rewrite the lone letter to its name IN PLACE
(the run may carry a trailing superscript or a joining hyphen — `χ²`, gd's `γ-`), and change `readerFor` to
return `{ target, text }` so the rewrite lives beside the table that states it rather than in the registry's
callback.

---

## Run 4 — 2026-08-14 — the corpus census that changed the design: accents

**Command.** Every lone Greek letter in all 162 mined artifacts, with 30 characters of context, `el` and
`grc` excluded.

**Question.** Before shipping "a lone Greek letter is a mathematical symbol" to 193 engines — is it?

**Raw finding — TWO populations, and they separate perfectly on ACCENT.**

*Mathematics, ~34 languages, and every instance BARE:*

```
an   Antares (α Scorpii) ye una estrela
bar  de zwoa Winkl ois Ψ 1 und an ßan mit Ψ 2
gan  圓周率，一般用 π 表示
gd   2 × i, -3.14159 × i, π × i
lv   Hī kvadrāta (χ²) kritēriju izmanto
mag  एकर एसआइ इकाई ओम मीटर [Ω m] हे । … W = F.s.cosθ … Φ से प्रदशित
mn   бага эрэмбэ бүхий оройн тоог δ(G) … Δ(G)-ээр
ky   жасалма радиоактивдүү ядролор α, β, γ радиоактивдүүлүктөргө
skr  طول موج دی تبدیلی λ′ − λ صفر (θ = 0°)
su   sebaran normal mibanda méan μ = np
hyw  Խտութիւնը ρ =1260±70 քկ/մ³ … անագի α … եւ β
ab   аекватортә координатқәа α = 270°, δ = 30°
lo   ຖ້າ α = 0.15 … ລັງສີແກມມາ (ສັນຍາລັກ γ)
eu   40 000/π      gl  o número pi (π)      sn  Govano inonzi π
```

*Greek prose, exactly 2 languages, and every instance ACCENTED:*

```
crh  Yunanlar Aq deñizni sadece ἡ θάλασσα … ἡ μεγάλη θάλασσα … ἡ ἡμετέρα θάλασσα   (×5)
lg   Ελευθερία ή θάνατος (Eleftheria i thanatos)                                    (×1)
```

**A mathematical symbol is never written with a Greek accent or breathing; a Greek one-letter word always
is.** `ή` is the conjunction "or", `ἡ` the article — reading those as *ita* would be exactly the wrong
reading the threshold was defending against, and the naive fix would have introduced it in the only two
languages where the ambiguity is real.

**Implication.** Name the lone letter only when it is BARE (`normalize("NFD").length === 1`, so a
precomposed `ή` is caught as surely as a combining `ἡ`). The two prose cases stay declined — unchanged by
this fix rather than newly mis-read. This is a discrimination the corpus made, not one that was reasoned to.

---

## Run 5 — 2026-08-14 — the fleet sweep, before and after

**Command.** `phonemize("xa γ ax", L) === phonemize("xa ax", L)` over all 193 registered codes — "is the
lone letter contributing anything at all". Run against the working tree and against a read-only extraction
of `HEAD` (`git archive HEAD src tools … | tar -x`; no `git checkout`/`stash`/`restore` anywhere).

**Question.** Exactly which engines move, and does any engine break?

**Raw finding.**

| tree | letter is read | letter contributes nothing | errored |
|---|---|---|---|
| HEAD (before) | **2** — `el`, `grc` | **191** | 0 |
| working tree (after) | **193** | **0** | 0 |

The two exceptions before the fix are the two engines that OWN the script, where the router declines because
the target equals the host. 191 of 193 is the same fact `core/markup.ts` recorded as "186 of 188" at the
fleet size of that week.

Spot checks on the corpus lines from Run 4, after:

```
an   Antares (α Scorpii) ye una estrela  →  antaɾes alfa skoɾpji ʝe una estɾela
gd   π × i                               →  pi ˈi
gd   γ-iarann                            →  ɣama ˈiərˠən̪ˠ        (the recorded gd case)
mn   δ(G)                                →  ðelta d͡ʒˈiː
mag  [Ω m]                               →  omeɣa ˈɛm
ky   α, β, γ                             →  alfa , vita , ɣama
su   μ = np                              →  mi sarˈua d͡ʒɨŋ np
en   The value is α                      →  ðə vˈæɫjuː ɪz ˈalfa
si   Παν                                 →  pan                   (the recorded regression case, unchanged)
lg   Ελευθερία ή θάνατος                 →  elefθeɾia θanatos      (UNCHANGED — accented, still declined)
crh  sadece ἡ θάλασσα                    →  sɑdeˈd͡ʒe θalasa       (UNCHANGED — accented, still declined)
```

**Gate.** `npx vitest run`: 4,130 passed, **1 failed** — `test/markup-entities.test.ts`'s
"a lone Greek letter is deleted but a run is read", which PINS THE OLD DEFECT. Its own file header says the
declines "are not assertions that the current reading is good… if the lone-foreign-letter fall-through is
ever fixed, these cases should be revisited". Updated to pin the new behaviour, plus a new case pinning the
accented decline. `test/foreign-runs.test.ts`'s threshold assertion was passing by luck (it asserted the
absence of the ENGLISH letter name `ˈaɫfa`, and the Greek reading is `alfa`); rewritten to assert the
reading positively and to assert that the letter is NOT routed as Greek text.

⚠ `test/onnx-optional.test.ts` did not fail on this run; the known 5-second timeout under load did not fire.

**The entity table is NOT touched.** Six Greek entities were declined from `core/markup.ts` because decoding
them fed the decoder's output into this deletion. That blocker is now gone, but the file's own header asks
for the six to be revisited "together, not one entity at a time", and `core/markup.ts` is a sibling's file
this week. The test comment records that the blocker is removed and that the revisit should start from a
measurement.

**Implication.** Item 2 lands. 191 engines gain a reading, 0 lose one, 2 corpus lines in 2 languages are
deliberately left exactly as they were.

---

## Run 6 — 2026-08-14 — the fleet corpus measurement for the router, artifact by artifact

**Command.** `corpus-diff.ts emit` on both trees (`252402e`, pre-router; `47d79fc`, post-router) for the
**70 mined artifacts that contain any Greek character** — the other 92 cannot change, since the router only
sees Greek — then `compare` on each.

**Question.** The engine-level sweep says 191 of 193 gain a reading. On real corpus text, which artifacts
actually move, and is every movement an improvement?

**Raw finding — 38 of 70 artifacts move; leak/DROP counters identical on every one.**

```
ak 33/237 (13.9%)   su 16/447   nci 9/377   syl 8/298   shi 7/402   gd 5/441   bar 4/450   lv 4/458
mag 4/302   an 3/447   cdo 3/393   gan 3/368   lo 3/431   skr 3/436   tg 3/454   + 23 more at 1–2 lines
```

Read by hand, they are the letter names in mathematics — `π` → *pi* in shi's article on pi, `ε β` →
*epsilon vita* in nci's isotope-decay table (electron capture and beta decay), `φ`/`θ` → *fi*/*θita* in gd's
spherical-coordinate formula, `μ` in su's statistics articles.

**⚠ AND THE OUTLIER IS THE FIND.** `ak` at 13.9 % is not mathematics: it is the ⟨ε⟩ HOMOGLYPH of Run 2.
Before the router change the Greek epsilon inside `yε` was deleted; after it, the ak tokenizer claims the
⟨y⟩, leaves ⟨ε⟩ in the gap, and the gap is a LONE Greek letter — so `yε kuro` read **`j epsilon kuro`**.
The router fix turned ak's silent deletion into a spoken *epsilon*, which is the worse trade this class
exists to avoid, and only the homoglyph fold in the same branch takes it to the correct `jɛ kuro`.

⚠ **This also corrects the census in Run 4.** That census counted runs in the RAW TEXT; the unit the router
actually sees is the gap left by the HOST TOKENIZER, and a mid-word homoglyph produces a lone run there that
the raw-text census cannot see. The two measurements are not interchangeable, and the corpus diff is the one
that found it. `shi` ⟨ε⟩ ×3 was checked for the same shape and is not it — shi's seven moved lines are all
`π`.

**KNOWN RESIDUAL, recorded and not fixed: ⟨Ω⟩ AS THE OHM.** nci's `m⁻¹·Ω⁻¹`, mag's `[Ω m]` and sq's `10¹⁴Ω`
use the Greek capital as the UNIT symbol, and it now reads *omeɣa* — the letter's name where the unit's name
belongs. It was deleted before, so nothing got worse; but the right owner is the units tier, which needs a
word for "ohm" per language, and that is the lexical-data problem all over again. Four lines in three
artifacts.

**Implication.** The router fix is sound and its one dangerous interaction is in this branch and fixed by
it. A future engine that carries a Greek homoglyph for one of its own letters will now SAY a letter name
instead of silently dropping it — which is louder, and therefore easier to find, than what it did before.

---

## Run 7 — 2026-08-14 — `he` ⟨א⟩: not silent, and the detector's sampling is why it looked it

**Command.** Every distinct Hebrew-script word of the artifact containing ⟨א⟩ (1,714 of them; 1,485
initial-aleph occurrences against 2,986 non-initial), read with and without the letter. Then the same probe
selection `silentCharsIn` makes, reproduced step for step.

**Question.** `phonemize("אב","he")` is `ʔv`, so ⟨א⟩ is not silent everywhere. What does ×4,618 rest on?

**Raw finding — it rests on EIGHT WORDS OUT OF 399, and 30 % of the population contradicts them.**

Of the first 400 distinct aleph words, the letter **contributes in 121 and is inert in 279**. The
contributing ones are word-initial, where the engine emits a glottal stop:

```
אליו → ʔljv  (without: ljv)      אדם → ʔdm      אז → ʔz      אחרת → ʔχʁt      אזרח → ʔzʁχ
```

The detector's own selection, reproduced: 399 words pass the core-inventory filter, `spread` takes a fixed
stride of 8 across that list, and the 8 it lands on are `קלארק כאל בגאזטים האמנויות להיראות האחרות ראשת
מדינאי` — **every one with a non-initial aleph**, where the letter is a mater lectionis and an engine
reading a consonantal skeleton correctly emits nothing for it. Raising the sample to 12 or more disproves
universality immediately.

**⚠ THE VERDICT IS THEREFORE `he` ⟨א⟩ = FALSE POSITIVE, and it is NOT an `ORTHOGRAPHIC_SILENCE` entry.** An
entry there is a claim about the writing system — "Hebrew ⟨א⟩ is read as nothing" — and `אב → ʔv` falsifies
it in the first word anyone would try. Using the exemption table to quiet this would be exactly the hatch
the table's own header forbids.

**Implication.** The parameter, not the language, is what this finding is about. See Run 8.

---

## Run 8 — 2026-08-14 — REJECTED: raising `PROBE_WORDS`

**Command.** `silentCharsIn` over all 162 artifacts through the shipped code path, at `PROBE_WORDS` = 8, 16,
24 and 32, and the findings diffed.

**Question.** Run 7 names a parameter as the cause. Is raising it the fix?

**Raw finding — NO. It buys one false positive for four true ones.**

| PROBE_WORDS | findings | fleet run time |
|---|---|---|
| 8 (shipped) | **83** | ~13 s |
| 16 | 78 | ~13 s |
| 24 | 76 | ~13 s |
| 32 | 76 | ~13 s |

Cost is not the objection — the whole fleet is 13 seconds at every setting. WHAT it removes is. The five
findings that 8 → 16 drops are `he` ⟨א⟩ and **four the class's own log names as real defects**: pnb ⟨ء ى⟩
and shn ⟨ၻ ၿ⟩. The disproving words, read by hand:

```
pnb  تھى → t̪ʰˈə   without ⟨ى⟩: t̪ʰ          a VOWEL — disproved as honestly as ⟨א⟩ is
pnb  ءمقرر → əmˈəqɾəɾ  without: mˈəqɾəɾ      likewise
shn  …ႃၻိတ်… → …ʔaː˨˦taː…  without: …ʔaːt̚˨˦taː…   a coda t̚ APPEARS when the letter is removed
shn  …ပီၿီႇ… → …piː˨˦…      without: …piː˩…        a TONE moves
```

pnb's two are genuine contributions. shn's two are KNOCK-ONS — the character perturbs its neighbours rather
than carrying a phone of its own — so raising the parameter would silence two real findings on the strength
of a side effect. 24 drops two more of the same shape.

**Implication. REJECTED, and for the reason this file's header already rejects one filter: it removes true
positives faster than false ones.** ⟨א⟩ joins the three residual false positives Run 7 of the detector log
NAMED rather than narrowed around (ki ⟨ə⟩, lt ⟨ˈ⟩, bar ⟨ː⟩); the mechanism and this whole table are written
into `PROBE_WORDS`'s comment in `defects.ts`, so the next person to reach for the number finds the
measurement instead of repeating it. ⚠ There is a second reason not to move it in THIS branch: pnb and shn
are two other batches' languages, and a shared-tool parameter change would silently rewrite their inputs
mid-flight.

---

## Run 9 — 2026-08-14 — the fixes, and what each one is sourced on

**`ak` ⟨ε⟩ U+03B5 ×85 (artifact ×164) and ⟨כ⟩ U+05DB ×70 → DEFECT, fixed.** See Run 2. Bambara's model,
Akan's own alphabet as the target. `εwɔ → wɔ` becomes `ɛwɔ`; `כhene → hene` becomes `ɔhene`.

**`ak` ⟨ʻ⟩ U+02BB ×3 → UNDECIDED, left reported.** All three occurrences are in ONE sentence and ONE proper
name: `Tonga() (Puleʻanga Fakatuʻi ʻo Tonga) yε ɔman.` The character is the Tongan okina, a glottal stop in
TONGAN; Akan's alphabet has no such letter and this engine has no glottal-stop grapheme to route it to.
Reading it would mean giving an Akan engine a phone on the evidence of one foreign name. Its damage is
`separator` mode — an extra pause inside the name — which is small and honest. Reported, not exempted.

**`gn` ⟨◌̃⟩ U+0303 ×82 → DEFECT, fixed.** The saltillo's sibling, missed when the saltillo was fixed. Value
from the four-way approximant paradigm this engine already had three corners of; the deletion happened in
`makeNativiser`, not the scan. See the note on `TILDE` in `guarani.ts`.

**`he` ⟨א⟩ U+05D0 ×4,618 → FALSE POSITIVE.** Runs 7–8.

**`he` ⟨ְ⟩ U+05B0 ×43 → UNDECIDED, left reported, and the reason is that there is no niqqud path to decide
it in.** Modern Israeli Hebrew reads sheva as /e/ or as zero by a small set of phonological conditions
rather than by the traditional na/nach classification — under the first of two identical consonants, word-
initially before a sonorant /j l m n r/, before ⟨א ה ע⟩, under the ב ו כ ל prefixes — and this engine's
synchronous path emits a consonantal skeleton with no vowel machinery at all (`ראש → ʁʃ`, `אני → ʔnj`). So
a blanket-silent sheva is not a defect of this character; it is one instance of the engine's unvocalized
contract, and the ×43 is entirely inside foreign transliterations (`ינְג`, `נְג` — "-ing"). It belongs with
vowel restoration, not with a grapheme fix, and it is reported so that decision is made rather than
defaulted into.

**`ca` ⟨h⟩ and `bpy` ⟨ৱ⟩ → DO NOT EXIST.** Run 1. The shipped detector does not report either. Catalan ⟨h⟩
IS silent (`hora → ˈɔɾə`, `home → ˈɔmə`, `hivern → iβˈɛɾn`) — correct, and the case-folding rule clears it
without a table entry, so none was added.

**`wo` ⟨h⟩ ×252 → DEFECT, fixed.** ⟨h⟩ is in the 2005 orthography decree's 21-consonant list and the decree
puts it inside a phonological rule ("toutes les consonnes peuvent être géminées à l'exception de f, h, q, s,
et x") — a silent letter is not named in a rule about which consonants may geminate — and cites the native
derived form `lehal`. Value /h/. `sahraa → saraː` becomes `sahraː`.

**`hr` ⟨w⟩ ×19, ⟨y⟩ ×10 → DEFECT, fixed, and ⟨x q⟩ found beside them.** Gaj's Latin has 30 letters and none
of these four; the readings are taken from what Croatian writes when it ADAPTS the spelling (*taksi*,
*kviz*, *Velšani*, *Dilan*). Four neighbours already do it (sl, cs, sk, pl); this engine and its two
Serbo-Croatian siblings did not.

**`awa` ⟨ऽ⟩ ×12 → LEGITIMATE, left reported.** Every instance is word-MEDIAL before the oblique/plural ⟨न्⟩
or purposive ⟨य् व्⟩ suffix, and the engine ALREADY emits the vowel the sign asserts — all twelve read
identically with the mark and without it, and correctly. Not put in `ORTHOGRAPHIC_SILENCE`: an entry is a
claim that Awadhi ⟨ऽ⟩ is silent, and a word-final avagraha would falsify it. `retainOnAvagraha` was set
anyway for that unattested case; measured corpus change **0 of 393 lines**.

**`mag` ⟨ऽ⟩ ×37 → DEFECT, fixed.** Magahi is the language the grammar description NAMES for this use, with
its own minimal pair (बइठऽ *baiṭha* vs *बइठ *baiṭh*), and all ×37 are word-final on imperative/participial
stems. `retainOnAvagraha`. `करऽ → kˈəɾ` becomes `kˈəɾə`.

**`mai` ⟨॑⟩ U+0951 ×45 → DEFECT, fixed, and the corpus proves it against itself.** The same words occur in
the artifact under BOTH spellings — `कऽ` ×65 beside `क॑` ×9, `लऽ` ×19 beside `ल॑` ×1, `मऽ` ×1 beside `म॑`
×22 — so U+0951 is this corpus's second spelling of the avagraha the manifest already reads, not a Vedic
accent. Folded, so no phone is invented. ⚠ Its measured reach is ONE WORD: 44 of the 45 are monosyllables
where `retainInMonosyllable` already keeps the vowel, and only `अब॑` changes (*ˈəb* → *ˈəbə*).

---

## Run 10 — 2026-08-14 — the gates

**`corpus-diff.ts emit`/`compare`, baseline at `47d79fc` so the router change is not counted twice.**

| language | changed | leak/DROP counters |
|---|---|---|
| ak | 32/237 (13.5 %) | identical |
| gn | 63/430 (14.7 %) | identical |
| wo | 114/405 (28.1 %) | identical |
| hr | 24/109 (22.0 %) | identical |
| mag | 18/302 (6.0 %) | identical |
| awa | **0/393 (0.0 %)** | identical |
| mai | 1/408 (0.2 %) | identical |

**`referee-eval.ts`, before and after.**

| language | before | after |
|---|---|---|
| ak | 91.8 % | 91.8 % |
| gn | 94.9 % / 94.4 % | 94.9 % / 94.4 % |
| mai | 93.8 % | 93.8 % |
| awa | 98.5 % | 98.5 % |
| **wo** | **98.9 %** | **98.6 %** |
| hr | — | — (no referee configured for hr) |

⚠ **THE ONE MOVEMENT IS wo, AND IT IS ONE WORD OUT OF 69.** The referee's ENTIRE evidence about ⟨h⟩ is a
single entry — `inchaalaaxu → inʃaːlaːxu` — and it is not a Wolof ⟨h⟩ at all: it is the French digraph
⟨ch⟩ = /ʃ/ in an Arabic loan spelled the French way. Before the fix the engine read `incaːlaːxu` (⟨c⟩ = the
palatal stop, the ⟨h⟩ deleted); it now reads `inchaːlaːxu`. Neither is the referee's /ʃ/; the old one was
one symbol away and the new one is two. Adding a ⟨ch⟩ → ʃ digraph would fit the referee exactly, and it is
NOT done: the mined artifact contains no Wolof ⟨ch⟩ at all — its twenty `ch` tokens are English, German and
French (`which`, `Technische`, `Rochester`, `l'arachide`) — so a digraph on one referee word with zero
corpus support is fitting noise, which is the judgement `maithili.jsonc` already records for its own
two-word case. The 69-word referee simply cannot corroborate Wolof ⟨h⟩ in either direction; the decree can,
and the corpus's own `laahi` ×4, `Ahmadu` ×5, `Sheex` ×3, `huun` ×2 are what the fix is for.

**`mine.ts scan`** — ⟨ε⟩ gone from ak, ⟨◌̃⟩ from gn, ⟨h⟩ from wo, ⟨ऽ⟩ from mag, ⟨॑⟩ from mai; hr reports
**no defects** at all. ak still reports the Tongan ⟨ʻ⟩ ×3 and awa still reports ⟨ऽ⟩ ×12 — both by decision,
per Run 9.

**`review.ts --lang`** — unchanged in every case: ak and gn keep the same 2 FAILING checks they had (`DROPPED:
minus` and the artifact scan); wo, mag, awa and mai keep their one pre-existing `normalizer … missing`; hr
reports none.

**`npx vitest run`** — 4,131 passed, 1 failed, and the failure is a GOLDEN pinning a deletion:
`test/croatian.test.ts`, `George W. Bush` → `ɡeorɡe busx`, i.e. the middle initial vanishing. Updated to
`ɡeorɡe ʋ busx`, with `George V. Bush` added beside it as the comparison — this engine already reads a lone
initial as its bare phone (`V.` → *ʋ*, `B.` → *b*, `X.` → *ks*), so ⟨W⟩ has joined them rather than acquired
a new convention. `npx tsc --noEmit` clean.
