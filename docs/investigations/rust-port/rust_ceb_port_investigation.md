# Rust port: Cebuano (`ceb`)

Branch `worktree-agent-a5a40cba5874eaeda`, after tl. Part of #1463. The group's import closure is
rust_id_port_investigation.md Run 1: ceb imports nothing from another language, and every core module it needs
(`clauses`, `hostWord` hostWordRun/makeNativiser, `loadManifest`, `numbers` digitIndex, `normalizeSymbols`,
`provenance`) is ported. No neural entry, no Roman policy.

## Run 1 — 2026-10-11 05:58 (the port and the golden gate)

**Command.** Ported `languages/cebuano/{manifest,numbers,normalize,cebuano}.rs`, one `build` arm, `ceb` in
`LANGUAGES`; `cd rust && cargo run --release -p parity -- ceb` and `--sync ceb`.

**Raw finding.** `ceb: 200/200 identical, 0 differ`, both modes, first build. Two shape notes from writing it:
- As in Indonesian, the TS `CebuanoManifest` types `exponentWords.cubed` as REQUIRED while cebuano.jsonc has
  `squared` only, so the Rust field is `Option` (a required one would refuse the file the TS loads).
- numbers.ts loads the same jsonc under its own `{ numbers: CebNumbers }` type; the Rust mirrors that (numbers.rs
  owns its struct) rather than adding `numbers` to the manifest struct the TS interface does not name.
- The symbol tier is module-level in normalize.ts (`SYMBOLS`), so it is a once-built static there, and
  `create_cebuano` checks it so no load can panic later.

**Implication.** The golden has 103 distinct texts. The differentials carry the rest.

## Run 2 — 2026-10-11 06:02 (per-module differentials, end to end, sensitivity)

**Commands.** `FLEURS_ROOT=<external-drive>/… npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/ceb/<name>.jsonl`, each
replayed by fn-diff; `LANGS=ceb`, `SYMBOLS_LANGS=ceb`. Inputs: the ceb golden, FLEURS ceb_ph columns 3 and 4 (first
row checked to be a sentence) and new synthetic `probes/ceb.txt` (each normalize.ts step with its neighbour: grouped
vs two-digit groups, colon / licensed-dot / unlicensed-dot / military clocks and a year, the tier's signs and units,
1/2/3-digit decimals, the range guards incl. a written connective, a chain and `ika-20`, the closed abbreviation
list against a sentence-final `Japan.`, fractions, `+` and the unread signs; g2p corners; numbers to 10¹⁹).
- `ceb-normalize`: `normalizeCebuano` (the tier is inside it).
- `ceb-g2p`: `phonemizeWord` and the nativiser (module-private in cebuano.ts, rebuilt in dump.mts with the same
  class and flags) over every letter run of the texts (as written, lower, UPPER), every 1–3 letter string over
  a–z, ñ, both apostrophes and both hyphens, and edge strings.
- `ceb-numbers`: `numberToWords` over 0…20,000, scaled samples, powers of ten to 10²¹, 10⁹−1/10⁹, 2⁵³±1, −1, −0,
  NaN, ±∞, and raw strings (leading zeros, empty, letters, full-width digits, a lone surrogate).

**Raw finding.**
```
ceb-normalize:  3878 identical, 0 DIFFER   (golden 103, fleurs 3761, probe 14)
ceb-g2p:        101440 identical, 0 DIFFER
ceb-numbers:    22073 identical, 0 DIFFER
phonemize-sync: 3878 identical, 0 DIFFER
phonemize-best: 3878 identical, 0 DIFFER
trace:          3878 identical, 0 DIFFER
symbols:        6936 identical, 0 DIFFER   (probe 3072, cebuano 3864)
```
**Sensitivity**, each reverted after and re-replayed green:
- the hyphen glottal made unconditional (`if true`): `ceb-g2p: 3555 DIFFER`.
- the clock's `ug` joiner misspelt: `ceb-normalize: 22 DIFFER`.
- A first attempt to break the military-clock rule by a `sed` on the pattern did not apply (0 matches of the edited
  text, checked with `grep -c`), so it proved nothing and was replaced by the joiner break above.

**Implication.** ceb meets the parity definition on this machine; nothing is port-pending.

## Run 3 — 2026-10-11 06:05 (reading for correctness: TS findings; the suite; gates)

**Command.** `npx tsx .probe/ceb/findings.mts` (normalize output and reading on synthetic inputs);
`node .probe/pins.mjs test/cebuano.test.ts`.

