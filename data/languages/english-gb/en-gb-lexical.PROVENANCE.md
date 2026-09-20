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

A word the referee does not list, or lists only in a form that looks like US contamination, is
left out rather than guessed at. `schedule` — the famous /ˈʃɛdjuːl/ — is absent for exactly that
reason: the referee has no row for it, so there is nothing to check against. `leisure` is absent
because the only row it has is `liʒɚ`, which is rhotic and therefore not a British reading at all.

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
| pasta | TRAP in British, PALM in GenAm |
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
| `pasta` | attested |
| `tomato` | attested |
| `vitamin` | attested |
| `buoyed` | entailed from `buoyed` |
| `buoys` | entailed from `buoys` |
| `clerks` | attested AND entailed — they agree |
| `figured` | entailed from `figured` |
| `figures` | attested AND entailed — they agree |
| `figuring` | entailed from `figuring` |
| `herbs` | entailed from `herbs` |
| `levering` | entailed from `levering` |
| `levers` | entailed from `levers` |
| `lieutenants` | entailed from `lieutenants` |
| `pastas` | entailed from `pastas` |
| `tomatoes` | entailed from `tomatoes` |
| `vitamins` | entailed from `vitamins` |

⚠ **WHY THE INFLECTIONS ARE NOT OPTIONAL.** Keying the override on the exact surface word made the lemma
right and left the inflection wrong IN THE SAME SENTENCE — `clerk` klˈɑːk beside `clerks` klˈɜːks, and
`herb`/`herbs` with the /h/ appearing and disappearing. Before the table both were wrong and CONSISTENT.
A change that introduces an inconsistency which did not previously exist is not an improvement on the
promise of a follow-up.

⚠ **TWO INFLECTIONS ARE REFUSED RATHER THAN ENTAILED**, because the entailment does not hold:

- `buoying` — the parent is **self-inconsistent**: `buoy` is `bˈuːi` but `buoying` is `bˈɔᶦɪŋ`, so the
  inflected form is not the lemma's form plus a suffix. It also already produces the British reading.
- `tomatos` — a CMUdict spelling variant whose parent adds a secondary stress (`təmˈeᶦtʰˌoᶷz`).

⚠ **`derbies` AND `levered` ARE ABSENT BECAUSE THE PARENT HAS NO ROW FOR THEM**, and their OOV readings
cannot be entailed from: `derbies` decodes as `dˈɝbiʲiz`, with a doubled vowel the entailment would
propagate straight into the table. The guard is dictionary membership, and this is what it is for.

⚠ **THE PREFIX TEST IGNORES FLAPPING AND ASPIRATION.** `tomato` is `təmˈeᶦtʰoᶷ` and `tomatoes`
`təmˈeᶦt̬oᶷz` — the same /t/ in two allophones — and comparing them raw refuses the row. `toRP` un-flaps
as its first act, so neither is a difference for this table; the citation keeps its own aspiration.

## The lexical-SET layer does not run over these rows

⚠ A word this table owns is exempt from the LOT rule and from BATH/CLOTH/yod/LOTR/marry. The citation is
written with the SSBE target in mind, so a set edit derived for a DIFFERENT word has no business running
over it. The accent's PHONOLOGICAL rules still do — non-rhoticity, GOAT, NURSE/lettER, un-flapping.

An earlier version instead bought `tomato`'s `ɑː` back with a hand-added row in `en-gb-palm.tsv`, a
GENERATED file, and `build-en-gb-sets.ts` skips table-owned words — so the next regeneration would have
deleted it and silently regressed the word to `təmˈɒtəᶷ`. It was never claimable in the first place: the
builder claims from the rules-only output, where `tomato` has no `ɑː` to preserve, so the palm edit never
matched. Exempting here makes the runtime and the builder agree in both directions.
