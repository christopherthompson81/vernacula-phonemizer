# Ordinals — capability & demand audit

Issue #562. Scope of this entry: find which languages lack ordinals. No implementation.

## Run 1 — 2026-07-29

### Q1: which languages can form an ordinal from an integer?

Enumerated all 191 registered codes from `registry.ts`, checked each language dir for
`romanOrdinals.ts` (which carries `ROMAN_POLICY.ordinal(n)`) and for any other ordinal
machinery.

- **14 have an `ordinal(n)` former**: es, es-419, pt, pt-BR, it, ro, ca, ru, pl, uk, hu, az, kk, uz.
- **1 more has general ordinal support**: en (`ordinals` table in the manifest + suffix reading
  in `normalize.ts`), plus fr with a bounded `FR_ORDINAL` map reachable only from its Roman rule.
- **~176 have none.**

A grep for `/ordinal/i` across `src/languages/` matches 27 files, but **most are false
positives** and the raw count is misleading. `ordinal` in german/swedish/luxembourgish means
*syllable index* for stress placement. mandarin's is the 第一 yī-sandhi trigger, not ordinal
formation. guarani's `numbers.ts` says ordinals are explicitly out of scope. lingala's jsonc
key `"ordinals"` holds its **cardinal** stems (Meeuwis §3.6: cardinal = connective *ya* + that
stem) — a naming quirk. Do not trust the grep count.

### Q2: range of the 14 existing formers

Probed each `ROMAN_POLICY.ordinal` at n = 1, 3, 11, 21, 40, 58, 100, 137, 1988:

| languages | coverage |
|---|---|
| it, ro, ca | unbounded — correct at 1988 (`millenovecentoottantottesimo`) |
| es, es-419, pt, pt-BR | correct to 137, `undefined` at 1988 |
| ru, pl, uk, hu, az, kk, uz | correct to 100, `undefined` at 137 and above |

### Q3: demand — does ordinal notation actually occur in the corpora?

Measured the FLEURS transcripts with **per-language** ordinal-notation patterns. A generic
"digit + suffix" regex was tried first and discarded as noise-dominated: it counted units
(`km`, `мили`, `ไมล`), Hindi/Marathi case markers, and CJK date words 年/月/日.

Notation found in 25 of the 30 corpora with a defined pattern. Highest: az 279 hits
(`1988-ci`), el 100 (`19ο αιώνα`), da 97 (`24. august`), ta 58 (`2009 ஆம்`), en 55 (`8th`),
nl 52 (`18e eeuw`), zsm/id ~45 (`abad ke-18`), bg 46, am 42 (`19ኛው`), uk 40, kk 34, cy 30
(`37fed`). The bare `N.` style (de/cs/sk/hu/fi/tr/nb/sv/pl/sl/et/lv/lt) is **excluded from
these counts** — a regex cannot distinguish it from a sentence-final digit or a list marker,
so real demand in those languages is higher than measured.

### Q4: what does the engine do with that notation today? (the real finding)

Ran the notation verbatim through `phonemize`. **Only English is correct.** The others fail in
three distinct ways — and note this is *not* the documented "reads a cardinal instead of an
ordinal" limit in `core/roman.ts`; the suffix itself becomes audible garbage.

1. **Suffix spoken as a stray word** — it tokenizes separately and gets phonemized:
   `nl 18e` → `ˈɑxtin ˈeː` ("eighteen ee"); `el 19ο` → `ðeka enea o`; `sv 1:a` → `ɛtː : ɑː`;
   `bg 9-ти` → `dɛvɛt ti`; `uk 17-го` → `sʲimnadʲt͡sʲatʲ ɦɔ`; `ru 5-е` → `pʲætʲ je`;
   `kk 19-шы` → `ontoʁəz ʃə`; `az 1988-ci` → `…sæcːˈiz d͡ʒˈi`; `cy 37fed` → `…sˈaᶦθ vˈeːd`;
   `am 19ኛው` → `…zətʼəɲ ɲaw`; `hi 16वीं` → `sˈoːləɦ ʋˈiː̃`; `ca 1r` → `un r`.
2. **Period notation left as a literal `.` token** — `da 24.` → `ˈfiːɐɐwˈtyːvə . ˈɑwɡɔsd`;
   `tr 2.` → `icˈi . dˈynja`; `de 3.` → `dʁaɪ̯ . ɔktˈoːbɐ`; `pl 19.` → SLOT-GAP with a bare `.`.
   This is the same class as the reported English `St. James` bug: the stray period also drives
   a spurious pause in the segmenter, so it is audible twice.
3. **Correct by accident** — `vi thứ 18`, `cmn 第37`, `ja 第7`, `ko 제2` work because the ordinal
   marker is a separate real word already in the dictionary. `zsm/id ke-18` → `kə` + cardinal is
   genuinely correct Malay/Indonesian read aloud.

### Q5: `º`/`ª` leak (separate defect, found incidentally)

The masculine/feminine ordinal indicators **U+00BA and U+00AA reach the phoneme string raw** in
es-419, it, ca, gl, ro (and pt emits `ũ º`). `phonemize("1º","pt")` → `"ũ º"`. A non-IPA
character in output is a sentinel-class defect and is independent of the ordinal question — the
symbol normalizer should consume it regardless of whether an ordinal reading follows. The degree
sign `°` U+00B0 is *not* affected; it is already dropped.

### Implications for the next step

- The gap is not 14-vs-177 on paper; **behaviourally it is en-vs-everything**. Even the 14
  languages with a working former cannot use it on digit notation — `ordinal(n)` is reachable
  only from the Roman-numeral path in `normalizeRomans`. Wiring digit+suffix notation to the
  same former is the cheap high-value fix and immediately covers es/pt/it/ca/ro/ru/pl/uk/hu/az/kk/uz.
- Fix `º`/`ª` first: it is a one-line-per-language normalizer change, independent, and it is the
  only defect here that puts a non-phoneme in the output.
- The `N.` period style needs a *detector*, not ordinal data — distinguishing ordinal-`.` from
  sentence-final `.` is the hard part and is where de/tr/pl/cs/sk/fi/nb/da demand sits.
- Extending the 7 formers that stop at 100 is small (they already compose regularly); es/pt
  stopping below 1988 matters less, since four-digit ordinals are rare outside year-as-ordinal.

## Run 2 — 2026-07-29 — fix French ordinals

Implemented. Three defects, all confirmed by probe before the change.

### D1: the ordinal former was a hardcoded 2–20 table, reachable only from the Roman rule

`FR_ORDINAL` in `french.ts` covered 2,3,4,7,8,9,12–20 and nothing else, and only
`normalizeFrenchRomans` ever called it. Replaced by `src/languages/french/ordinals.ts`, an unbounded
former built on the cardinal compositor: cardinal + `-ième` with the four standard adjustments
(final ⟨e⟩ dropped, cinq→cinqu-, neuf→neuv-, plural ⟨s⟩ of vingts/cents/millions dropped), only the
final element of a compound inflecting, and 1 suppletive (premier/première standalone, unième in
compound). Verified defect-free for ordinals 1…20 000.

### D2: digit notation was entirely unhandled — this is what the corpus actually contains

**No Roman-numeral ordinal occurs in fr FLEURS at all.** The digit forms do: `1er` ×18, `37e` ×6,
`190e` ×6, `60e` ×4, `5e` ×4, `3e` ×4, `11e` ×2, `15e` ×2 — 48 hits. All of them spoke the bare
suffix as a stray word:

| input | before | after |
|---|---|---|
| `le 1er janvier` | `lə œ̃ nɛʁ ʒɑ̃vjˈe` (un + "er", with a spurious n-liaison) | `lə pʁømje ʒɑ̃vjˈe` |
| `la 1re fois` | `la œ̃ ʁø fwˈa` | `la pʁømjɛʁ fwˈa` |
| `le 2ème jour` | `lə dø zɛm ʒˈuʁ` | `lə døzjɛm ʒˈuʁ` |
| `le 37e plus grand` | `lə tʁɑ̃t sɛt ø ply…` ("thirty-seven uh") | `lə tʁɑ̃tsɛtjɛm ply…` |
| `le 21e siècle` | `lə vɛ̃ e œ̃ nø sjˈɛkl` | `lə vɛ̃teynjɛm sjˈɛkl` |

`second/seconde` is licensed only at n=2, so `le 3d` stays a cardinal — unrestricted it would read 3-D
as an ordinal.

### D3 (found here, not in the brief): the space-joined cardinals were phonemically WRONG

`numbers.ts` emitted the sub-100 group space-separated "so each reads through the g2p", which
phonemized each piece in isolation and lost the compound-internal liaison. Lexique attests all these
compounds; the engine was never reaching them:

| n | before | Lexique / after |
|---|---|---|
| 17 | `dis sˈɛt` (doubled s) | `disˈɛt` |
| 18 | `dis ɥˈit` (**voiceless**) | `dizɥˈit` |
| 19 | `dis nˈœf` (**voiceless**) | `diznˈœf` |
| 21 | `vɛ̃ e ˈœ̃` (no t-liaison) | `vɛ̃teˈœ̃` |
| 90 | `katʁ vɛ̃ dˈis` | `katʁəvɛ̃dˈis` |

