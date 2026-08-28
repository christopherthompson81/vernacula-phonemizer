# ak: the literal ⟨ŋ⟩, its dead rule, and what the fold was doing for it (#1139)

## Run 1 — 2026-08-28 — reproduce, and find out what the letter is worth

**Question.** #1139 says `akan.ts`'s `if (c === "ŋ")` rule — a deliberate, kaikki-sourced passthrough — is
dead on the shipped path because `NATIVE_CLASS` excludes the letter, so `makeNativiser` folds ŋ→n first.
Does it reproduce, and is adding ⟨ŋ⟩ to the class the right fix?

Every ⟨ŋ⟩ input was byte-identical to its ⟨n⟩ fold target:

    ŋa    na          aŋa   ana         dwoŋ  d͡ʑʷon      ŋs    ns
    ŋk    ŋk          ŋp    mp          ŋb    mm          ŋm    mm

⚠ Note the trap in that table. `ŋk` looks CORRECT — but only because after the fold the ⟨n⟩ hits the
place-assimilation rule and comes back velar by a completely different route. The letter is right in exactly
the positions that hide the bug, and wrong everywhere else.

### The letter is ×0 in everything this repo ships for ak

    csharp/goldens/ak.tsv input column   0
    tools/corpus/mined/ak.jsonc          0
    tools/corpus/attest/ak.jsonc         0
    data/languages/akan/akan-tone.tsv    0
    data/languages/akan/akan.jsonc       3 lines — all as an IPA **value** (ŋ, ŋʷ), never as a key

So no lexicon key carries it and `test/lexicon-reachability.test.ts` is unaffected. And ⟨ŋ⟩ is **not standard
Akan spelling**: the orthography writes /ŋ/ as ⟨ng⟩, /ŋʷ/ as ⟨nw⟩, and otherwise lets coda ⟨n⟩ assimilate.

That makes this the same fork #1132 had — make the rule reachable, or delete the dead rule — with the
evidence pointing the *opposite* way from #1131's Luganda case, where the letter WAS in the language's own
corpus and the sources called the contrast phonemic. Worth stating plainly: **my own issue text assumed the
fix was "add it to the class", and that assumption deserved testing rather than executing.**

### What decided it: the letter denotes a phoneme Akan actually has

Akan's inventory contains /ŋ/ and /ŋʷ/ — they are what ⟨ng⟩ and ⟨nw⟩ spell. So passing ⟨ŋ⟩ through emits a
segment the language owns, at the place the writer explicitly specified, whereas the fold emits [n]: the
wrong place, and an override of an explicit letter. Deleting the rule would keep a wrong-place reading in
order to preserve a spelling convention the writer had already declined to use. So: **admit the letter.**

### ⚠ But the fold was doing a SECOND job silently — the #1131 trap, again

This is the part the issue did not anticipate. Folded to ⟨n⟩, the letter **reached the digraph table**:

    ŋwa  → (nwa) → ŋʷa      the ⟨nw⟩ row — the signature Akan labialisation
    ŋgu  → (ngu) → ŋu       the ⟨ng⟩ row
    ŋy   → (ny)  → ɲ        the ⟨ny⟩ row

### ⚠ And CONSERVING those readings was wrong — a dead end worth keeping

My first pass added `"ŋw": "ŋʷ"` and `"ŋg": "ŋ"` rows, reasoning straight from #1131: *giving a letter its
own rule must not silently take away what the fold was supplying.* Review caught that the conservation was
incomplete — ⟨ny⟩ is the **third** ⟨n⟩-initial digraph and ⟨ŋy⟩ had regressed from `ɲ` to `ŋj`, contradicting
an invariant the diff asserted in three places.

The fix was not to add the third row. It was to notice that **the rule had to skip the case that disproves
it**:

  * `"ŋy": "ɲ"` would turn an explicitly **velar** nasal into a **palatal** one. Actively wrong.
  * `"ŋg": "ŋ"` **deletes the ⟨g⟩ the writer typed** — `⟨Ŋgozi⟩` read *ŋozi*. `akan.ts`'s own `latinPhone`
    fallback exists precisely to refuse that ("a letter this g2p has no rule for still denotes a sound, and
    dropping it deletes content the writer typed"), and the ⟨ŋp⟩ divergence is justified by the same
    principle. The diff was arguing both sides at once and only one can hold.

**The principle that does hold:** the three ⟨n⟩-digraphs exist because ⟨n⟩ is orthographically AMBIGUOUS —
in ⟨nw ng ny⟩ the ⟨n⟩ is not /n/ at all, the pair is one unit. A writer who types the literal ⟨ŋ⟩ has
**already disambiguated**, so the letter is read literally and enters none of them. Both conserving rows were
removed; ⟨ŋw⟩ → ŋw, ⟨ŋg⟩ → ŋɡ, ⟨ŋy⟩ → ŋj, and `⟨Ŋgozi⟩` → *ŋɡozi* with the /ɡ/ intact. The standard
⟨nw ng ny⟩ rows are untouched and still carry the orthography.

**The same principle covers the assimilation case,** which is why there is now one rule rather than a rule
plus an exception: ⟨n⟩ is the UNDERSPECIFIED nasal and takes a following consonant's place (⟨np⟩ → *mp*),
while ⟨ŋ⟩ states velar place explicitly (⟨ŋp⟩ → *ŋp*). **An explicit letter is never overridden and never
deleted** — that one sentence generates every row above.

⚠ Worth naming the failure mode for next time: I applied #1131's conservation lesson as a *rule* instead of
as a *question*. "What was the fold supplying?" is the question; "therefore conserve it" is not the answer.
Here the fold was supplying readings that were only ever right for the ambiguous spelling.

Final table:

| input | before | after | |
|---|---|---|---|
| `ŋa` | `na` | **`ŋa`** | the filed defect |
| `aŋa` | `ana` | **`aŋa`** | |
| `dwoŋ` | `d͡ʑʷon` | **`d͡ʑʷoŋ`** | word-final |
| `Ŋa` | — | **`ŋa`** | the class flags are `"u"`, so both cases are listed |
| `ŋw` | `ŋʷ` | **`ŋw`** | literal — no digraph |
| `ŋg` | `ŋ` | **`ŋɡ`** | literal — the typed ⟨g⟩ survives |
| `ŋy` | `ɲ` | **`ŋj`** | literal — a velar is not made palatal |
| `Ŋgozi` | `ŋozi` | **`ŋɡozi`** | the case that decided it |
| `ŋk` | `ŋk` | `ŋk` | agreed before and after |
| `ŋp` | `mp` | **`ŋp`** | explicit place is not reassigned |
| `nw` / `ng` / `ny` | `ŋʷ` / `ŋ` / `ɲ` | unchanged | the standard spellings carry the orthography |

## Gates

    goldens        0 rows changed fleet-wide (⟨ŋ⟩ is ×0 in every golden input column)
    parity fleet   136 languages, 26,827 rows, 0 differ
    differential   398 lines × sync AND async = 796 comparisons, 0 differ, 0 throws, 0 PortPending
    TS suite       5,685 passed      dotnet test  2,703 passed      tsc + fence clean

⚠ **ak has no FLEURS split**, so PORTING.md's corpus-wide differential does not exist for this language and
the probes carry it. And since ⟨ŋ⟩ is ×0 in the corpus, **15 of the 398 lines are the probes I added** — the
796-comparison result says the change moved nothing it should not have, and the 5 vitest + 8 xunit cases are
the only thing measuring what it should. The C# needed one line (`NativeClass`); the two digraph rows came
free through the shared `data/` tree.
