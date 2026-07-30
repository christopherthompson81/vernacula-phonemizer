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
