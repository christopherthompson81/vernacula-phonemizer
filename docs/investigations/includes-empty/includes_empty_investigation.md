# `"…".includes("")` treats a missing neighbour as a member (#1476)

`String.prototype.includes("")` is `true`, and so is `indexOf("") >= 0`. Any check of the shape
`SET.includes(w[i + 1] ?? "")` therefore answers "yes" at the edge of the word: end-of-word reads as a vowel
(or as whatever class `SET` is). Italian shipped exactly this (`gas` → *ɡˈaz*), fixed in the Rust-port
follow-up. This log is the fleet sweep the issue asks for. `wu` is out of scope here (Sinitic engines are
owned elsewhere).

Probe scripts live in the worktree's ignored `.scratch/` and are not committed:
- `probe_empty.mts` monkey-patches `String.prototype.{includes,indexOf,startsWith,endsWith}` and records the
  first `src/` stack frame whenever the argument is `""` on a non-empty receiver, then phonemizes either every
  golden input (`csharp/goldens/*.tsv`, column 1) or every unique FLEURS raw transcript (`--fleurs`).
- `scan.mjs` is the static half: inline `.includes(… ?? "")`, plus `.includes(name)` where `name` was assigned
  from `… ?? ""` somewhere in the same file (noisy: names are reused across functions).
- `dump_fleurs.mts` writes `lang \t text \t ipa` for every unique FLEURS transcript, for before/after diffs.

## Run 1 — 2026-10-09 (time approximate)

**Command:** `grep -rnE '\.includes\([^)]*\?\? *""' src/` and `node .scratch/scan.mjs`.

**Question:** is the issue's list complete?

**Finding:** no. The inline shape alone has 26 sites outside tests (issue named 12). The static scan adds the
indirect shape — `const nx = w[i + 1] ?? ""` then `"eiy".includes(nx)` — in dutch, danish, german, french,
czech, akan, norwegian, portuguese, romanian, slovenian, lao, japanese, english, galician, igbo. Several are
already guarded by the house idiom `c !== "" && SET.includes(c)` (french/norwegian/dutch/swedish/german `isV`,
spanish/portuguese/galician/catalan/irish predicates, latvian `isVowelChar`). Latvian, named in the issue, is
**already guarded** (`isVowelChar` checks `c !== ""`). `totontepecmixe`'s site is an ARRAY `includes`
(`[..."aeiou…"].includes("")` is false), so it was never this bug. `english.ts:304` (`nextTags`) is also an array.

**Implication:** a static grep cannot see the indirect shape or the predicate-wrapped shape
(`isVowelLetter(s[i + 1] ?? "")` in yoruba). Reachability has to be measured at runtime.

## Run 2 — 2026-10-09 (time approximate)

**Command:** `echo kabw | npx tsx .scratch/probe_empty.mts --stdin sw` (instrument check), then
`npx tsx .scratch/probe_empty.mts` (all 189 goldens, 53 s).

**Question:** does the instrument fire on a known-reachable site, and which sites does real golden text reach?

**Finding:** the instrument fires on the crafted Swahili word (consonant + final ⟨w⟩) at `swahili.ts:81`, and
that word reads with the ⟨w⟩ deleted into labialization (`kabw` → *kˈaɓʷ*). Over all golden inputs, only
these call sites ever receive `""`:

```
3     includes   src/languages/dutch/g2p.ts:281        nl
12    includes   src/languages/french/g2p.ts:234       fr,fr-CA
21    includes   src/languages/german/g2p.ts:269       de
6     includes   src/languages/german/g2p.ts:365       de
81    includes   src/languages/german/german.ts:103    de
2     includes   src/languages/slovenian/slovenian.ts:108  sl
464   includes   src/languages/swedish/g2p.ts:48       sv
1513  startsWith src/core/germanicMorphology.ts:88     af,de,nl
```

