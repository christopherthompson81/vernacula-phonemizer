# en-gb-lexical.tsv — British lexical variants

`word` → the GenAm-alphabet citation the en-GB accent delta starts from, replacing the one the
parent's dictionary produced.

## What belongs here, and what does not

The other five tables in this directory (BATH, CLOTH, yod, PALM, LOTR, marry) are **accent**
data: they say how the *same word* is realised differently in SSBE. This one is for the case
where the two varieties do not use the same word.

`aluminium` is the type specimen. GenAm reads the British spelling as the American word —
CMUdict's own row is `aluminium AH0 L UW1 M IH0 N AH0 M`, i.e. /əˈluːmɪnəm/, which is the
correct GenAm reading and is what `en` ships. British is /ˌæljʊˈmɪniəm/: five syllables against
four, stressed on a different one. No phonological transform gets from one to the other, and a
transform powerful enough to try — inserting a syllable, moving the stress — would be able to do
it to words that merely *sound* different, which is the class the rest of this directory exists
to handle correctly.

A row here therefore has to clear a bar that an accent-set row does not: **the difference must
survive every accent rule**, not merely be unreachable by one of them. Vowel-quality differences
(`ə` vs `ɪ` in `apricot`) and weak-vowel reduction (`ˌɛɹi` vs `əɹi` in the -ary family) are NOT
lexical variants — the first is the parent's own weak-vowel question, the second is a productive
rule this accent is still missing. Neither belongs in this file.

## How the rows were produced

Hand-written, one at a time, and **every row checked against the wikipron UK referee**
(`tools/referee-eval/referees/en-gb.wikipron-uk.tsv`, 76,284 headwords, the same referee the
lexical sets are built from). A candidate enters only when:

1. the shipped en-GB render currently matches **no** attested variant under the eval's own fold, and
2. the citation written here makes it match one, after the full delta has run.

⚠ **AND CRITERION (2) CANNOT BE MET FOR A STRESS ROW, WHICH IS NOT A REASON TO REFUSE ONE.** The eval's
backbone STRIPS STRESS before comparing, and this referee carries no stress marks anyway, so a row whose
only change is which syllable is stressed is invisible to the measurement in both directions. `ballet`
folds to `bæleɪ` before the row and after it, against the referee's `baleɪ`; it was a miss before and is
a miss after, and the æ/a is a NOTATION difference this variety does not fold. **A row admitted on the
second source below is therefore exempt from criterion (2) where the primary source cannot arbitrate what
the row changes** — and the reason is written on the row, so the exemption cannot be claimed silently.

A word the referee does not list, or lists only in a form that looks like US contamination, was
left out rather than guessed at. **That is no longer the last word — see the second source below.**

## The second source: espeak-ng's en-gb dictionary

#1383 named the wikipron UK referee's coverage as the actual blocker: it is dominated by rare, proper
and foreign words, so it is weakest on exactly the common vocabulary this class lives in. `schedule`
was the proof — the best-known member of the class and no row at all.

**espeak-ng's en-gb voice is admitted as a SECOND source, and the bar is a PER-WORD HUMAN DECISION in
its dictionary sources, not the bare output of the binary.** Those are different things and the
distinction is the whole safeguard:

- an entry in `dictsource/en_list` — someone wrote that word's reading down;
- a VARIANT-CONDITIONAL line in `dictsource/en_rules` — someone wrote down that the two varieties
  differ here, and which one is marked;
- **anything else is the binary's letter-to-sound rules**, which is a G2P guess of exactly the kind
  this engine already makes. A guess from another engine is not evidence about a word.

