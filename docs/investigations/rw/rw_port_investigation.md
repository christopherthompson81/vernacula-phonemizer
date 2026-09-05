# rw — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the rw port (2026-08-26) — 200/200 first run, one TS fix, two filed

**rw (Kinyarwanda, ~12M)** — 4 files, ~470 C# lines: a greedy longest-match grapheme scan (the ⟨Cy⟩
palatalisation series), the shared Rwanda-Rundi cardinal compositor, and a 610-line normalizer that owns the
shared symbol-tier call from BOTH sides (de-grouping before it, the decimal spell-out after it). No FLEURS
corpus and no espeak backend exist for rw, so widening (1) is the 443-line mined artifact rather than a
transcript; the differential ran 849 lines (445 mined + 132 attest + 277 adversarial) plus 96 separator
probes, sync AND async, **0 differ, 0 throws**. Coverage of the new code, measured not assumed: 580 probe
lines carry a digit, 159 a decimal separator, 117 a unit key, 66 a span, 40 a percent, 33 a degree sign, 33
an exponent, 30 a colon time, 26 a currency key, 16 a dotted capital run.

Fixed in TypeScript first, with a test, then ported:

- **rw's number call site re-stringified the double instead of passing the token text** — the #1059 shape,
  and rw was on `large-numeral-fidelity`'s ACCEPTED_LOSSY list. `numberToWords(Number(m[2]))` dropped `raw`,
  so the digit-at-a-time fallback — which exists *precisely because the float cannot be trusted* — then read
  the float back out. `9007199254740993` read `…kʲenda kʲenda kabiɾi` (…992, the rounded value) and
  `12345678901234567890` read its last three digits as *zeɾu zeɾu zeɾu* against a written `890`. A
  confidently wrong quantity, not a drop, and the sibling engines that share this compositor's shape (shona,
  chichewa) already passed `raw`. **0 golden rows move** — the rw golden's longest digit run is 5.
  rw is now off ACCEPTED_LOSSY, which that test says may only shrink.

Found, not fixed — both corpus-attested, both engines agreeing, and the second needs a FLEET decision:

- **The `dogere` redundancy guard gives ONE CONSTRUCTION TWO ANSWERS.** `saidNear` reads the ±45-character
  window of the string `String.replace` handed the callback — the PRE-replacement one — so a sibling match in
  the SAME pass is invisible while one in a LATER pass is not. Measured on the corpus's own °C/(°F) glosses:
  `−27.2 °C (−17.0 °F)` says the noun twice (both figures negative, both claimed by arm 4a) while
  `−14.4 °C (6.1 °F)` says it once (the second figure falls to arm 4c, whose snapshot already carries the
  insertion). Same construction, two readings, decided by which arm claimed the first figure. `25.3°C na
  27.7°C` likewise emits `dogere selisiyusi` twice where the corpus's own spell-out
  (`dogere 22° na 35° z'amajyepfo`) writes the noun ONCE for two signs. ⚠ NOT FIXED, because the obvious
  blanket fix REGRESSES the coordinate arm: `2° 36′ 58″ S, 29° 44′ 34″ E` is 14 characters apart and the
  corpus repeats the noun per AXIS on purpose (`dogere 22°… (S) na dogere 16°… (E)`). A correct fix has to
  be per-arm — within-pass memory for the temperature arms, none for the coordinate arm — and it moves both
  of the golden's two degree-bearing rows on n=1 and n=5 evidence. Needs the decision, not the diff.
- **MAGNITUDE + NUMBER + CURRENCY is split down the middle, ×7 in the corpus.** rw writes the magnitude word
  BEFORE its figure (`miliyari 290 Frw`, `miliyoni 158$`, `miliyoni 20 $`, `miliyoni 2 Frw`, `miliyoni $800`,
  `miliyoni $440`, `miliyoni $247`) and `currencyPrefix` puts the currency phrase immediately before the
  number, so `miliyari 290 Frw` → *miliyari amafaranga y'u Rwanda 290* — the magnitude noun and its count
  separated by a four-word currency phrase. normalize.ts withholds `magnitudes` for a stated reason that is
  about the TIER'S CAPABILITY rather than the desired reading: "`magAlt` matches NUMBER-then-magnitude, so
  the hop can never fire". It cannot, and that is the defect — `core/normalizeSymbols.ts` has no
  magnitude-BEFORE-number arm at all. A per-language patch would paper over one language; this is the
  `roman`/`DC` shape, a fleet call on the shared tier. ⚠ And nya is the mirror case (NOUN+NUMBER+MAGNITUDE),
  so the tier is already known to meet at least three orders.
- Hygiene, no fix proposed: rw declines LETTER NAMES outright (no in-repo source, espeak ships no
  Kinyarwanda), and step 1's dotted-capital rule therefore FUSES a person's spaced initials into a pseudo-word
  — `P. W. Botha` → *pw botha*, `H. W. Bush` → *hw buʃ*, both corpus lines. The discriminator is clean (all 6
  abbreviation instances are UNSPACED — `U.R.S.S.`, `R.R.A`, `P.S.`, `D.C.`, `A.L.A.R.M.` — and both initial
  runs are SPACED), but with no letter-name table every available output is wrong, so the honest blocker is
  the sourcing gap the file already records.
- ⚠ **rn (Kirundi) CARRIES THE SAME NUMBER CALL-SITE DEFECT AND IS NOT FIXED HERE** — `kirundi.ts` also calls
  `numberToWords(Number(m[2]))` and `kirundi/numbers.ts` also drops `raw` on the way to the shared
  `composeRwandaRundi`. It is still on ACCEPTED_LOSSY. Reported rather than fixed, per trap 55: rn is a
  separate bring-up and a sibling is a hypothesis, not a source.