None of the issue's swahili/yoruba/tagalog/cebuano/hiligaynon/dutch-344/germanicMorphology-53 sites is reached
by golden text. Four sites NOT in the issue are: dutch `g2p.ts:281` (word-final ⟨c⟩ → "before e/i/y" → [s]),
french `g2p.ts:234`, german `g2p.ts:269` and `:365`.

**Implication:** reading each reached site:
- `germanicMorphology.ts:88` `startsWith(lk)` with `lk = ""` is the ZERO linking element (Haus·tür has no
  Fugen-s) — intended, not this bug.
- `german.ts:103` `"ɪʊʏ".includes(ipa[i+1] ?? "") && ipa[i+2] === "̯"` — the second conjunct is false whenever
  the first was fooled, so neutral.
- `french/g2p.ts:234` `"ll".includes(nx) && at(i+2) === "l"` — same, neutral.
- `german/g2p.ts:269` `FULL_VOWEL.includes(nx) && seenVowel && i + 2 < n` — `nx === ""` means `i + 1 >= n`, so
  `i + 2 < n` is false; neutral.
- `swedish/g2p.ts:48` (464 hits) — word-final ⟨r⟩ takes the "r + dental" branch (`count++; j += 2`) instead of the
  plain one (`count++; j++`); both add one and both leave the loop. Neutral. Norwegian `:41` is the same code.
- `german/g2p.ts:365` — the guard `nx !== undefined` is dead (`nx` is `w[i+1] ?? ""`), so word-final ⟨h⟩ after a
  prefix-shaped stem (`/(be|ge|ver|…)$/`) is SOUNDED. Real bug candidate.
- `dutch/g2p.ts:281` — word-final ⟨c⟩ → [s]. Real bug candidate.
- `slovenian.ts:108` — the stress-by-suffix nucleus counter treats a word edge as a vowel, so a syllabic ⟨r⟩ at
  the edge of the counted prefix is not counted; `g2p.ts`'s `syllabicR` treats the edge as NOT a vowel. The
  counter disagrees with the thing it claims to mirror. Real bug candidate.

## Run 3 — 2026-10-09 (time approximate)

**Command:** `npx tsx .scratch/probe_empty.mts --fleurs` (every golden code that has a FLEURS split; all unique
raw transcripts, train+dev+test), then `… --fleurs tl pt-BR nb da cs` for the codes the first pass could not map.

**Question:** does real running text reach any site the 200-row goldens miss?

**Finding:** the same eight sites, plus two:

```
20     includes   src/languages/dutch/g2p.ts:281        nl
105    includes   src/languages/french/g2p.ts:234       fr,fr-CA
110    includes   src/languages/german/g2p.ts:269       de
33     includes   src/languages/german/g2p.ts:365       de
797    includes   src/languages/german/german.ts:103    de
23     includes   src/languages/slovenian/slovenian.ts:108  sl
4      includes   src/languages/swahili/swahili.ts:81   sw
5046   includes   src/languages/swedish/g2p.ts:48       sv
1      includes   src/languages/yoruba/yoruba.ts:17     yo     (the predicate, called from :98)
14395  startsWith src/core/germanicMorphology.ts:88     af,de,nl
```

The second pass (tl, pt-BR, nb, da, cs) reached nothing. Nothing at all fires for tagalog, cebuano,
hiligaynon, ilocano, indonesian, kyrgyz, romanian, thai, totontepecmixe or latvian.

Crafted words, one per indirect site found by `scan.mjs`, through the same instrument:
- Danish `danish.ts:104` (`"eiyæø".includes(next)`, `next = chars[i+1] ?? ""`): `bloc`, `kabc` and `isaac` do NOT
  reach it (final ⟨c⟩ comes out [ɡ] by another path). **Unreachable from these inputs; left alone.**
- German `g2p.ts:160` (`"eiäöüy".includes(nx2)`): the bare word `ch` reaches it and reads [ç]; the rule says ç only
  before a front vowel. Reachable only from crafted input.
- Czech `g2p.ts:71` (`"bpvf".includes(prev)`, `prev = c[i-1] ?? ""`): a word-initial ⟨ě⟩ (`ěd`) reaches it and gets
  the post-labial j-glide. Not Czech orthography; reachable only from crafted input.