**Raw finding (TS defects, reproduced by Rust, not fixed).**
1. **A decimal with three or more fraction digits is not a decimal** (normalize.ts step 4, `\.(\d{1,2})(?![\d.,])`):
   `3.141 ka metro` → *tˈulo . ʔˈusa kˈa ɡˈatos ʔˈuɡ kapʔˈatan ʔˈuɡ ʔˈusa …* ("three PAUSE one hundred and forty-one")
   and `0.125` likewise — the point becomes a clause pause and the fraction a cardinal. The two-digit cap reads as a
   guard against a thousands group, but de-grouping (step 1) has already consumed comma groups and this corpus never
   writes a dot group (the header says ×0), so nothing needs protecting.
2. **The clock's meridiem licenses the rule but is then read raw**: `12.30 pm` → *… katlˈoʔan pm* (the letters `pm`
   emitted as IPA with no vowel), `8.15 p.m.` → *… lˈima p . m .* with two clause pauses. Step 2's lookahead
   accepts `[ap]\.?m\b`, and nothing afterwards reads the marker.
3. `5 m³` → *lˈima mˈetɾo*: the cube is dropped silently (the manifest declares `squared` only). Same class as
   Indonesian's; recorded, not new.
4. No `Object.prototype` read: the manifest maps are prototype-free (checked for tl, same loader), the abbreviation
   lookup handles the miss.

test/cebuano.test.ts gives 10 `phonemizeWord`, 4 `createCebuano().text(…).trim()`, 1 `phonemize`, 15 contains and 2
not-contains pins, all literal; they are a Rust test. Guard proved: the `ug` joiner misspelt →
`the_ts_suite_pins_hold ... FAILED`; restored → ok.

**Gates on the final tree.**
```
parity (all 24 codes in LANGUAGES, incl. ceb): 200/200 identical each
cargo test --workspace --release: 135 passed + 1 doc-test crate, 0 failed
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo fmt --check: clean
cargo clippy: only module_inception on cebuano/mod.rs in the new files
```
No TS regex was added or changed. Large dumps in `.probe/ceb/` deleted.

**Implication.** Done on this machine.

## Run 4 — 2026-10-11 16:40 (#1534: fixing the Run 3 findings, TS first)

**Command.** `npx tsx .probe/1534/q.mts ceb …` on synthetic inputs; FLEURS ceb_ph column 3 grepped for
fraction lengths, meridiems and part-of-day phrases.

**Question.** Is the two-digit decimal cap protecting anything here, and what does this corpus say after a clock?

**Raw finding.**
1. **Decimals.** Fraction lengths in ceb_ph: 1 digit ×14, 2 digits ×5, three or more ×0, and the header's
   period-thousands count is ×0. So the cap protected nothing. `(\d)\.(\d+)(?![\d.,])`: `3.141 ka metro` → *tˈulo
   pˈunto ʔˈusa ʔˈupat ʔˈusa kˈa mˈetɾo* (was *tˈulo . ʔˈusa kˈa ɡˈatos …*), `0.125` likewise.
2. **Meridiem.** One corpus clock carries one: `alas 8:30 p.m. sa lokal`, which read *… p . m . sˈa lˈokal*.
   The others say the part of the day: `9:30 sa buntag`, `07:19 sa buntag`, `10:00 sa buntag`, `10:08 sa gabii`,
   `11:00 sa gabii`, and one `09:19 sa hapon GMT` (a GMT conversion of a 9 p.m.). The fix rewrites `H[.:]MM` +
   `[ap].?m.?` to the clock followed by `sa buntag` (a.m.), `sa gabii` (p.m., hour mod 12 from 6 to 11) or `sa
   hapon` (other p.m.), before the clock rules, so the dot clock still finds its licence. `12.30 pm` → *… sˈa
   hˈapon*, `8.15 p.m.` → *… sˈa ɡabˈiʔi*, `9:30 pm` (colon, also raw before) → *… sˈa ɡabˈiʔi*. Not attested and so
   not claimed: 12 a.m. (it reads `sa buntag`) and the noon word *udto*; a bare hour with a meridiem (`8 p.m.`) is
   untouched.
3. **`cubed`.** manifest.ts types it optional now, matching cebuano.jsonc.

**Implication.** Mirror into C# and Rust; regenerate the ceb golden (the p.m. sentence is not among its 200 rows).
