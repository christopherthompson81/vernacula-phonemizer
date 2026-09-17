# Acronyms: eight dictionary rows spell a letter with its sound, not its name

Opened while triaging the classes the referee audit surfaced as "entirely handleable": proper names,
possessives, and acronyms.

## Run 1 — 2026-09-17 — possessives are clean, and that class is closed

Checked first because it was the most suspicious: the resolution order has a `possessive 's` tier, so
a failure there would be a wiring bug rather than a data gap. There is none.

    country's  kʰˈʌntɹiz     horse's   hˈɔːɹsᵻz     James's   d͡ʒˈeᶦmzᵻz
    NASA's     nˈæsəz        IRS's     …ˈɛsᵻz       US's      …ˈɛsᵻz

Every allomorph is right, including the epenthetic `ᵻz` after a sibilant — and, for the letter-spelled
acronyms, **the allomorph is computed from the last letter's NAME rather than its letter**: `IRS's`
takes `ᵻz` because the reading ends in `ɛs`. No defect.

⚠ **`NASA's` APPEARED IN AN EARLIER OOV LIST AND SHOULD NOT HAVE.** That list was built by asking
whether the surface form is a dictionary key, which no possessive ever is. The classification was
wrong, not the engine.

## Run 2 — 2026-09-17 — the acronym defects, found by auditing the dict against itself

Spelling an initialism is a RULE here, not a table — `english.jsonc` says so: "CMUdict already carries
all 26 single letters with their letter-NAME pronunciations … the speller is a RULE, not a table",
with one recorded exception (`a`, which CMUdict has as the reduced article).

So every acronym-shaped dictionary row that IS a letter spelling can be checked against the
dictionary's own single-letter rows. 61 disagree; 53 are the documented `a` exception. **The other
eight are defects:**

| row | CMUdict | should be | |
|---|---|---|---|
| `gdp` | `G IY1 D IY1 P IY1` | `JH IY1 …` | ⟨g⟩ as its SOUND, not its name |
| `gps` | `G IY1 P IY0 EH1 S` | `JH IY1 …` | |
| `cgi` | `S IY2 G IY2 AY1` | `… JH IY2 …` | |
| `mg` | `EH2 M G IY1` | `… JH IY1` | |
| `mgm` | `EH2 M G IY2 EH1 M` | `… JH IY2 …` | |
| `jfk` | `JH IY1 EH2 F K EY1` | `JH EY1 …` | ⟨j⟩ as "jee", not "jay" |
| `acc` | `AY2 S IY2 S IY1` | `EY2 …` | ⟨a⟩ as "eye", not "ay" |
| `kpmg` | `… JH IH1` | `… JH IY1` | |

**Five of the eight are ⟨g⟩ spelled `G IY` ("ghee") where CMUdict's own `g` row is `JH IY` ("jee") —
the dictionary contradicting itself.** `GDP` read `ɡˌiːdˌiːpʰˈiː`, `JFK` read "jee-ef-kay".

⚠ **`gps` ALREADY READ CORRECTLY AND IS STILL FIXED.** It is in `acronymLetters`, which spells from
the single-letter rows and so bypasses its own bad entry. The defect was invisible from the output —
only the row-against-row audit finds it. Anything that later drops `gps` from that list would have
re-exposed it silently.

⚠ **AND A TEST HAD IT RECORDED AS CORRECT.** `hmong.test.ts` asserted `GDP` → `ɡˌiːdˌiːpʰˈiː`, the
same shape as #1319's `anălaiz`: a defect written down as an expectation, in a test about something
else entirely (Hmong borrowing English letter names).

### Two words that read as words and should not

    AI    ˈaᶦ        →  ˈeᶦ aᶦ            CMUdict records `ai` [AY1], the three-toed sloth
    UCLA  ˈuːklɑː    →  jˈuː sˈiː ˈɛɫ ˈeᶦ   the phonotactic gate calls ⟨ucla⟩ readable

Both go in `acronymLetters`, which is case-gated — lowercase `ai` and `ucla` are untouched, exactly as
`it`/`us`/`am` already are. `AI` was confirmed against misaki's gold, which letter-spells it. Sweeping
gold's 454 all-caps entries for words it spells and we do not turned up only six: `AI` and five
obscure `?J` pairs.

### The opposite direction is a data gap, not a rule gap — NOT taken

22 all-caps gold entries are read as WORDS there and letter-spelled by us: `JPEG` `ʤˈApˌɛɡ`, `SQL`
`sˈikwəl`, `HVAC`, `CRISPR`, `BRICS`, `ROFL`, `NSAID`, `PFAS`, `VRAM`. These need dictionary
ENTRIES — `NASA`, `NATO` and `ASCII` read correctly for exactly that reason — and `g2p-curated.tsv`
is currently corrections-only (20 rows, every one an upstream row rewritten), so adding words changes
that file's contract. Its own header calls it "every hand correction to g2p-dict.tsv".

⚠ TWO OF THE 22 ARE NOT DEFECTS AT ALL. `SQL` is in the dict as the letter spelling and gold says
"sequel"; `ASAP` likewise. **Both readings are attested** — this is the multiple-readings problem, not
a wrong entry. And `BBQ`'s gold reading `bˈɑɹbəkjˌu` is a GLOSS: the expansion, not the initialism.

## Run 3 — 2026-09-17 — review: the audit's bound, and the row left alone

**The "at most two differing phones" bound is load-bearing.** Re-run without it, the audit returns
nine rows instead of eight, and the extra eight are not letter spellings at all:

    dr  [D R AY1 V] "drive"      lb   [P AW1 N D] "pound"     aug  [AO1 G AH0 S T] "August"
    ct  [K AO1 R T] "court"      mt   [M AW1 N T] "mount"     blvd [B UH1 L AH0 V AA2 R D]
    hz  [HH ER1 T Z] "hertz"     msgr [M AA0 N S IY1 N Y ER0] "monsignor"

These are abbreviation GLOSSES — CMUdict giving the expansion, which is correct for them. The bound is
what separates "a letter spelling with one letter wrong" from "not a letter spelling", and the eight
shipped corrections are therefore the complete set, not a sample.

**`ia` is the one row inside the bound that was left alone.** `[IY1 AH0]` against the letters' `AY EY`
— but "ee-uh" is a plausible NAME reading, and whether ⟨IA⟩ is Iowa, an initialism, or a name is not
something the dictionary row can settle. Guessing would have been the same class of error as the ones
being fixed.

**The curation gate covers the new rows and is not vacuous.** `en-curation-gap.test.ts` passes both
halves — every curated row still applied in the shipped dict, and no row falling back to the upstream
shape on the OOV path beyond the three known gaps. The eight did not join that list.