- Norwegian `norwegian.ts:102`: `phonemizeWordRules("d")` returned `""` — the one-letter ⟨d⟩ is "after l/n/r" and
  deleted. The public path spells a lone letter first, so only the rules entry point shows it.
- German `g2p.ts:365`: `geh` → *ɡeːh*, `vergeh` → *…ɡəh* (the `nx !== undefined` guard is dead; `nx` is `""`).
- Swahili `kabw` → *kˈaɓʷ*; Yoruba `bw` → *bʷ*-shaped (the ⟨w⟩ deleted into labialization).

**Implication:** fix the real ones (dutch :281, german :365 and :160, czech :71, norwegian :102, swahili :81, yoruba
:17, slovenian :108); rewrite the neutral inline ones so the shape is gone and a source guard can forbid it; keep
the zero-linker `startsWith` (intended).

## Run 4 — 2026-10-09 (time approximate)

**Command:** `npx tsx .scratch/dump_fleurs.mts sw yo sl sv nb lv tl ceb nl de af da cs fr id ky ro th pt pt-BR ig gl en`
before and after the fix (43,038 rows each), diffed row by row; `npm run check:goldens`.

**Question:** how many readings move, and are the moved ones better?

**Finding:** 25 FLEURS rows move, in three languages; every other language in the list is byte-identical.

| lang | rows | what moved |
|---|---|---|
| nl | 20 | word-final ⟨c⟩ [s] → [k]. 14 are word reads that are now right (a surname in -ic, `Inc` ×2, English -ic adjectives ×5, a biblical name, OPEC, and two compounds the splitter cuts after ⟨c⟩ — trac·toren, struc·turen — where ⟨c⟩ precedes ⟨t⟩ in the word). 5 are initialisms read as words (`plc`, `pc`, `IOC`, `FIC`, `USOC`): wrong before and after, the initialism path is a separate defect. 1 is a bare letter ⟨c⟩: [s] → [k], wrong both ways (the letter name is [seː]). |
| sw | 4 | a title abbreviation and an English state initialism, both ending consonant+⟨w⟩: *ɓʷ* → *ɓw*, *n̩sʷ* → *n̩sw*. Neither reading expands the abbreviation (normalization's job, not this rule's); the new one at least keeps the letter the writer typed. |
| yo | 1 | the same English initialism: *sʷ* → *sw*. |

Slovenian (23 FLEURS hits), German :365 (33 hits) and Swedish (5,046 hits) move nothing on real text. `check:goldens`:
`nl 200 rows 3 stale`, all three the same duplicated OPEC sentence (*ˈoːpəs* → *ˈoːpək*); every other golden
clean. The Slovenian and German moves need words real text did not contain.

**Implication:** regenerate `nl` only (`npx tsx tools/gen_parity_goldens.mts nl` → 3 rows). The 5 initialism rows and
the bare-letter row stay wrong for a reason that is not this bug — noted, not chased.

## Run 5 — 2026-10-09 (time approximate)

**Command:** `python3 .scratch/revert_proof.py <file>…` — swap each fixed TS file back to `origin/main`, run
`test/includes-empty.test.ts`, restore. Then the same for the C# files at once (`revert_proof_cs.py`).

**Question:** does every new test fail when its fix is reverted?

**Finding (TS):** each revert fails its own behaviour test, and the source guard fails for every file whose old
version held the inline shape (dutch, german, norwegian, swahili, slovenian, tagalog). One NEGATIVE: the first
Slovenian right-edge example (`vr` + `država`) passed on the reverted code. The old count was 0, the rule fell
through to the penultimate fallback, and `država`'s own stress is penultimate, so the two coincided. Replaced
by `vr` + `babicami` (suffix stress on the FIRST nucleus), which fails on revert.