Fixed by hyphenating the sub-100 group (also the 1990 reform's orthography) and admitting an internal
hyphen into the tokenizer word class, so Lexique's ~4.2k attested compounds resolve. Compounds Lexique
lacks (quarante-et-un, cinquante-et-un, soixante-et-un) fall to per-part concatenation in
`phonemizeWord`, which reproduces the attested shape (cf. trente-et-un `tʁɑ̃teœ̃`). The same change fixes
ordinary hyphenated words: `peut-être` `pø ˈɛtʁ` → `pøtˈɛtʁ`, `c'est-à-dire` → `sɛtadˈiʁ`.

Two test expectations had PINNED this bug (`phonemize("21")` = `vɛ̃ e ˈœ̃`, `xviie siècle` =
`dis sɛtjɛm`) and were corrected against Lexique.

### Homograph control

The naive pattern "Roman letters + ordinal suffix" matches `de` 8,411×, `les` 3,512×, `le` 3,497×,
`des` 3,234×, `ce` 411×, plus `vie`, `dire`, `lire`, `mer`, `ville`, `livre` in the fr corpus — all
decode as numerals (LE = 50+…, DI = 501, LI = 51). **The veto is Lexique membership**: an attested
French word is not a numeral. That blocks every case above while leaving `XVIIe`, `XIe`, `Ve`, `XXXe`,
`LVIIIe` free, and it stays correct as the lexicon grows. Three tokens absent from Lexique are
stoplisted explicitly (`cie` the abbreviation, `cive`, `clive`).

Accepted cost of the veto: `la Ire République` (Ire = première) does not convert, because *ire*
(= wrath) is a real French word. Rare enough to prefer the safe direction.

**Bug found and fixed mid-implementation, worth recording:** widening the Roman base from a closed set
to `[ivxlcdm]+` made `siècle` convert. `\b` is defined on ASCII word characters, so it finds a boundary
at the accent — `siè` | `cle` — and `cle` parses as CL + the `-e` suffix = 150th. Adding the `u` flag
does *not* fix this. Both patterns now use explicit French-letter lookarounds instead of `\b`.

### Verification

- Full suite 198 files / 2078 tests pass; `tsc --noEmit` clean.
- Referee eval **byte-identical** to baseline (79.3% folded / 96.0% symbol; second set 91.3% / 97.6%),
  so the tokenizer change regressed nothing.
- fr FLEURS sweep, 3,193 utterances: 0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray ordinal marks.
- Cardinals 0…20 000 and ordinals 1…20 000: 0 defects.

### Two PRE-EXISTING bugs found, not fixed (verified identical before the change via git stash)

1. `MM. les députés` → `milimˈɛtʁ …` — "MM." reads as *millimètre*. Source is Lexique itself, which
   carries `mm → milimɛtʁ` as an abbreviation entry; the unit normalizer is not involved (it requires a
   preceding number). Any capitalized abbreviation colliding with a unit entry will do this.
2. `1e9 joules` → `œ̃ nø nœf` — a stray letter between digits is spoken. Not French prose; noted only
   because the ordinal guard correctly declines to claim it.

## Run 3 — 2026-07-29 — French text normalization (dates/times, abbreviations/initialisms, symbols)

Scope grew to the full normalization layer for French, on the view that ordinals are one member of a
family and the family should be built together. New file `src/languages/french/normalize.ts`, shaped
like `english/normalize.ts`: one ordered pipeline of numbered steps.

### Corpus measurement first (fr FLEURS, 3,193 utterances)

Two facts changed the design:
- **The transcripts are lowercased.** Zero all-caps runs; the abbreviations appear as `m.` ×6, `st.` ×3,
  `dr.` ×2, `jr.` ×2, `etc.` ×5, `av.` ×4. So abbreviation rules must not depend on capitalization,
  and the initialism rule cannot be validated against this corpus at all (it protects real input).
- **NBSP is the separator**: `9 h 30`, `n° 11`, `0 %`, `5 000`. Every pattern has to accept it.

Demand: years ×278, month+day ×72, times ×28 (`11 h 20`, `1 h 15`, NBSP forms), percent ×24, dotted
abbreviations ~20 real, `n°` ×2, colon times ×3, numeric dd/mm/yyyy ×0.

Grounded each abbreviation in its context before writing a rule: `m.` is Monsieur (m. reid, m. hu,
m. costello), `st.` is Saint (st. louis), `dr.` is docteur, and **every** `av.` is the era marker
`av. J.-C.`, not avenue — so the era rule must claim them first.

### What was broken

| class | before | after |
|---|---|---|
| time | `11 h 20` → `ɔ̃z vˈɛ̃` ("onze vingt" — h gone) | `ɔ̃z œʁ vˈɛ̃` |
| time | `1 h 15` → `œ̃ n kˈɛ̃z` (masculine + junk) | `yn œʁ kˈɛ̃z` (UNE heure) |
| time | `4:41` → `katʁ , kaʁɑ̃teˈœ̃` (colon became a PAUSE) | `katʁ œʁ kaʁɑ̃teˈyn` |
| grouping | `5 000 ans` → `sɛ̃k zeʁo ˈɑ̃` ("cinq zéro") | `sɛ̃k mil ˈɑ̃` |
| abbrev | `M. Dupont` → `m . dypˈɔ̃` (letter + pause) | `məsjø dypˈɔ̃` |
| abbrev | `MM. les députés` → `milimˈɛtʁ .` (millimètre!) | `mesjø le depytˈe` |
| abbrev | `avant j.-c.` → `avɑ̃ ʒ . s .` (two pauses) | `avɑ̃ ʒezykʁˈist` |
| abbrev | `n° 11` → `n ˈɔ̃z` | `nymeʁo ˈɔ̃z` |
| initialism | `SNCF` → `snkf` (unpronounceable) | `ɛs ɛn se ˈɛf` |
| initialism | `TGV`, `PDG` → **DROPPED ENTIRELY** | `te ʒe vˈe`, `pe de ʒˈe` |
| fraction | `1/2` → `œ̃ dˈø` ("un deux") | `œ̃ dəmˈi` |
| decimal | `3,14` → `tʁwa viʁɡyl œ̃ kˈatʁ` | `tʁwa viʁɡyl katˈɔʁz` |
| negative | `-5 degrés` → minus dropped | `mwɛ̃ sɛ̃k dəɡʁˈe` |
| units | `160 km/h` → `/h` dropped; `20 °C`, `5 l`, `50 kW`, `3 Go`, `1,75 m` all dropped or truncated | all expanded |

Dates and years needed less than expected: French reads a year as a plain cardinal (1988 = mille neuf
cent quatre-vingt-huit), so there is no pair-wise year rule of the English kind, and a day is a cardinal
too. The 1st is the only ordinal day.

### Ordering is load-bearing — the couplings that bit

1. **Roman numerals must precede initialisms.** Both are all-caps letter runs. Running initialisms first
   letter-spelled `Louis XIV` as IXE-I-VÉ. The initialism pass is therefore a SEPARATE exported function
   that runs after the numeral passes and claims only what they declined.
2. **Abbreviations must precede initialisms**, or `MM.` is spelled EM-EM.
3. **Times must precede units**, or a unit rule for `h` eats the hour of `11 h 20` and leaves `20`.
4. **`av. J.-C.` must precede `av.` → avenue** (all corpus instances are the era marker).
5. **Degrouping runs first** so every later step sees one unbroken digit run.

### The readability test (`isUnreadableFrench`)

Replaced a blunt "default to spelling out" with a phonotactic test, so unrecorded acronyms get a
principled decision rather than a guess. Signals, in confidence order: no vowel at all (nothing to
syllabify); an illegal word-initial cluster (`TVA` — French has no /tv/ onset); an illegal word-final
cluster (`RATP` /tp/, `EDF` /df/); a 3+ consonant run with no liquid.

Measured against 38 real French acronyms with known readings:
- **phonotactics alone: 33/38.** It gets the whole no-vowel class right (SNCF, TGV, PDG, HLM, CD) and,
  usefully, RATP / EDF / TVA — all readable-looking yet spelled out in reality.
- **with the convention lists: 38/38.**

The 5 phonotactic misses are all readable-but-conventionally-spelled (`JO`, `USA`, `ONG`, `PIB`, `RER`),
which is the documented limit: readability is not convention, and no phonotactic test can derive a
lexical fact. Hence `FORCE_LETTERS` (spell out despite being readable) and `WORD_ACRONYMS` (say as a
word: onu, otan, unesco, unicef, smic, insee, …). The Lexique-membership veto used elsewhere is *not*
sufficient here — Lexique has `sida` and `ovni` but not onu/otan/unesco, and `usa` is in it as the passé
simple of *user*.

Two of my own errors caught by that measurement: I had put `sncb` in WORD_ACRONYMS (it has no vowel and
is spelled out), and `cs` was missing from the legal-coda set, so `PACS` [paks] was called unreadable.

### Verification

- 198 files / 2085 tests pass (7 new); `tsc --noEmit` clean.
- Referee eval **byte-identical** to baseline: 79.3% folded / 96.0% symbol; second set 91.3% / 97.6%.
- Full corpus re-run: **149 of 3,193 utterances changed (4.7%)**, and a sampled review of the changes
  found them all to be improvements. Defect scan on the new output: 0 digit leaks, 0 sentinels,
  0 slot-gaps, 0 stray symbols, 0 empty lines.

### Known gaps left, deliberately

- `20 °C` → `dəɡʁe sɛlsjˈy`: Lexique has no `celsius`, and the OOV g2p drops the final ⟨s⟩ where French
  says [sɛlsjys]. Not fixed by respelling the unit table (a deliberate misspelling in data reads as a
  bug later) and not by editing `lexicon.tsv`, which is provenanced Lexique 3.83. The clean fix is a
  small separate non-Lexique overrides file with its own provenance line — worth doing when a second
  case appears.
- `utc+1` → the `+` is dropped; `0230 utc` reads as a cardinal. Both pre-existing and out of scope.
- Undotted `st`/`ste` are NOT expanded (only the dotted forms), because bare `st` before a lowercase word
  is too ambiguous to claim without the English-style function-word test. No corpus instances.

### Implication for the fleet

This is the pattern the other 190 languages will need, and it decomposes into a language-independent
skeleton plus per-language data: an ordered pipeline (degroup → era/abbrev → numerals → initialisms →
symbols), a letter-name table, an abbreviation table, a `FORCE_LETTERS`/`WORD_ACRONYMS` pair, and a
phonotactic readability predicate. `core/normalizeSymbols.ts` already generalizes the symbol tier;
times/dates/abbreviations/initialisms are the tiers still per-language. Worth lifting the skeleton into
`core/` once a second language is done, so the shape is proven twice before it is fixed in place.

## Run 4 — 2026-07-29 — the French supplement lexicon (closing the °C gap)

Created `src/languages/french/supplement.tsv`, consulted after Lexique in `phonemizeWord`.

**Why a separate file matters more than it first appeared:** `french/lexicon.tsv` is Lexique 3.83 under
**CC BY-SA 4.0** — stratum 3 in PROVENANCE.md, fenced under its parent license. Merging our own entries
into it would pull cleanroom facts inside the share-alike fence and break re-importability. Kept apart,
the three entries are MIT-safe own work (stratum 1) and Lexique stays authoritative and replaceable. The
supplement is additive only — every key is absent from Lexique, so the two cannot disagree.

**Audited rather than guessed.** All 118 words the normalizer can emit were checked against Lexique:
22 are absent and fall to the rule g2p. Comparing each of those 22 to its expected IPA found only
**three** actually wrong, which is why the file is three lines:

| word | g2p gave | correct | why it is now reachable |
|---|---|---|---|
| celsius | `sɛlsjy` | `sɛlsjys` | `20 °C` → "degrés celsius"; final ⟨s⟩ is sounded in this Latin loan |
| kilowatt | `kilɔva` | `kilowat` | `50 kW`; ⟨w⟩ voiced to [v] and the final ⟨tt⟩ dropped |
| confer | `kɔ̃fe` | `kɔ̃fɛʁ` | `cf.` → confer; final ⟨r⟩ sounded in the Latin loan |

Oddity worth recording: `kilowatts` (plural) already came out `kilowat` correctly while the SINGULAR
`kilowatt` gave `kilɔva`. The two forms take different g2p paths; only the singular needed an entry.

**Deliberate non-entry:** `Jésus-Christ`. The g2p gives [ʒezykʁist] where the traditional dictionary form
is [ʒezykʁi]. Both are current in speech, so the existing reading is a variant rather than a defect and
was left alone rather than asserting a change I could not source.

Verified: 18 French tests pass (1 new), referee eval byte-identical (79.3% / 96.0%).

## Run 5 — 2026-07-29 — English parity, and lifting the shared machinery into core/

Audited English against every class built for French, then closed the gaps. English started ahead —
times, dates, pair-wise years, ordinals, percent, currency, comma-grouping, romans and most units all
worked — but the initialism story was worse, not better.

### The corpus has TWO transcript columns, which changed the measurement

Column 3 is the ORIGINAL cased transcript; column 4 is the lowercased one my earlier sweeps used. So the
caps signal IS available in real text, and the cased column is the honest place to measure this class:

| | all-caps tokens | distinct | top |
|---|---|---|---|
| en_us | 228 | 84 | US×18, BCE×8, **II×8**, GPS×6, MRI×6, DNA×6, TV×6, UN×6, UTC×5, PBS×5 |
| fr_fr | 191 | 69 | AOL×8, UTC×7, IRM×6, ACTA×6, ADN×6, PBS×5, FBI×5, DVD×5, ONU×4, PIB×4 |

`II`×8 confirms the ordering constraint is real, not hypothetical: Roman numerals are all-caps letter
runs, so the numeral rules must claim them before any initialism rule sees them.

Also measured (en, cased): `Jr.`×9 — the single most frequent dotted abbreviation, and English had **no
rule for it at all** — `Dr.`×7, `etc.`×5, `St.`×4, `No.`×2, `km/h`×15, space-grouped thousands ×4.

### THE DECISION ORDER WAS WRONG IN MY FRENCH IMPLEMENTATION, and the measurement caught it

My first French design used phonotactic readability as the DEFAULT: readable ⇒ say it as a word. Measured
against the French cased column that is the wrong default — 17 distinct tokens are spelled out (AOL, UTC,
IRM, ADN, PBS, FBI, DVD, RSPCA, NBA, GPS, PIB, OHA, CIO …) against 5 said as words (ONU, ACTA, COVID,
UNESCO, OPEP). Readability-as-default gets ACTA and COVID right but AOL, CIO, OHA and NYC wrong, and those
are the more numerous class. **Corrected to: spelling out is the default, the word reading is marked.**
French now reads CIO/AOL/OHA/ACMA/TDA correctly, which it did not before this run.

So readability was demoted to the job it is actually good at: a **fail-safe guard on the hand-written
word-acronym list**, so a mistaken entry there degrades to spelling out instead of to unpronounceable
output. It is deliberately NOT applied to dictionary hits — that broke `CD`, which has no vowel and so
reads as "unreadable", yet CMUdict carries it as one token [siːdˈiː] with one stress, better prosody than
[sˈiː dˈiː]. Trust a dictionary that holds a real pronunciation.

### Lifted to `src/core/initialisms.ts`

Now that the shape is proven twice, `makeInitialismNormalizer` + `makeUnreadableTest` are shared, with
per-language data only: letter names, `forceLetters`, `wordAcronyms`, a word test, phonotactic clusters.
French was refactored onto it. Decision order: forceLetters → dictionary → guarded word-acronyms → spell out.

English needs almost no letter-name data: **CMUdict carries all 26 single letters with their letter-NAME
pronunciations** (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so emitting bare letters space-separated
resolves correctly. Only `a` needs an override, being the reduced article AH0.

`FORCE_LETTERS` for English is deliberately short, with a precise membership test: an entry belongs only
if the dictionary reads the token as the WORD. CMUdict already has correct letter readings for eu, uk, tv,
cd, dvd, dc, ac, pc, pm, dj, so forcing those would make output worse. Final list: us, un, it, id, am,
led, who.

### What was broken in English

| class | before | after |
|---|---|---|
| initialism | `NHS` → `[ns]` (H gone) | `ˈɛn ˈeᶦt͡ʃ ˈɛs` |
| initialism | `MP` → `[mp]`, `NYC` → `[niːk]`, `WTO` → `[uːt]`, `DSLR` → `[ʌdslɚ]`, `PNG` → `[pŋɡ]`, `WNED` → `[aᶷnd]` | all spelled out |
| initialism | `US` → `[ʌs]` (the pronoun) | `jˈuː ˈɛs` |
| abbrev | `Jr.` no rule; `No. 11` → the word "no" + a pause | junior; `nˈʌmbɚ ɪlˈɛvən` |
| abbrev | `Dr. Who` → **"drive who"** ("who" is in the function-word list) | `dˈɑːktɚ hˈuː` |
| abbrev | `e.g.`/`i.e.`/`U.S.`/`B.C.` → interior dots became PAUSE marks | letters, no pauses |
| era | `BCE` → `[bsiː]`; `AD` → the word "ad" | `bˈiː sˈiː ˈiː`; `ˈeᶦ dˈiː` |
| fraction | `1/2` → "one two" | `wˈʌn hˈæf`; `2/5` → "two fifths" |
| negative | `-5 degrees` → "five degrees" (**meaning inverted**) | `mˈaᶦnəs fˈaᶦv …` |
| units | `20 °C` → "twenty see"; `km/h` → "kilometers aitch"; `30 m` → "thirty em" | all expanded |
| grouping | `5 000 years` → "five zero years" | `fˈaᶦv θˈaᶷzənd jˈɪɹz` |

Fixed `Dr.`/`St.` with a capitalization signal that overrides the neighbour test where the input has
case; the lowercased corpus keeps relying on the neighbour heuristic as before.

Also found the English UNIT alternation was **hardcoded and had drifted from the UNITS table** — several
table entries were unreachable. It is now generated from the keys, longest first, so `km/h` cannot be
shadowed by `km` and adding a unit is a one-line data change.

### Verification

- 198 files / 2094 tests pass (8 new); `tsc --noEmit` clean.
- Referee eval **byte-identical for both languages**, confirmed against a stashed baseline:
  en 36.1% folded / 78.1% symbol; fr 79.3% / 96.0%.
- en_us corpus re-run, both columns: 174/2602 changed on the cased column, 59/2602 on the lowercased one;
  zero digit leaks, sentinels, slot-gaps, stray symbols or empty lines in either. Sampled review of the
  changes found them all improvements.

### Known gaps left

- Alphanumeric codes (`CG4684`, a flight number) are not claimed: there is no word boundary between the
  letters and the digits, so the all-caps pattern does not match. Still reads as `[kɡ]`.
- ISO (`2011-03-14`) and US numeric (`3/14/2011`) dates are unhandled in English; 0 corpus instances, and
  the fraction rule correctly declines to claim them.
- Money decimals (`£2.50` → "two point five zero pounds" rather than "two pounds fifty") in both languages.
- A lone all-caps token is exempted from the all-caps-document gate so `NYC` typed alone still spells out;
  a multi-word all-caps HEADLINE is still left alone, which is the intended behaviour.

## Run 6 — 2026-07-29 — closing the gaps, and an architecture correction

Fixed the four gaps from Run 5 that were real problems (the fifth, an all-caps headline being left alone,
is intended behaviour and was left):

| gap | before | after |
|---|---|---|
| alphanumeric codes | en `CG4684` → `[kɡ]`; **fr dropped the G entirely** → `[k]`; en `A380` → `[ə]`, the reduced article | letters + number |
| money | `$5.50` → "five point five zero dollars"; `2,50 €` → "deux virgule cinquante euro" | "five dollars fifty"; "deux euros cinquante" |
| plus sign | `+5` → "five" / "cinq" — **the sign silently DROPPED**, mirror of the minus bug | "plus five" / "plus cinq" |
| numeric dates (en) | `2011-03-14` → "two thousand eleven three fourteen" | "march fourteenth twenty eleven" |

French `plus` needed a respelling: it is a heteronym ([ply] "more" vs [plys] the operator) and Lexique
carries only the first. The supplement cannot help, being additive-only for words Lexique LACKS, and
overriding `plus` outright would break the far commoner reading — so the rule emits the attested informal
spelling `plusse`, with a supplement entry pinning it to [plys]. The clean fix is a French heteronym tier.

### A stale claim of mine, corrected

I reported the English referee as "byte-identical" for Run 5. It was not. I ran that comparison mid-stream
and then kept editing (the relaxed all-caps gate and the FORCE_LETTERS trim came after), so the claim was
stale rather than wrong-when-made. The real movement in `d7d4dc2` was 1644 → 1647 folded and 78.1% → 78.0%
symbol. Chasing it down is what produced the rest of this entry, so it was worth catching.

### The referee and the corpus disagreed, because they sample different populations

Scoring the 40 all-caps entries of the English wikipron referee by phone-content closeness, spelling-out
as the default was net WORSE there: **8 better, 14 worse**. Every WORSE case was a 4+ letter, pronounceable,
lexicalized acronym (BAMF, SNES, CUPE, TESDA, CAGR, USAR, VUSA, CODBLOPS, POSIC); every BETTER case was
2–3 letters or had an illegal cluster (BJ, EEE, IPA, SSR, ZRA, LNAV).

That is a real regularity, and a length-based "lexicalization threshold" (4+ and pronounceable ⇒ word)
exploited it: 7 better / 4 worse, and the referee rose to 1650/4558.

### …but the threshold was the wrong kind of answer

It was logic guessing at lexical facts, and it guessed wrong in the same breath — it read `USAF` as a word
(the referee records the near-identical `USAR` as a word and `USAF` as letters, which shows spelling cannot
decide it). Restructured on the principle that **a known acronym's pronunciation is lexical and the
unpronounceable case is OOV**:

    lexical   → listed exception (`acronymLetters`, in the language's own manifest)
              → recorded in the pronunciation dictionary (leave the token; the lexicon owns it)
    OOV       → unpronounceable ⇒ spell out; pronounceable ⇒ leave it, the OOV g2p reads it as a word

`core/initialisms.ts` lost the word-acronym list and the threshold; `acronymLetters` moved out of code and
into `english.jsonc` / `french.jsonc`, beside each language's other hand-authored facts. The dictionary tier
is load-bearing and was briefly missing: without it `CD` (no vowel) fell to the OOV rule and got spelled
out, when CMUdict already has it as one token [siːdˈiː] — a recorded pronunciation is not the OOV tier's
business.

Honest cost of the simplification: a pronounceable, unrecorded acronym that IS spelled out in speech now
needs a data entry — found `ROV`, `NYC`, `LATAM`, `MINAE` that way and recorded them. The referee sits at
1648 versus the threshold's 1650: two words, for a rule that could not be justified. Both beat the 1644
the engine started at, and symbol accuracy is back to 78.1%.

### Verification

- 198 files / 2100 tests pass (14 new across the two languages); `tsc --noEmit` clean.
- Referee: en 1648/4558 (36.2%) folded, 78.1% symbol — both above the pre-work baseline. fr byte-identical
  at 79.3% / 96.0% (second set 91.3% / 97.6%).
- Corpus sweeps: 0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray symbols in either language, both columns.

## Run 7 — 2026-07-29 — a French heteronym map

Started the tier the `plus` respelling was standing in for. Data in `french.jsonc` (`heteronyms`),
resolution in `french.ts`.

### Why it has to be context-word based

French has **no POS tagger** — `frenchTagger.ts` is the OOV g2p reader, not a POS model — so the
English mechanism (POS-keyed heteronyms) is unavailable. And Lexique carries **exactly one reading per
spelling**: verified there are no duplicate keys in `lexicon.tsv`, so the alternate reading is genuinely
absent rather than being collapsed by the loader. That leaves neighbouring words as the only signal.

Checking which reading Lexique picked, per candidate, showed the alternate that is missing — and that
Lexique is not consistent about which member it keeps:

| word | Lexique has | missing alternate |
|---|---|---|
| plus | `ply` (more / negation) | `plys` (operator) |
| tous | `tus` (pronoun) | `tu` (determiner, "tous les jours") |
| os | `ɔs` (singular) | `o` (plural, "des os") |
| as | `a` ("tu as") | `ɑs` (the noun) |
| sens | `sɑ̃` ("je sens") | `sɑ̃s` (the noun) |
| vis | `vi` ("je vis") | `vis` (screw) |
| portions | `pɔʁsjɔ̃` (noun) | `pɔʁtjɔ̃` ("nous portions") |
| content, président, résident, parent, violent, excellent, négligent, couvent | the `-ɑ̃` noun/adj | the verb, `-ɑ̃` dropped |
| **ferment, affluent** | **the VERB** (`fɛʁm`, `afly`) | the noun (`fɛʁmɑ̃`, `aflyɑ̃`) |

### Two classes carry almost all of it

1. **Silent 3pl `-ent`.** Every `-ent` noun/adjective is a homograph of a verb, and the verb reading is
   systematically Lexique's minus the final `ɑ̃`. Gated on `ils`/`elles` ONLY — deliberately precision over
   recall, because reading "le président" as a verb is far worse than missing "les enfants content". A
   clitic may intervene ("ils **ne** content pas", "ils **se** couvent"), so the pronoun test looks one word
   further back past a known clitic; without that it missed every negated or reflexive clause.
2. **Latent final consonant**, selected by a determiner or subject pronoun: plus, tous, os, as, sens, vis.

Not attempted, with reasons recorded: `fils` ([fis] son / [fil] threads) is genuinely ambiguous after
"les", and `est` (copula / east) is unreachable because the tokenizer keeps `l'est` as one token.

### A bug this surfaced — heteronyms and liaison interact

`utc+1` came out `ytk ply zˈœ̃` instead of `ytk plys ˈœ̃`. `plus` is a liaison trigger, so the machinery
moved a `z` onto the next word AND `stripLatent` removed the final consonant to avoid doubling it — which
is right for a genuinely latent consonant (six → `sis` + z-liaison → `si`+`z`) but wrong here: the
operator's `s` is SOUNDED, and arithmetic "plus un" has no liaison at all. A context-selected heteronym
reading now does not participate in liaison as the left member. `de plus en plus` still gets its liaison
(`də ply zɑ̃ plˈy`) because no case fires there.

The `plusse` respelling and its supplement entry are retired; `normalize.ts` emits the ordinary spelling
and the heteronym map supplies `[plys]`, selected by the number that follows.

### Verification

- 198 files / 2102 tests pass (2 new); `tsc --noEmit` clean.
- Referee eval byte-identical: 79.3% folded / 96.0% symbol (second set 91.3% / 97.6%).
- fr corpus: **59 of 3,193 utterances changed, 0 defects**. Tally of what fired: `tous` 49, `sens` 8,
  `os` 2 — and every one inspected is correct (`tous les jours` → `tu`, `les os` → `le zo` with the plural
  s silent, `un sens distinct` → `sɑ̃s`). `tous les` is common enough that this alone is a real gain.

### Where to take it next

The `-ent` class is open — any `-ent` noun/adjective can be extended the same way, mechanically, since the
verb reading is the entry minus `ɑ̃`. Worth generating candidates from Lexique rather than hand-listing.
`ferment`/`affluent` show the generation must read Lexique's actual entry rather than assume the noun
reading is the one recorded.

## Run 8 — 2026-07-29 — generating the -ent heteronym class from Lexique

Replaced the hand-listed `-ent` entries with a generated set. Script:
`tools/fr-heteronym-candidates.ts` (`npx tsx tools/fr-heteronym-candidates.ts`).

### Two tests are needed, and the second is the interesting one

1. **Phonological.** French 3sg and 3pl are homophonous (both endings silent), so Lexique's 3sg entry
   `stem + "e"` should read exactly like the 3pl. This rules out stem-changing verbs: `différent`
   [difeʁɑ̃] looks like a candidate, but the 3pl of *différer* is spelled *diffèrent* and the 3sg is
   *diffère*, so `différe` is absent and the pair is correctly rejected.

2. **Morphological.** Test 1 alone is *not* enough, and this was the finding. French orthography is regular
   enough that an UNRELATED `stem + e` word is homophonous with the stripped -ent form **by coincidence** —
   measured, **13 of the first 26 candidates**: `ciment`/`cime`, `serpent`/`serpe`, `prudent`/`prude`,
   `comment`/`comme`, `régiment`/`régime`, `sergent`/`serge`, `décadent`/`décade`, `indolent`/`indole`,
   `féculent`/`fécule`, plus permanent, proéminent, grandiloquent, urgent. Every one passes the IPA check.
   So the stem must carry a real verb paradigm — the infinitive `stem + "er"` AND one other inflected form.
   There is no *cimer, so ciment goes. That filter removed all 13 and kept all the true pairs.

### The verb reading comes from the 3SG, not from stripping the noun

Where the two disagree, Lexique is internally inconsistent and the 3sg is authoritative, being an actual
verb form. This **caught an error in my own hand-written data**: `excellent` had `[eksɛl]`, copied from the
noun's first vowel, where Lexique's own `excelle` is `[ɛksɛl]`. Flagged rather than silently dropped.

`pressent` came out of the generator as a genuine double I had not considered: "ils pressent" (they press)
`[pʁɛs]` versus "il pressent" (he senses, from *pressentir*) `[pʁesɑ̃]`. The ils/il NUMBER contrast is
exactly what the rule already keys on, so it resolves correctly with no extra machinery.

Result: 15 generated entries (8 previously hand-listed, 7 new — ardent, confluent, influent, pressent,
somnolent, talent, évident), 14 rejected as coincidences.

Still hand-listed, and the script documents why it cannot find them: `ferment` [fɛʁm] and `affluent`
[afly], where Lexique records the VERB reading, so the MISSING reading is the noun's. Their entry does not
end in the nasal, and nothing mechanical establishes that they are also nouns. Their existence is the
reason the script reads Lexique's actual entry instead of assuming the noun reading is the recorded one.

### Verification

- 198 files / 2102 tests pass (6 new assertions); `tsc --noEmit` clean.
- Referee eval byte-identical (79.3% / 96.0%; second set 91.3% / 97.6%).
- fr corpus: 0 utterances changed, 0 defects — none of the 7 new entries occurs after ils/elles in this
  corpus, which is expected and is why the generated set is worth having rather than corpus-driven listing.

## Run 9 — 2026-07-29 — Spanish normalization (the third language)

`src/languages/spanish/normalize.ts`, reusing all three shared tiers: `core/normalizeSymbols.ts` for
%/currency/units, `core/initialisms.ts` for acronyms, `core/roman.ts` at the registry seam. What is left in
the language is genuinely Spanish-specific: its abbreviations, ordinal indicators, dates and times.

### What the corpus said (es_419, 2,796 utterances, cased column)

`EE.` ×31 / `UU.` ×31 dominate everything — and `EE. UU.` expands to WORDS (Estados Unidos), not letters.
Then units ×76 (km, mm, km/h, °F, kg), date "d de mes" ×63, time h:mm ×34, "las N" ×32, percent ×25,
decimal comma ×20, space-thousands ×15, era `a. C.` ×11 (9 of them written WITH a space), dot-thousands ×10,
`+` ×5. All-caps ×279 including `XV`×9 / `XVIII`×8 / `XVI`×7 — Roman numerals.

Three things Spanish already got right, unlike the other two: dot-thousands (`17.000` → diecisiete mil) and
decimal-comma were already in the number tokenizer, % and currency already worked through the shared symbol
tier, and a 4-digit year is a plain cardinal so there is no pair-wise year rule to write.

### Ordering was EASIER here, for a structural reason worth recording

Roman numerals needed no ordering care at all: `es` is not in the registry's `ROMAN_NATIVE` set, so the
shared pass converts them at the registry seam BEFORE the engine's `text()` runs. By the time the initialism
rule sees the text, `siglo XVIII` is already digits. English and French both had to sequence this by hand
because they resolve Romans themselves.

### What was broken

| class | before | after |
|---|---|---|
| abbrev | `EE. UU.` → `ˈee . wˈu .` (two pauses) | `estˈaðos unˈiðos` |
| abbrev | `Dr.` → `[dɾ]` + pause; `Sr.` → `[sr]` + pause; `etc.` → `[ˈetk]` | doctor, señor, etcétera |
| abbrev | `356 a. C.` → `a . k .` | `ˈantes de kɾˈisto` |
| abbrev | `p. m.` → two more pauses | `pˈe ˈeme` |
| abbrev | `n.º 11` → a bare **º in the output** | `nˈumeɾo ˈonse` |
| time | `a las 11:00` → `a las ˈonse , sˈeɾo` — the colon became a PAUSE plus a spurious "cero" | `a las ˈonse` |
| time | `a la 1:15` → `a la ˈuno` | `a la ˈuna` (hora is feminine) |
| ordinal | `1º`/`1ª` → raw **º/ª in the phoneme string** | primero / primera |
| initialism | `CD` → `[kð]`, `ADN` → `[aðn]`, `DVD` → `[dβð]`, `HJR` → `[xɾ]`, `PSTN` → `[pstn]` — all unpronounceable | spelled out |
| units | `120 km/h` → `/h` dropped; `20 °C` → `[k]`; `90 °F` → `[f]`; `83 m` → the letter name | all expanded |
| grouping | `55 000` → "cincuenta y cinco cero" | "cincuenta y cinco mil" |
| fractions | `1/5` → "uno cinco" | "un quinto" (apocopated numerator) |
| signs | `+3` / `-5` → both signs DROPPED | más / menos |

### Two Spanish-specific traps

1. **`°` is not an ordinal indicator.** My first version put U+00B0 in the same class as º/ª, which read
   `20 °C` as *vigésimo k* and `35°` as *trigésimo quinto*. Only º (U+00BA) and ª (U+00AA) are ordinal
   indicators; the degree sign is a different character and belongs to the unit tier.
2. **`n.º` is the form that actually occurs** — n + period + the ordinal indicator. A single-character class
   missed it and left a bare º in the output, which the corpus sweep caught (2 utterances).

### The one variety-specific rule

es-419 is a pure post-process on `es` output (seseo + yeísmo), so the normalization layer is shared. The one
place the varieties genuinely differ is the first of the month: *el primero de enero* in America, *el uno de
enero* in Spain (RAE, *Diccionario panhispánico de dudas* s.v. «fecha»). Threaded as an `americas` flag
through `createSpanish(americas)`, which `createSpanish419` sets.

### Verification

- 198 files / 2108 tests pass (6 new); `tsc --noEmit` clean.
- Referee byte-identical for both varieties: es 4307/4657 (92.5%) folded, 99.1% symbol; es-419 92.6% / 99.1%.
- es_419 corpus, both columns: **223 of 2,796 changed on the cased column** (8%), 94 on the lowercased;
  0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray symbols. Sampled review found them all improvements.

### Pattern status after three languages

The split has held up: shared machinery in `core/` (symbols, initialisms + phonotactics, romans), and per
language a numbered pipeline plus data (abbreviation table, letter names, `acronymLetters`, phonotactic
clusters). Each language contributed one thing the others did not need — English pair-wise years, French a
heteronym tier, Spanish a variety flag — which is the argument for keeping the pipeline per-language rather
than trying to generalize the step list itself.

## Run 10 — 2026-07-29 — Hindi normalization (first non-Latin script)

`src/languages/hindi/normalize.ts`. The interesting result is how LITTLE was needed: most tiers were
already right, so this entry is mostly about what was deliberately left alone.

### Already correct, and untouched

The Indic compositor already reads लाख/करोड़ (100000 → एक लाख, 10⁷ → एक करोड़). The number tokenizer
already accepts BOTH conventions — Western `9,000` and Indian `1,00,000` — and both were correct. Decimals
read as दशमलव, % and currency work through the shared symbol tier, the danda । is already a clause mark, and
embedded Latin runs are already delegated to English by the shared foreign-run pass, which is the right
reading for the acronyms that occur (AOL, PBS, DNA are said with English letter names in Hindi).

Also worth recording: **zero Devanagari digits in the corpus** — numbers are written with ASCII digits
throughout — so no digit transliteration was needed. And the corpus uses मिलियन ×28 MORE than लाख ×19, so
the compositor's existing choice was not something to "fix".

### What was broken

| class | before | after |
|---|---|---|
| ordinal | `16वीं` → `sˈoːləɦ ʋˈiː̃` — the suffix spoken as its own word | `soːlˈəɦʋiː̃`, one word |
| abbrev | `डॉ.` → `ɖˈɔː .` (a pause); `डॉ` → `[ɖɔː]` read as a word | `ɖˈɔːkʈəɾ` |
| abbrev | `ई.पू.` → `ˈiː . pˈuː .` (two pauses) | `ˈiːsaː pˈuːɾʋ` |
| unit | `किमी` → `[kˈɪmiː]` read as a word; `मिमी` likewise; `किमी/घंटा` lost the slash | expanded |
| unit | `20 °C` → `[sˈiː]`, the letter name | `ɖˈɪɡɾiː sˈeːlsɪjəs` |
| clock | `10:30` → colon became a PAUSE; `11:00` → `,  शून्य` ("eleven, zero o'clock") | बजकर…मिनट / बजे |
| fraction | `1/5` → "one five" | `ˈeːk bˈəʈaː pˈaː̃t͡ʃ` |

The ordinal fix is the structurally interesting one: the suffix is written ATTACHED to the numeral and
carries the agreement itself (वाँ masc / वीं fem / वें oblique), so the rule reads the gender off the text
rather than guessing, and JOINS the suffix to the final cardinal word (सोलह + वीं → सोलहवीं). 1–4 and 6 are
suppletive (पहला, दूसरा, तीसरा, चौथा, छठा); 5 and everything from 7 up are regular.

### `\b` DOES NOT WORK OUTSIDE ASCII — the same trap as French, in a harsher form

Every rule I wrote with `\b` before a Devanagari letter silently did NOTHING: `\b` is defined on ASCII word
characters, so there is no boundary before `डॉ` or `ई` at all. In French the same definition caused a FALSE
match (a boundary found inside `siècle` at the accent); here it causes silent non-matching, which is harder
to notice — the rules simply had no effect and the output looked unchanged. Every boundary in this file is
an explicit `(?<![\p{L}\p{M}])` lookaround. **This is the standing hazard for every non-Latin language that
gets this treatment.**

### A rule deliberately NOT applied, on corpus evidence

The minus-sign rule that the other three languages have is omitted. The only hyphen-before-digit in the
entire Hindi corpus is `चंद्रयान -1`, a spacecraft NAME, and Devanagari also uses a spaced hyphen in
compounds (आस-पास) — so the rule has a false positive and, measurably, no true ones. The plus direction is
kept, because `+ 30° c` is a real plus. Also fixed there: the degree rule had to be case-INSENSITIVE, since
the lowercased corpus writes `30° c` and a case-sensitive rule left the scale letter as a stray [sˈiː].

### Verification

- 198 files / 2113 tests pass (5 new); `tsc --noEmit` clean.
- Referee eval byte-identical: 3936/5063 (77.7%) folded, 95.4% symbol.
- hi_in corpus, both columns: 82–83 of 2,120 changed, 0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray
  symbols. Sampled review found them all improvements.

### Pattern status after four languages

Shared: symbols, initialisms + phonotactics, romans, and now the observation that the ordering hazards
depend on whether the language resolves Romans itself (en, fr) or gets them at the registry seam (es, hi).
Per language: a numbered pipeline plus data. Each language has contributed exactly one thing no other
needed — English pair-wise years, French a heteronym tier, Spanish a variety flag, Hindi suffix-joining
ordinals and the non-ASCII boundary discipline.

## Run 11 — 2026-07-29 — Mandarin normalization (the defects were in the engine)

Fifth language. Mandarin already had more of this tier than anything else audited, so the new file
`src/languages/mandarin/normalize.ts` is **eight lines of rule** — and that is the finding, not an omission.
The real defects were in the engine's own number handling.

### Already correct, and untouched

Years read DIGIT-BY-DIGIT (2009年 → 二零零九年), which is right and is not the cardinal reading. Full dates
compose (2011年3月14日 → year digit-wise, month and day cardinal). A century takes the cardinal (20世纪).
点/分 clock readings, 第N ordinals, 万/亿 myriad grouping (10⁴ → 一万, 10⁸ → 一亿), the 百分之 PREFIX from the
shared symbol tier, full-width punctuation as clause marks, and Latin-run delegation to English — which is
the right reading for UTC / NBA / GPS as Chinese speakers say them.

### The three engine defects, all found by probing the corpus form rather than the canonical form

1. **The "following character" test did not skip whitespace — and the corpus always has the space.**
   `2009 年` and `2 个人` are how the corpus writes them (272 years; every 两 case), so the literal next
   character was a space and BOTH rules silently failed. Years came out as the cardinal 两千零九年 instead
   of 二零零九年, and `2 个人` as 二个人 instead of 两个人. This is the same class of failure as Hindi's `\b`
   problem: a rule that looks correct, matches nothing, and leaves output that is wrong but plausible.
2. **The number pattern did not accept comma grouping** (×61): `783,562` was read as two numbers with a
   PAUSE between them — 七百八十三, 五百六十二 — rather than 七十八万三千五百六十二.
3. **Currency signs were dropped outright** (`$50` → 五十, losing 美元) and `°C` fell through to the English
   reading of the bare letter C. Both are now data in the shared symbol tier, along with km/公里, m/米,
   kg/千克 and km/h.

### The one genuinely Mandarin rewrite

Chinese states a fraction in the OPPOSITE order from the western notation: 1/5 is 五分之一, "of five parts,
one". The rule reorders it and leaves it in DIGITS, so the engine's own numeral substitution reads it.
Boundaries are explicit lookarounds again — `\b` finds no boundary against Han script either.

### Verification

- 198 files / 2118 tests pass (5 new); `tsc --noEmit` clean.
- Referee eval byte-identical: 359/424 (84.7%) folded, 94.9% symbol.
- cmn corpus, both columns: 224–240 of 3,246 changed, 0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray
  symbols. Sampled review found them all improvements — 2016年, 2004年, 1639年, 1965年, 1993年, 1957年 all
  moving from the cardinal to the correct digit-by-digit reading.

### Pattern status after five languages

The recurring lesson is now clear enough to state as a rule: **probe the corpus's actual surface form, not
the canonical one.** Three of the five languages had a rule that was correct in principle and matched
nothing in practice — French `\b` inside an accented word, Hindi `\b` before Devanagari, Mandarin a
lookahead that met a space the canonical form does not contain. In every case the output stayed plausible,
so only a corpus diff exposed it.

## Run 12 — 2026-07-30 — Bengali (the normalization layer was the smallest problem)

Sixth language. The audit found three defects, and **two of them were not in the normalization layer at
all** — they were in the language's data, and both were large.

### 1. `clausePunctuation` mapped every mark to ITSELF, padded

`"।": " । "` where Hindi has `"।": "."`. So the raw danda — a non-IPA character — reached the phoneme
output, wrapped in spaces that also produced a double-space slot-gap. The block's own comment said
"canonical inline pause marks", so the data contradicted its stated intent. Measured: **2,949 of 3,006
corpus utterances had a stray mark and 2,995 had a slot-gap. Both are now zero.**

### 2. Bengali numbers 21–99 were all wrong

Bengali, unlike a decimal-compositional language, has a fused word for every number to 100. The shared
composer has a `compound` map for exactly this, with a documented "not authored → degrade to unit+tens"
fallback — Hindi has it authored, Bengali did not. So 21 read as "এক বিশ", *one twenty*. 161 corpus numbers
land in the range, and it also corrupted every year (1956 → "নয় একশো ছয় পঞ্চাশ").

Authoring 72 numerals needed a corroboration source, and finding one took two attempts:
- `bengali-lexicon.tsv` looked like the obvious check and is **not usable** — the control showed it is a
  349-entry EXCEPTIONS list containing only 1 of the 23 numerals the manifest already shipped, so its
  silence proves nothing. Recorded because the negative result is the useful part.
- `tools/referee-eval/referees/bn.wikipron-ben-broad.tsv` attests **10 of the 72**, spread across the
  20s/30s/40s/50s/70s/80s, matching my forms exactly with zero contradictions. Better still, running each
  attested spelling through the engine reproduces the referee's own phone sequence (পঞ্চান্ন → `pɔnt͡ʃanːo`
  vs `p ɔ n t ɕ a nː o`), which checks the spelling and the g2p together. The rows are marked in the data.

Also fixed there: `magnitudes.hundred` was `"একশো"`, which already contains its own এক, so the composer's
unit+hundred gave "এক একশো" for 100. Changed to `"শত"`.

### 3. What the normalization layer itself needed

Bengali had **no symbol tier at all**, so `%` and every currency sign were dropped outright and Latin unit
abbreviations were unexpanded. Added, plus a Bengali-abbreviation table (কিমি → কিলোমিটার), the clock, signs,
fractions ("denominator ভাগের numerator"), and ordinals.

Ordinals have TWO suffix series here, both suppletive at the bottom: the CLASSICAL one (৮ম = অষ্টম, not
*আটম, suppletive through ten, regular তম above) and the DATE one, which is what the corpus actually
contains — শে ×10 (২৬শে নভেম্বর), ই ×8 (৮ই জুলাই) — with its own suppletives (১লা পহেলা, ২রা দোসরা).

**A measurement error of mine, worth recording:** my first ordinal regex counted 147 occurrences, which
would have made this the dominant class. It was matching `ম` *inside* words like মিটার. With a proper
trailing lookaround the real figure is ~31, and the composition of the class changed completely — it is
dominated by date suffixes, not the classical series. Loose regexes over-count; check the contexts.

### 4. First language with MIXED digit systems

The corpus writes ASCII ×1299 AND Bengali digits ×483, including inside times (১১:২০), decimals (২.৩) and
fractions (১/৫). Step 0 folds Bengali digits to ASCII so there is one representation downstream — which
also repairs the shared symbol tier, whose number pattern is ASCII-only and was therefore dropping the
percent sign of "৮%".

### Verification

- 198 files / 2123 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical (47.4%/87.5% and 93.2%/98.4%) — expected, since it evaluates word-level
  pronunciation rather than the compositor or the normalizer.
- bn corpus: 2,995 of 3,006 cased-column utterances changed; **defects went from 2,995 slot-gaps and 2,949
  stray marks to zero**. Two existing tests had PINNED the bugs (the padded danda, and 1999 as
  "নয় একশো নয় নব্বই") and were corrected.

## Run 13 — 2026-07-30 — Arabic (its own symbol characters, and a near-miss)

Seventh language. Arabic arrived in better shape than most: its punctuation is already right (، ×1664, ؛,
؟ are all clause marks) and Arabic-Indic digits already fold to ASCII in the number path. So the work was
narrow, and two things dominate this entry.

### The Arabic-specific SYMBOL characters

Unicode gives Arabic its own percent sign ٪ U+066A, decimal separator ٫ U+066B and thousands separator
٬ U+066C. Every shared rule in the fleet is written against the ASCII ones, so ٪ was **dropped outright** —
this was the known-deferred defect on the list, and the corpus's one instance is "93٪ من السكان", where the
percentage simply vanished. Folding these to their ASCII equivalents in step 1 means the shared symbol tier
and the number tokenizer both work unchanged, instead of every downstream rule needing an Arabic branch.

### A near-miss worth recording: `م.` ×97 is not an abbreviation

A naive abbreviation scan reports `م.` 97 times and `د.` 3 times — by far the largest apparent abbreviation
class, and an obvious thing to build a table for. Reading the contexts shows they are **not abbreviations at
all**: they are ordinary words ENDING in م or د followed by a sentence period — بداخلهم. "inside them.",
واحد. "one.", جرينلاند. "Greenland.". A table keyed on those letters would have mangled 100 ordinary
sentence endings. Arabic has essentially no dotted abbreviations here, so the file has no abbreviation
table. This is the third time a loose regex has over-counted a class (Bengali ম inside মিটার, Hindi's
suffix scan); reading contexts before writing the rule is now non-negotiable.

### What was broken

| class | before | after |
|---|---|---|
| percent | `93٪` → the sign DROPPED | `fˈiː almˈiʔa` |
| grouping | `1,000` → `waːħid , sˤifr` — separator became a PAUSE | `ʔalf` |
| decimal | `1.5` → `waːħid . xamsa` | `waːħid fˈaːsˤila xamsa` |
| clock | `11:00` → `ʔaħada ʕaʃar , sˤifr` — pause + a spurious صفر | `asˈaːʕ ʔaħada ʕaʃar` |
| units | `5 كم` → `[km]`; `20 °C` → the English letter C | expanded |
| currency | `$50` → the sign dropped | `xamsuːn duːlˈaːr` |

### Everything this layer emits is DIACRITIZED

The engine reads undiacritized Arabic as a bare consonant skeleton, so an unvocalized emission comes out as
[drd͡ʒ] / [kjlwmtr] / [dqjq] instead of [dˈarad͡ʒa] / [kiːluːmˈitr] / [daqˈiːqa]. That is a pre-existing
limit of the OOV path for ordinary source text — out of scope here — but it is entirely avoidable for the
words we choose to insert, so every unit, currency, sign and clock word carries harakat.

### A defect this run INTRODUCED, caught by the corpus diff and not by any probe

The clock rule supplied الساعة unconditionally. In this corpus a clock time is essentially always already
preceded by it ("في تمام الساعة 8:46", "حوالي الساعة 11:00"), so the output became "الساعة الساعة". Now
supplied only when the text lacks it. Every unit probe I had written passed; only the before/after corpus
diff showed it — which is the standing argument for making that diff a required step.

### Verification

- 198 files / 2128 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical for both varieties: ar 3082/4758 (64.8%) folded / 91.3% symbol; arz 48.8% / 83.1%.
- ar_eg corpus, both columns: 65 of 2,104 changed, 0 digit leaks, 0 sentinels, 0 slot-gaps, 0 stray symbols.
  Sampled review found them all improvements.

## Run 14 — 2026-07-30 — Portuguese (and the º/ª leak finally closed)

Eighth language, and structurally the closest to Spanish: same ordinal indicators, same dot-thousands /
comma-decimal conventions, same era markers. One layer serves both varieties, since pt-BR is the same
engine with `dialect: "bp"` plus an open/close lexicon rather than a fork.

This closes the **`º`/`ª` leak** first recorded in Run 1 — the raw U+00BA/U+00AA reaching the phoneme
string. It was found in es-419, it, ca, gl, ro and pt; Spanish was fixed in Run 9 and Portuguese now here,
13 corpus utterances. The remaining four (it, ca, gl, ro) are still open.

### Already correct and untouched

Dot-thousands (1.000 → mil) and comma-decimals were already in the number tokenizer; % and the metric units
work through the shared symbol tier; dates take a plain cardinal day; and Roman numerals arrive already
converted from the registry seam (pt is not in ROMAN_NATIVE), so `século XV` was right and the
roman-vs-initialism ordering hazard cannot arise — the same structural relief Spanish and Hindi got.

### What was broken

| class | before | after |
|---|---|---|
| ordinal | `1º` → `ũ º` — raw º in the OUTPUT | `pɾimˈejɾu` |
| clock | `07h19` → `sˈɛt͡ʃi dezenˈɔvi` — the h marker DROPPED (×28) | `sˈɛt͡ʃi ˈɔɾɐs e dezanˈovi` |
| clock | `8:46` → colon became a PAUSE (×17); `11:00` → a spurious "zero" | fixed, `hora` feminine at 1 |
| currency | `R$ 50` → a stray [ʁ] plus "dólares" — the shared tier saw only the $ | `sĩkˈẽtɐ ʁjˈajs` |
| abbrev | `Sr.` → `[zʁ]` + pause; `Dr.` → `[dɾ]`; `etc.` → `[ˈetk]`; `a.C.` → two pauses | expanded |
| initialism | `EUA` → the word `[ˈewɐ]`; `TV` → `[tv]`; `FBI` → `[fbˈi]`; `GMT` → `[ɡmt]`; `HJR` → `[ʒɾ]`; `GP` → `[ɡp]` | spelled out |
| units | `km/h` lost its /h; `20 °C` → `[k]`; `35°` → the sign dropped | expanded |

### A claim of mine that was wrong, and corrected

I first wrote the date rule with a comment saying Brazil and Portugal agree on the first of the month.
They do not: Brazil says *primeiro de julho*, Portugal normally *um de julho*. Dialect-gated now, the same
way Spanish was — and the plumbing already existed, since `createPortuguese` takes the dialect. An explicit
`1º` is honoured in BOTH, because there the writer marked it.

### Verification

- 198 files / 2133 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical for both varieties: pt 3857/4749 (81.2%) folded / 96.4% symbol; pt-BR 86.9% / 97.7%.
- pt_br corpus, both columns: 198 of 2,793 changed on the cased column, 69 on the lowercased; the 13
  stray-mark defects are now **zero**, with no digit leaks, sentinels or slot-gaps. Sampled review found
  them all improvements.

## Run 15 — 2026-07-30 — Russian, and an ASCII-only boundary inside core itself

Ninth language, and the first CYRILLIC one to reach the shared initialism pass — which is how it found a
bug in `core/initialisms.ts` that had been latent since Run 5.

### The core bug: `\b` in the shared initialism pass

`core/initialisms.ts` matched all-caps runs with `/\b\p{Lu}{2,}\b/`. `\b` is defined on ASCII word
characters, so it finds no boundary against Cyrillic and **the entire pass was a no-op for Russian**:
`США` (×47 in the corpus) came out as the unpronounceable cluster [sʂa], `ДНК` [dnk], `ВМС` [vms],
`ТВ` [tf]. Now an explicit lookaround. This is the fifth appearance of the same trap — French matching
INSIDE an accented word, Hindi and Bengali matching nothing before their scripts, Mandarin's whitespace
lookahead, and now core itself — and it will hit every remaining non-Latin language, so it is worth
treating as a checklist item rather than a discovery each time.

Fixing it also improved the Latin-script languages slightly, in a way worth recording: the old pattern
could not match a letter run ADJACENT TO A DIGIT either, so `A1GP` read as [ɡp] in English and Portuguese.
Two utterances each, both now letter-spelled. Verified by re-running those corpora: exactly 2 changed, both
improvements, and the referee is byte-identical for en, fr, es, pt-BR and ru.

### The hard part: ordinal notation is CASE, not ordinality

Russian writes `5-е`, `1-й`, `1970-х`, `3-м`, and the suffix is the CASE ENDING, not an appendable ordinal
marker: `5-е` is пятое (neuter nom), `5-го` пятого (gen), `1970-х` семидесятых (gen pl). So the rule reads
the ending off the text and INFLECTS the ordinal to match — the written form shows the last letters of the
full word, so concatenating would produce nonsense. Previously each spoke the bare letter: `5-е` → [pʲætʲ je].

Two extensions were needed. The existing former (`russian/romanOrdinals.ts`) is masculine-nominative and
stops at 100, so `1970-х` needed the "only the last element inflects" split — cardinal head plus the
ordinal of the final ≤100 part — and a stem/ending substitution table, with третий as the single soft stem.

### What else was broken

| class | before | after |
|---|---|---|
| grouping | `5 000 лет` → "пять ноль лет" | `pʲætʲ tˈɨsʲət͡ɕ lʲet` |
| clock | `11:00` → a PAUSE plus "ноль" | `ɐdʲˈinːət͡sətʲ t͡ɕɪsˈof`, with час/часа/часов agreement |
| abbrev | `г.` → a bare [k]; `н. э.` and `т. е.` → interior dots as phrase breaks | expanded |
| № | dropped outright | `nˈomʲɪr` |
| units | `км/ч` → the ч as a letter; `°C` → the English letter C | expanded |

`г.` is case-sensitive to its governor: `в 2007 г.` is *в 2007 году* (prepositional), not *года*. Checking
the contexts first showed all three corpus instances are year senses, none the city sense of `г.`.

### A misfire this run introduced, caught by the corpus diff

The clock rule matched `2:11,60 минуты` — a SPORTS time (2 min 11.60 s), not two o'clock — and read it as
"два часа одиннадцать минут". Guarded on a following comma-plus-digit. That is now twice (with Arabic's
doubled الساعة) that the before/after corpus diff caught something every unit probe passed.

### Verification

- 198 files / 2138 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical for ru (94.8%) AND for en, fr, es and pt-BR, confirming the core change is safe.
- ru corpus, both columns: 170 of 2,562 changed, zero defects. Sampled review found them all improvements.

## Run 16 — 2026-07-30 — Urdu (four defects, three of them outside the normalization layer)

Tenth language, and the pattern from Bengali repeated almost exactly: the largest problems were in the
manifest and the engine, not in a missing normalization pass.

### 1. A DIGIT LEAK — ASCII digits reaching the IPA

`number()` returned the raw string whenever the value was not a safe INTEGER, so every decimal leaked:
`1.5 میٹر` came out as literally `1.5 mˈiːʈəɾ`. 19 corpus utterances. The manifest also had **no decimal
word at all**, so even once parsed there was nothing to say — اعشاریہ added.

### 2. `clausePunctuation` mapped every mark to a PADDED copy of itself

`"۔": " . "` — canonical marks, but wrapped in spaces, producing double-space slot-gaps on the full stop
that ends almost every utterance. **2,021 of 2,109 cased-column utterances had a slot-gap; now zero.**
Identical to the Bengali defect two runs ago, which suggests checking this block is worth doing eagerly for
the remaining languages rather than discovering it per-language.

### 3. Urdu numbers 21–99 were all wrong

No `compound` map, so the shared composer's unit+tens fallback gave "ایک بیس" (*one twenty*) for 21 and
corrupted every year (1959 → "نو پچاس"). Corroboration was much better than Bengali's: **23 of 72 attested**
across three independent sources — the CLE-speech referee ×20, wikipron ×7, the FLEURS corpus itself ×4 —
spread over every decade with no contradictions, and the engine reproduces the referee's phone sequence
exactly for those it prices (اکیس → `ɪkkˈiːs` vs `ɪ k k iː s`; باون, اکانوے likewise).

Two things worth recording from that work. The forms are authored WITHOUT harakat, because the
undiacritized spellings read correctly here and in places better than diacritized ones. And **72 بہتر is a
genuine homograph** — *bahattar* "72" versus *behtar* "better" — so the referee entry for that string
attests the adjective. That homograph is also the reason the engine's number path deliberately bypasses
the content lexicon: consulting it would read the numeral as the adjective.

### 4. What the normalization layer itself needed

Urdu had **no symbol tier at all** (% and every currency sign dropped), no ordinal-suffix handling
(واں/ویں spoken as their own syllable, ×27), no clock (the colon reached the output raw), and no handling
for the SPACED unit spelling `کلو میٹر`, which read as two words.

One find the corpus diff produced after the main fixes: the **Arabic comma doubles as a thousands
separator** in Urdu (`11،000`, ×20 instances). Between digits it is grouping, not punctuation — left alone
it was a clause break and the number read as "eleven … zero". Only the digit-flanked case is folded, so ،
as real punctuation is untouched.

### A fourth over-count, and the standing rule holding

A naive abbreviation scan reports `قم` ×5, which looks like the BC marker قبل مسیح. Reading the contexts
shows it is the start of قمری "lunar" — the regex matched the first two letters of a longer word. This is
the fourth time (Bengali ম inside মিটার, Arabic م. as a word-final letter, Hindi's suffix scan), and each
time reading contexts first prevented a rule that would have damaged ordinary text.

### Verification

- 198 files / 2144 tests pass (6 new); `tsc --noEmit` clean.
- Referee byte-identical: 4382/7709 (56.8%) folded / 87.4% symbol, second set 59.4% / 88.1%.
- ur corpus, both columns: 2,029 of 2,109 changed on the cased column; **19 digit leaks and 2,021
  slot-gaps → zero**, no sentinels or stray marks. Sampled review found them all improvements.

### Known gap left

`AU` (×3) reads as the English word rather than letters, because CMUdict carries `au` and the dictionary
branch wins. That is a pre-existing English lexical call reached through the Latin-run delegation, not an
Urdu defect, and is left alone.

## Run 17 — 2026-07-30 — Indonesian (one separator, two meanings)

Eleventh language. Three defects were outside the normalization layer again — the pattern from Bengali and
Urdu — and the language file itself is small.

### Outside the layer

1. **`clausePunctuation` mapped every mark to a PADDED copy of itself.** Third time (Bengali, Urdu, here).
   2,575 of 2,579 cased-column utterances had a slot-gap; now zero.
2. **The number token was a bare `\d+`**, so BOTH Indonesian separators became clause pauses: dot-thousands
   `9.000` → "sembilan . nol" (×67, the largest class) and comma-decimals `1,5` → "satu , lima" (×28).
3. **No decimal word at all** — `koma` added.

### The ambiguity that shapes the language file

Indonesian writes the thousands separator AND the clock with a period: `9.000` (×67) and `11.00` (×29).
They are separable by digit count — grouping always takes exactly three digits after the dot, a clock
exactly two — so the clock is claimed in normalize.ts BEFORE the number tokenizer, and everything the
tokenizer then sees with a dot is real grouping.

That rule needed **two** guards, and the second only showed up in testing. The trailing guard keeps a RACE
time out (`4:41.30, 2:11.60 menit` is minutes:seconds.hundredths; the corpus has three). The LEADING guard
stops the scan restarting inside one: with only the trailing guard, `1:09.02` correctly rejected `1:09` and
then matched `09.02` as a clock in its own right.

### Already correct, and worth stating

Indonesian ordinals need NOTHING: `ke-16` is genuinely "ke" plus the cardinal, which is what the engine
already produced — the only language so far where the ordinal notation was already right. The manifest also
carries a `letterNames` map, so initialisms already spell out (PBB → pe-be-be, GPS → ge-pe-es); they are
joined without spaces, which is fine prosodically. Roman numerals arrive converted from the registry seam.

### What the layer added

Indonesian had **no symbol tier at all** (% and every currency sign dropped, `30 km` read as `[ʔm]`), no
abbreviations, no degrees, no signs, no fractions. `Rp` needed its own rule: it is a two-LETTER prefix,
which the shared tier — keyed on single-character signs — cannot express, and it was read as `[rp]`.
Indonesian says the unit after the amount, so the prefix is moved.

### Verification

- 198 files / 2149 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical: 17639/18590 (94.9%) folded, 98.9% symbol.
- id corpus, both columns: 2,575 of 2,579 changed on the cased column; **2,575 slot-gaps → zero**, no digit
  leaks, sentinels or stray marks. Sampled review found them all improvements.

## Run 18 — 2026-07-30 — fleet-wide audit: fixing two defect classes across all 191 languages

Eleven languages of hand work kept turning up the same defects, so this run stopped adding languages and
looked for them mechanically instead. New tool: `tools/normalization-audit.ts`.

### Method: runtime probes, not static inference

A static scan of the manifests reported 71 with a PADDED `clausePunctuation` value and 30 mapping a mark to
a native character. But padding is only a DEFECT if the engine passes it through, so the audit probes every
registered language at runtime with inputs every engine can take — ASCII digits and ASCII punctuation
(`1, 2. 3? 4!`), plus `50%` vs `50` and `$5` vs `5` — and flags what actually reaches the IPA.

The detector was validated against the eleven already-treated languages, all of which come back **clean**.

### Findings, first run: 143 of 191 languages flagged

| flag | count | meaning |
|---|---|---|
| CUR-DROP | 140 | the currency sign vanished |
| PCT-DROP | 138 | the percent sign vanished |
| GAP | 73 | a padded pause reached the output as a double space |

Zero DIGIT leaks and zero RAWMARK on the ASCII probe — but probing with NATIVE punctuation showed the raw
marks were real: `।`, `॥` and `…` landed in the phoneme string in Assamese, Bishnupriya, Kannada, Odia,
Afrikaans, Catalan, Irish, Gaelic, Swedish, Welsh, Finnish, Georgian and Hebrew.

### Fixed: the two formatting classes, 76 manifests + 1 engine

Applied the convention already established by english/hindi/french/german/spanish — sentence-enders → `.`,
`?`/`!` kept, and `,` `;` `:` `…` → `,`. **GAP 73 → 0, RAWMARK → 0.**

Lao was the one straggler and needed a code change rather than a manifest one: it hardcodes
`sink.pause(" . ")` instead of reading `clausePunctuation`, and it also collapsed `?` and `!` into `.`,
throwing away the sentence type. Both fixed.

17 tests failed on the sweep and every one was PINNING the padded output (`"… tu  . "` with a double space
and a trailing space). Corrected.

### NOT fixed, and why: the symbol tier (138/140 languages)

Closing PCT-DROP and CUR-DROP means giving each language its word for "percent" and its currency names —
real per-language data, not a formatting change. Bulk-inventing that across ~138 languages is exactly the
mass unverified authoring the provenance posture exists to prevent, and a wrong percent word is worse than
a dropped sign because it is confidently wrong rather than merely missing. The audit reports the list; the
tier gets added per language, with a source, the way the treated eleven did it.

### Verification

- 198 files / 2149 tests pass; `tsc --noEmit` clean.
- Referee byte-identical across a ten-language spread of affected engines (fi, pl, uk, ro, sk, nb, th, te,
  pa, my) — expected, since the referee scores word-level pronunciation, not punctuation.
- Re-running the audit: GAP 73 → 0, RAWMARK → 0, and the eleven treated languages still clean.

### What this says about the per-language work

Two of the three recurring classes were mechanical all along and could have been swept at any point after
the first sighting. The one that could not — the symbol tier — is the one that needs a human-sourced word
per language. That is a useful split to remember before starting language twelve: sweep what is
formatting, hand-author only what is linguistic.

## Run 19 — 2026-07-30 — German, and the `N.` ordinal detector Run 1 deferred

Twelfth language, and the one the ordinal thread has been building towards. German writes the ordinal as a
numeral plus a bare PERIOD — `16. Jahrhundert`, `am 17. September` — which Run 1 excluded from its counts
with the note that "a regex cannot distinguish it from a sentence-final digit or a list marker". It is the
largest single defect here (×109), and every instance read as a cardinal followed by a PAUSE:
`im 16. Jahrhundert` came out as *sechzehn . Jahrhundert*.

### The detector, built from the corpus rather than intuition

Tabulating what surrounds `N.` across the 2,987 de_de utterances settled it:

| position | evidence |
|---|---|
| AFTER | `Jahrhundert(s)` ×34, month names ×66, a few regiment names — and **79 with NOTHING after**, the sentence-final periods that must not be claimed |
| BEFORE | am ×54, im ×14, des ×9, dem ×8, das ×7, zum ×5, vom ×2, bis ×2, ins ×1, den ×1 |

So the rule fires on the FOLLOWING word being a month or Jahrhundert — which alone covers ~100 of the 109 —
or on a preceding date/ordinal-licensing article plus a capitalised noun, which picks up the regiments. A
sentence-final `N.` satisfies neither: nothing follows it, and the word before is a content word.

**Verified on the corpus, which is the only check that matters here: 109 utterances contain a digit-period
and ZERO sentence-final pauses were lost.**

### Declension from the same evidence

The governing word decides the ending: `am/im/vom/zum/dem/des/den/ins/seit/bis` take the weak **-en**
(*am siebzehnten September*, *des sechzehnten Jahrhunderts*), `das/der/die` take **-e** (*das sechzehnte
Jahrhundert*). That is not full case agreement — it is the two forms the corpus actually needs, and the
distinction is stated as such rather than overclaimed. Stems are the cardinal plus -t below 20 and -st above,
with four suppletive stems (erst, dritt, siebt, acht).

### The separators were backwards

German groups thousands with a PERIOD and takes a COMMA decimal, but both the token class and the number
handler treated either as a decimal — so `1.000` read as *eins komma null null null* (×55). Fixed in both
places. The clock was broken in both its written forms too: `11:00` made the colon a pause with a spurious
"null", and `11.00 Uhr` was read as a decimal.

### What else

Abbreviations were consonant clusters plus pauses (`bzw.` ×13 → [pt͡sf .], `z. B.` ×11 → [t͡s . p .],
`v. Chr.` ×11); initialisms were read as words (`USA` → [ˈuːzaː], `US` ×30 → [uːs], `PBS` → [pps]); `km/h`
and `°C` lost their tails; the plus sign was dropped.

### Verification

- 198 files / 2154 tests pass (5 new); `tsc --noEmit` clean.
- Referee byte-identical: 3711/4744 (78.2%) folded, 96.1% symbol.
- de corpus, both columns: 378 of 2,987 changed on the cased column, 129 on the lowercased; zero digit
  leaks, sentinels, slot-gaps or stray marks, and zero sentence-final pauses lost.