⚠ **THE DICTSOURCE-NOT-BINARY BAR IS ALSO WHAT KEEPS THIS FILE OUT OF THE GPL FENCE.** espeak-ng is
GPL-3.0 and `data/LICENSES/PROVENANCE.md` §5.1 reads its dictsource **as plain files**, consulted and not
shipped. Three rows here rest on one decision each and the shipped value is the parent's own CMUdict row
with that one feature rewritten — no espeak phoneme string is reproduced — which is the
`catalan/mid-vowels.tsv` shape (§1, Facts), not `pashto/lexicon.tsv`'s (§4, per-file GPL fence, where
95.4% of rows are reachable only from the GPL source). Exact citations, and the note that the binary was
a SEARCH step only, are in §5.1 item 5.

⚠ **AND THE SECOND SOURCE DOES NOT OUTRANK THE ENTAILMENT RULE FOR INFLECTIONS.** espeak reads
`ballets` as `bˈaleɪs`, with a voiceless /s/ that is simply wrong; its inflections are rule-derived.
Inflected rows keep coming from the lemma's citation plus the PARENT's own suffix, as before.

| word | what the second source actually says | verdict |
|---|---|---|
| `schedule` | `en_rules:5871` carries `?3  sch (ed  →  sk` — a variant-conditional rule marking GENERAL AMERICAN as the exception (`?3` = dictrules 3, set by `lang/gmw/en-US` and no other `en` voice). The British /ʃ/ is the default someone left in place while writing `school`, `scheme` and `schizoid` out of it. | **admitted** |
| `leisure` | a PER-WORD PAIR: `en_list:2407 leisure lEZ3` and `en_list:2408 ?3 leisure li:Z3`. And the PRIMARY source corroborates it sideways: wikipron's `leisure` row is the contaminated `liʒɚ`, but its **`leisurely` row is `lɛʒɜli`** — the DRESS vowel was in the referee all along, under a different headword. | **admitted** |
| `ballet` | a PER-WORD PAIR: `en_list:1044 ballet baleI` and `en_list:1045 ?3 ballet bal'eI`. ⚠ **THE PAIR IS THE EVIDENCE, NOT THE BASE ENTRY** — the base row carries NO stress mark at all, so quoting it alone would leave "espeak's default stress rule put the accent on the first syllable" wide open; it is the `?3` companion, which moves the mark to the second syllable FOR GENERAL AMERICAN, that makes it a decision about this word. wikipron carries no stress marks, so the primary source could never have settled it. | **admitted** |
| `oregano`, `laboratory` | `en_list` entries, corroborating wikipron exactly. | still blocked, and NOT by the sources — see below |
| `hertford` | attested by both. A PROPER NOUN, which is a much larger door and stays shut deliberately. | left out |

⚠ **THE `schedule` ROW IS A FAMILY, NOT A LEMMA, AND THE EVIDENCE IS WHY.** `leisure` and `ballet` rest on
`en_list` entries, which are per-word, so they take their lemma and its regular inflections and stop.
`schedule` rests on a SPELLING RULE over `sch` before `ed`, which fires wherever that sequence appears — so
the evidence itself covers `scheduler`, `unscheduled` and `reschedul*` exactly as it covers `schedule`, and
espeak reads all ten with /ʃ/ against /sk/. Stopping at the three inflections would have put "the schedule"
beside "the scheduler" in one sentence with the most audible contrast in the word class flipping between
them. All ten are here.
⚠ **AND EXTENDING TO THE FAMILY IS WHAT FOUND THE PRIMARY SOURCE'S ONLY ROW FOR THE CLASS.** `reschedule`
is a HIT under the eval's own fold — wikipron lists `ɹiːʃɛdjuːl` beside `ɹiːskɛdjuːl` — so the /ʃ/ reading
this whole family rests on is directly attested by the PRIMARY referee after all, at a headword the lemma
sweep never reached. `scheduler`/`schedulers` are listed with both readings too, and miss only on the weak
vowel (our `ʊ` against its `ə`), which is a different question from the one these rows answer.
⚠ **`reschedulings` IS DELIBERATELY ABSENT.** Its dictionary row is `R IY0 SH K EH1 JH UW0 L IH0 NG Z` —
an `SH K` cluster no one says, a defect in the PARENT that predates this work. A row here would bake it in.
Recorded rather than fixed in passing: it wants the triple-source audit like any other curated row.

