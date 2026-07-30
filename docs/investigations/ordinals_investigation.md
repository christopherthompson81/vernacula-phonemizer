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
