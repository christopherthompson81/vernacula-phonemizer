# Historic letter forms: one registry fold instead of per-site guards

Question: can the #1122 shape (an `iu` regex matches a character its lookup table has no key for, and the miss is
spoken as "undefined") be removed fleet-wide, rather than guarded one language at a time? Four more languages were
reported with it during the Rust port: hu `ſtb.` (#1574), lb `aſw.` (#1578), zu `5 m/ſ` (#1593) and ha `12.8 m/ſ`
(#1597). All probes below are synthetic, apart from the two nci golden rows, which are book titles that the golden
already carries.

## Run 1 — 2026-10-15 17:40

Probe on main (9cfebcdc), TS engine:

```
zu   "5 m/ſ"      kʼuɬˈaːnu amamˈiːtʰa und̤ɛfˈiːnɛd̤      (plain s: … ŋɡ̤ɔmz̤uz̤wˈaːna)
ha   "12.8 m/ſ"   … tˈa˥kʷa˩s undeɸˈined
hu   "ſtb."       ˈundɛfinɛd .
lb   "aſw."       ˈundəfinət .
en   "5 K" (U+212A KELVIN SIGN)   fˈaᶦv kʰˈeᶦ   — same as ASCII K
sv   "5 Å" (U+212B ANGSTROM SIGN) feːm oː      — fine
```

All four reports reproduce. The Kelvin and Ångström signs, which also case-fold onto ASCII and Latin-1 letters, do
not.

## Run 2 — 2026-10-15 17:55

Which characters have the trap? I computed this from `csharp/fold-pairs.json` (the measured JS `iu` equivalence
classes): the characters whose fold partners are not reached through `toLowerCase()`.

```
node -e '…pairs where A.toLowerCase() !== B.toLowerCase()…'
```

Result: the trap characters, each of which lowercases to itself while folding onto another letter:

- Latin `ſ`, `ẛ`;
- Cyrillic U+1C80–U+1C88 (`ᲀ`–`ᲈ` → `в д о с т т ъ ѣ ꙋ`);
- Greek symbol variants `ϐ ϑ ϕ ϖ ϰ ϱ ϵ`, plus final `ς`;
- micro sign `µ`, and the combining ypogegrammeni U+0345.

Kelvin and Ångström are NOT in the set: they lowercase to `k` and `å`. That explains Run 1.

Census across the 163 artifacts in `tools/corpus/mined` and the goldens:

| char | mined | goldens |
|---|---|---|
| `ſ` | 21 la, 3 nci | 3 nci |
| `ẛ`, `ᲀ`–`ᲈ`, `ϐ ϑ ϖ ϱ ϵ` | 0 | 0 |
| `ϕ` | 2 la | 0 |
| `ϰ` | 1 ast | 0 |

(The `ι` U+1FBE count from the same grep is unreliable, because the shell matched plain `ι`. That character isn't
folded, so it doesn't matter.)

Decision:
- Fold `ſ`, `ẛ` and the nine historic Cyrillic forms. Each is a typographic variant of its target letter and
  carries no reading of its own.
- Don't fold the Greek symbol variants. In Latin-script text (la, ast) they're mathematical symbols with their own
  meaning, and no site has been reported.
- Don't fold `ς`, which is a real letter, or `µ`, which is a unit symbol.

## Run 3 — 2026-10-15 18:10

I added `foldHistoricForms` to the registry's fold pass, right after the mojibake repair. It is mirrored in C#
(`Unicode.FoldHistoricForms`) and Rust (`fold_historic_forms`), and it uses the provenance `rewrite` so the trace
records the change.

```
zu "5 m/ſ" == "5 m/s"   ha "12.8 m/ſ" == "12.8 m/s"   hu "ſtb." == "stb."   lb "aſw." == "asw."
ru "тыᲃ. руб" == "тыс. руб"   nci "Caſtellana" → kastellana (was katellana: the letter was dropped)
```

`test/case-folded-lookup.test.ts` asserted that a folded near-miss reads DIFFERENTLY from its well-formed twin
("refused"). Through `phonemize` it now reads IDENTICALLY, so the assertion was changed to `toBe`, which is the
stronger contract. The per-site guards stay for callers that run a normalizer directly; the engine-level TS tests
(ilocano, galician, abbrev-word-edge) exercise them and pass unchanged.

Guard proof: with the fold removed from the registry chain, 19 of the TS tests fail, including all four new sites.
The new Rust test fails the same way without the wiring.

`check-goldens`: 1 of 189 languages is stale, nci, with 2 rows. Both are the `Caſtellana` titles, now
*kastellana*, and `Confeſsionario` → *konfessionaɾio*. No other language moved.