⚠ **`oregano` AND `laboratory` ARE BLOCKED BY THIS FILE'S OWN EXEMPTION, NOT BY EVIDENCE.** Both British
readings need **ɒ** — /ˌɒrɪˈɡɑːnəʊ/, /ləˈbɒrətri/ — and a table-owned word is exempt from the LOT rule
(see the last section). Getting the ɒ would mean hand-writing it into a citation this file documents as
being in the parent's GenAm alphabet, i.e. re-implementing LOT inside the table and freezing it there;
and it would not even suffice for `oregano`, whose `ɔːɹ` is NORTH and was never LOT's to touch. They need
a finer exemption — phonological rules yes, set rules no, with LOT on the phonological side — which is a
design change and not a row.

## Why the value is in the parent's alphabet

So that the accent delta still runs over it. `clerk` is stored `klˈɑːɹk` and START turns it into
`klˈɑːk`; storing the finished `klˈɑːk` would freeze a reading that then silently stopped tracking
every later rule change. A word that needs a lexical-set membership joins that set in the ordinary
way — `tomato` is in `en-gb-palm.tsv` because in RP it genuinely is a PALM word, and without that
row the LOT rule turns its /ɑː/ into /ɒ/.

## Rows

| word | why it is lexical, not accent |
|---|---|
| aluminium | different word form: five syllables against four, different stress |
| buoy | /bɔɪ/ against /ˈbuːi/ — a different vowel entirely, not a realisation of one |
| clerk | NURSE in GenAm, START in British; the NURSE rule cannot produce it |
| derby | the same NURSE/START swap |
| figure | British has no yod here; GenAm /ˈfɪɡjɚ/ |
| herb | British keeps the /h/; GenAm drops it |
| lever | /ˈliːvə/ against /ˈlɛvɚ/ — FLEECE against DRESS |
| lieutenant | /lɛfˈtɛnənt/ against /luːˈtɛnənt/ — a consonant no rule inserts |
| ballet | stress on the FIRST syllable in British, the second in GenAm — a stress difference no accent rule makes |
| leisure | /ˈlɛʒə/ against /ˈliːʒɚ/ — DRESS against FLEECE |
| schedule | /ˈʃɛdjuːl/ against /ˈskɛdʒuːl/ — a different first consonant AND a yod; the whole `sched` family, see below |
| process | GOAT in British, LOT in GenAm — /ˈprəʊsɛs/ against /ˈprɑːsɛs/; no rule turns LOT into GOAT |
| progress | the same LOT/GOAT swap, in the NOUN only — see below |
| tomato | PALM in British, FACE in GenAm |
| vitamin | KIT in British, PRICE in GenAm |

Provenance of the readings themselves: the wikipron UK referee, which is derived from English
Wiktionary's UK pronunciations (CC BY-SA 3.0; see `data/LICENSES/`). The rows are transcriptions
of readings that referee attests, rewritten into this engine's parent alphabet.

## Attested or entailed — every row is marked

⚠ **A LEMMA IS REFEREE-ATTESTED AND AN INFLECTION IS ENTAILED**, and the difference is written down here
so no one later mistakes one for the other. The bar for a lemma is unchanged: a row in
`tools/referee-eval/referees/en-gb.wikipron-uk.tsv` attesting the British reading. That bar cannot be met
for most inflections — the referee has rows for **two of them** — and adding only those two would leave
the table lumpy with most of the inconsistency it exists to remove still in place.

An inflected row's citation is therefore **the lemma's citation plus the suffix the PARENT itself
produced** for that form, so the suffix's voicing is the parent's and not hand-invented: `clerks` takes
its /s/ from `klˈɝks`, `levers` its /z/ from `lˈɛvɚz`, `herbs` its /z/ from `ˈɝbz`. Where the referee
DOES attest an inflection it is a **check, not the source** — and both rows it has agree with the
entailment, which is the evidence the entailment is sound.