**Finding (C#):** the port had reproduced the TS bug ON PURPOSE at most sites — Swahili's comment said "NO
`i + 1 < n` GUARD, AND THAT IS THE POINT", Swedish's "do not fix it into an out-of-range guard", the German `ch`
line "empty nx2 → true, as in JS". .NET `string.Contains("")` is true, so `Contains(string)` mirrors the JS bug
exactly. The one DIFFERENT bug: Slovenian `CountNuclei` used `Contains(char)` with explicit bounds, so the port
treated the slice edge as NOT a vowel where the TS treated it as one — the two disagreed on any word-edge ⟨r⟩
and no golden noticed (2 golden hits, 0 rows moved). The C# reading was right at the word's left edge but
wrong at a prefix's right edge before a vowel-initial suffix (`vr` + `abeceda`: the slice says syllabic ⟨r⟩,
the word says onset). Both ports now count in whole-word context. Reverting the C# files fails 7 of 9 C#
tests; the 2 that pass are exactly the Slovenian cases the C# never got wrong.

**Implication:** the guard test forbids only the INLINE shape — the indirect shapes (variable, predicate) are
not greppable without types and were found by the runtime probe; the test header says so.

## Run 6 — 2026-10-09 (time approximate)

**Command:** the gates, one at a time, on the final tree: `npm run check:goldens`; `npx vitest run`;
`dotnet test` (whole solution, no filter); `dotnet run -c Release --project csharp/tools/parity` (all goldens).

**Question:** is the tree green?

**Finding:**
- `check:goldens`: 189 languages, 36,495 rows, 0 stale.
- `vitest`: 6,514 passed, 7 failed, all seven in `test/check-goldens-jobs.test.ts`, with `status -1`. That test
  spawns `node_modules/.bin/tsx` by path, and this worktree has no `node_modules/.bin`. With `.bin` symlinked
  to the main checkout's, the file passes 9/9 — environmental, not this change. Symlink removed afterwards.
- `dotnet test`: 7,187 passed, 0 failed.
- C# parity: 189 languages byte-identical, 36,495 rows, 0 differ.
- No regex literal changed in `src/`, so `csharp/regex-corpus.jsonl` needs no re-extract.

**Implication:** done, with these left open: the Dutch/Swahili/Yoruba initialisms read as words (separate
defect); Danish `danish.ts:104` has the indirect shape but no input reached it; `wu.ts:81` belongs to the
Sinitic work and is allowlisted in the guard; the guard sees only the inline shape.

## Run 7 — 2026-10-09 22:20

**Question.** Does real text reach wu's allowlisted site, `VOWEL.includes(body[1] ?? "")` in `wu.ts`'s
`syllableToIpa`, with a one-letter body (`y`/`w`), and does anything read differently once it is guarded?

**Command.** A Python census (session scratchpad, `wu_site.py`): every reading syllable in `wu/dict.tsv`, split
into body + tone exactly as `syllableToIpa`'s `/^([a-z]+?)([0-9])?$/i` does, and every raw Wugniu-shaped token in
the wuu golden + mined text. Then the fix, `npm run check:goldens`, and C# parity on wuu.

**Finding.**

    dict reading syllables   224,129 (555 distinct bodies) — one-letter y/w bodies: 0
    raw Wugniu tokens        3 in 1,405 golden + mined texts — one-letter y/w bodies: 0
    check:goldens            0 stale · C# parity wuu 200/200

And by reading: a body `y` never reaches the test, because `y` is a whole-body final and returns first; a body
`w` passes it, but the remainder is `""`, which no final keys, so it falls through to the same place. The defect is
INERT in output. The C# copy carried the same bug, with a comment noting it was reproduced on purpose
(`VOWEL.Contains("")` is true in .NET too).

**Implication.** Fixed in both ports as a predicate, `glideOnset` / `GlideOnset`, that requires the second letter
to exist. Nothing reads differently, so the predicate is what the tests pin (TS and C#; both fail on revert, and
so does the source scan). wu's allowlist entry is removed, so the scan now covers every file in `src/`, with no
exceptions left. No golden moves.