| row | basis |
|---|---|
| `aluminium` | attested |
| `buoy` | attested |
| `clerk` | attested |
| `derby` | attested |
| `figure` | attested |
| `herb` | attested |
| `lever` | attested |
| `lieutenant` | attested |
| `tomato` | attested |
| `vitamin` | attested |
| `ballet` | attested — SECOND SOURCE (stress; the primary carries no stress marks) |
| `leisure` | attested — SECOND SOURCE, and the primary corroborates it via `leisurely` |
| `schedule` | attested — SECOND SOURCE only; the primary has no row at all |
| `ballets` | entailed from `ballets` |
| `leisured` | entailed from `leisured` |
| `scheduler` | family — the `?3 sch (ed` rule covers it; both sources read /ʃ/, and both keep the weak vowel |
| `schedulers` | family — as `scheduler`, plus the parent's own `z` |
| `unscheduled` | family — the `?3 sch (ed` rule covers it |
| `reschedule` | family — and **attested by the PRIMARY referee**, `ɹiːʃɛdjuːl` beside `ɹiːskɛdjuːl` |
| `rescheduled` | family — entailed from `rescheduled` |
| `rescheduling` | family — entailed from `rescheduling` |
| `leisurely` | attested AND entailed — they agree |
| `scheduled` | entailed from `scheduled` |
| `schedules` | entailed from `schedules` |
| `scheduling` | entailed from `scheduling` |
| `process` | attested |
| `progress` | attested — GUARDED on the noun reading |
| `processed` | attested AND entailed — they agree |
| `processes` | attested AND entailed — they agree |
| `processing` | attested AND entailed — they agree |
| `progresses` | entailed from `progresses` — GUARDED on the noun reading |
| `buoyed` | entailed from `buoyed` |
| `buoying` | entailed from `buoying` — see the struck-through refusal below (#1387) |
| `buoys` | entailed from `buoys` |
| `clerks` | attested AND entailed — they agree |
| `figured` | entailed from `figured` |
| `figures` | attested AND entailed — they agree |
| `figuring` | entailed from `figuring` |
| `herbs` | entailed from `herbs` |
| `levering` | entailed from `levering` |
| `levers` | entailed from `levers` |
| `lieutenants` | entailed from `lieutenants` |
| `tomatoes` | entailed from `tomatoes` |
| `vitamins` | entailed from `vitamins` |

⚠ **WHY THE INFLECTIONS ARE NOT OPTIONAL.** Keying the override on the exact surface word made the lemma
right and left the inflection wrong IN THE SAME SENTENCE — `clerk` klˈɑːk beside `clerks` klˈɜːks, and
`herb`/`herbs` with the /h/ appearing and disappearing. Before the table both were wrong and CONSISTENT.
A change that introduces an inconsistency which did not previously exist is not an improvement on the
promise of a follow-up.

⚠ **A ROW MAY NAME THE READING IT REPLACES, AND `progress` IS WHY.** The substitution is POS-BLIND and the
parent is not: `english.jsonc` ships `progress` as `pɹˈɑːɡɹɛs` for the noun and `pɹəɡɹˈɛs` for the verb,
and an unconditional replacement put the NOUN's citation into a VERB frame — *"we progress quickly"* read
`pɹˈəᶷɡɹɛs`, which is not RP, not GenAm and not any speaker. **That is the wrong-within-one-sentence failure
the inflection rows exist to prevent, arriving through the lemma instead.**

So a row may carry an optional THIRD FIELD — the GenAm reading it is allowed to replace — and applies only
when the parent actually produced it. A row without the field is unconditional, which is correct for the
words that have exactly one reading; a word that GAINS a second one later is why the guard is a field rather
than a note here.

⚠ **AND `progresses` HAD THE SAME DEFECT ONE WORD AWAY.** `english.ts` resolves a heteronym's regular
`-s`/`-es` plural through the SAME entry, so the plural row was clobbering the verb too. Review found the
lemma; the SWEEP found the plural, and the sweep is now the test — every row whose word (or whose `-s`/`-es`
base) has a marked sense must carry the guard.

⚠ **`progressed` AND `progressing` ARE REFUSED BECAUSE THE PARENT ALREADY READS THEM AS VERBS.** CMUdict
stresses the noun `progress` on the first syllable (`P R AA1 G R EH2 S`) and the participles on the second
(`P R AH0 G R EH1 S T`), so `progressed` is `pɹəɡɹˈɛst` in BOTH varieties and there is no lexical difference to
record. The LOT/GOAT swap this row exists for lives in the STRESSED first syllable, which those forms do not
have. The referee has no row for either, and entailing one from the noun would have MANUFACTURED a difference
rather than recorded one — the mirror of the `buoying` case below. `progresses` keeps the noun's stress in the
parent, so it is entailed in the ordinary way.

⚠ **AND `premier` IS NOT HERE, THOUGH THE ISSUE LISTED IT.** Its referee rows (`pɹɛmiə`, `pɹɛmjə`, …) look
like a miss against our `pɹɛmˈɪə`, but espeak-ng's en-gb voice reads it `pɹˈɛmɪə` — segment-for-segment ours.
The disagreement is the referee writing `i` where we write `ɪ`, i.e. NOTATION, and a lexical row would freeze
a reading that is already correct. #1383's table listed it under "the referee writes a different symbol", and
that is what it turned out to be.

⚠ **ONE INFLECTION IS REFUSED RATHER THAN ENTAILED**, because the entailment does not hold. It was TWO
until #1387; the struck-through entry below is kept because the reason it stopped being refused is worth
more than the tidiness of deleting it:

- ~~`buoying`~~ — **THIS REFUSAL WAS CORRECT AND IS NOW OBSOLETE, AND THE REASON IS THE INTERESTING
  PART.** It read: *"the parent is self-inconsistent: `buoy` is `bˈuːi` but `buoying` is `bˈɔᶦɪŋ`, so
  the inflected form is not the lemma's form plus a suffix. It also already produces the British
  reading."* Both halves were true, and the second is why nobody looked further: **the word was WRONG in
  `en` and accidentally RIGHT in en-GB**, so the British side had no symptom. #1387 fixed the parent
  (`buoying B OY1 IH0 NG → B UW1 IY0 IH0 NG`, the paradigm's own majority, with Moby's `buoyage` on the
  same side), which removed the accident and split the en-GB paradigm for the first time. The row exists
  now, entailed in the ordinary way. ⚠ **A REFUSAL JUSTIFIED BY AN ACCIDENT ELSEWHERE DOES NOT SURVIVE
  THE ACCIDENT BEING FIXED**, and nothing would have told us — the note is kept struck through rather
  than deleted so the next one is recognisable.
- `tomatos` — a CMUdict spelling variant whose parent adds a secondary stress (`təmˈeᶦtʰˌoᶷz`).

⚠ **`derbies` AND `levered` ARE ABSENT BECAUSE THE PARENT HAS NO ROW FOR THEM**, and their OOV readings
cannot be entailed from: `derbies` decodes as `dˈɝbiʲiz`, with a doubled vowel the entailment would
propagate straight into the table. The guard is dictionary membership, and this is what it is for.

⚠ **THE `schedule` PARADIGM SPLIT WAS OURS, NOT CMUdict'S, AND IT IS FIXED IN THE PARENT RATHER THAN
PAPERED OVER HERE.** An earlier draft of this file blamed CMUdict for `UW2` in the lemma against `UH0` in
the inflections, and had the inflected citations override the stem vowel to compensate. The blame was
backwards: `g2p-curated.tsv` reads `schedule / S K EH1 JH UH0 L / S K EH1 JH UW2 L / frequency audit:
gold+Moby agree` — **upstream was `UH0` throughout, and our own curated layer changed the lemma and left
the three inflections behind.** So `en` itself said `skˈɛd͡ʒˌuːɫ` beside `skˈɛd͡ʒʊɫd`, which is the
wrong-within-one-sentence failure this table exists to prevent, in the PARENT, hidden by an en-GB override.
Three curated rows now carry the lemma's `UW2` into `scheduled`, `schedules` and `scheduling`, and every
citation here is once again the parent's own row with ONE rewrite and no stem-vowel override.
⚠ **AND `scheduler`/`schedulers` KEEP `UH0`, WHICH IS NOT THE SAME DEFECT.** Both sources say the vowel
really does reduce there — espeak `ʃˈɛdjʊlə`, wikipron `skɛdjələ` → `ʃɛdjələ` — so normalising the whole
family to `UW2` would have been a second wrong answer wearing the first one's clothes.

⚠ **THE PREFIX TEST ALSO IGNORES L-DARKNESS AND SECONDARY STRESS.** `scheduling` is `ʃˈɛdjuːlɪŋ`: a
PLAIN /l/ where the other three have dark `ɫ`, because the parent lightens a prevocalic lateral, AND no
`ˌ` where the lemma has one, because the parent drops it in that environment. Same shape as the flapping
case below and the same reason — the row carries the parent's allophony, and the parent's allophone depends
on the suffix. Three separate things the raw prefix test cannot see, so it is run over the folded strings.

⚠ **THE PREFIX TEST IGNORES FLAPPING AND ASPIRATION.** `tomato` is `təmˈeᶦtʰoᶷ` and `tomatoes`
`təmˈeᶦt̬oᶷz` — the same /t/ in two allophones — and comparing them raw refuses the row. `toRP` un-flaps
as its first act, so neither is a difference for this table; the citation keeps its own aspiration.

⚠ **`pasta` AND `pastas` LEFT THIS TABLE AT #1414, AND THE REASON IS THIS FILE'S OWN BAR.** The row read
"TRAP in British, PALM in GenAm" — which is a description of ONE WORD WITH TWO ACCENT REALISATIONS, i.e.
exactly what the opening section says does NOT belong here. It was admitted anyway because there was no set
that expressed `ɑː → æ`: BATH is `æ → ɑː` and PALM is `ɒ → ɑː`, both the other way. #1414 built that set
(`en-gb-trap.tsv`, the FOREIGN (a) class — `taco`, `drachma`, `regatta`, `dacha`, `salsa`, `piazza`), and
`pasta` is a generated member of it. **The reading it produces is byte-identical, `pʰˈæstə`.**
⚠ **A ROW ADMITTED BECAUSE THERE WAS NOWHERE ELSE TO PUT IT IS A ROW TO RE-EXAMINE WHEN SOMEWHERE ELSE
APPEARS**, and nothing would have prompted that on its own — the word was right, the table was green, and
the only tell was a justification that contradicted the file's own first paragraph.

## The lexical-SET layer does not run over these rows

⚠ A word this table owns is exempt from the LOT rule and from BATH/CLOTH/yod/LOTR/marry/TRAP. The citation is
written with the SSBE target in mind, so a set edit derived for a DIFFERENT word has no business running
over it. The accent's PHONOLOGICAL rules still do — non-rhoticity, GOAT, NURSE/lettER, un-flapping.

An earlier version instead bought `tomato`'s `ɑː` back with a hand-added row in `en-gb-palm.tsv`, a
GENERATED file, and `build-en-gb-sets.ts` skips table-owned words — so the next regeneration would have
deleted it and silently regressed the word to `təmˈɒtəᶷ`. It was never claimable in the first place: the
builder claims from the rules-only output, where `tomato` has no `ɑː` to preserve, so the palm edit never
matched. Exempting here makes the runtime and the builder agree in both directions.
