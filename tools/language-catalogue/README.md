# Language catalogue

A queryable record of every language we've **implemented**, **rejected**, or left **unimplemented** — with *why*,
plus the phonological-referee material we found for each. The point is to **stop re-deriving the same scope and
data-availability verdicts** every time we pick the next language.

## Files

- **`schema.sql`** — the table definition (one table, `languages`).
- **`catalogue.tsv`** — the diffable **source of truth** (edit this, or `gen-seed.py`, to change data).
- **`build.py`** — rebuilds `languages.db` from `schema.sql` + `catalogue.tsv`.
- **`gen-seed.py`** — regenerates `catalogue.tsv` from inline data blocks (the bootstrap/bulk-edit aid).
- **`derive-normalization.py`** — recomputes the `normalization` column from the repo. Run it after treating a
  language; `--check` reports what it would write without touching the file.
- **`languages.db`** — the built SQLite database (committed for immediate querying).

## Schema (columns)

| column | meaning |
|---|---|
| `code` | our code / ISO 639-3 (`hi`, `ckb`, `arq`, `es-419`) |
| `name`, `family`, `script` | descriptive |
| `l1_speakers`, `l2_speakers` | estimated speakers, **absolute** (NULL = unknown, 0 = ~none e.g. MSA) |
| `wikipron_entries`, `kaikki_entries` | referee size: count if probed, 0 = confirmed absent, NULL = not probed |
| `epitran`, `espeak` | 1 = exists, 0 = none, NULL = unknown |
| `fleurs` | 1 = in the **FLEURS-102** speech benchmark, 0 = not (NULL = unknown) |
| `decision` | `implemented` \| `rejected` \| `unimplemented` |
| `rejection_reason` | one of the fixed set below (NULL for implemented) |
| `verdict` | for implemented rows: maturity `✅ 🟢 🟡 🔷 ⛔ 🔵`. May carry TWO glyphs when both apply. NULL only for an aliased row. |
| `normalization` | `done` \| `partial` \| `inherited` \| empty — whether the symbols a reader says aloud are read. **Derived**, see below |
| `pr`, `notes` | provenance / free text |

**`rejection_reason`** is an enforced enum: `unsuitable orthography`, `macrolanguage umbrella`, `spoken-only`,
`data scarcity`, `variant without sufficient vowel-encoding`. A `rejected` row **must** have one; an `implemented`
row **must not**; an `unimplemented` row **may** carry one as a provisional blocker (e.g. Algerian Arabic →
`data scarcity`). The CHECK constraints enforce this.

**`served_by`** records when a language is `implemented` as a **labelled approximation on another language's
engine** rather than a bespoke module (e.g. `mag` served_by `bho`).

## Policy: shared-engine families (the Hindi belt, etc.)

Several families share one engine + a thin per-language delta (the Hindi-belt languages are all `makeNativeHindi` +
a small data file). The Hindi engine alone already reproduces a bespoke belt module ~86–90% on Devanagari text —
the deltas are small (Bhojpuri श→s + diphthongs = 13.5%; Chhattisgarhi 9.6%; Awadhi 13.7%; Maithili is the outlier
at 45%). This does **not** mean "just tell users to use Hindi": that degrades to Hindi on exactly the distinctive
features, mislabels TTS training audio, and — for recognised languages (Maithili is 8th-Schedule; Bhojpuri/Magahi
have active recognition movements) — erases identity the way the 1961 census did. So the policy is:

| the language has… | ship |
|---|---|
| a **verifiable or documented** delta (referee, or a real grammar: Shukla/Saksena/Kavyopadhyaya) | a **bespoke** module (`bho`, `awa`, `hne`, `mai`) |
| **no defensible** Magahi-specific delta + no referee | an **alias to the nearest verified sibling** (`served_by`), labelled — never an invented bespoke clone |

Keep every belt language a **first-class code** (discoverability + dignity); tier the *implementation* by what we
can defend. Reserve the "accent variant" mechanism (`en-GB`, `es-419`, `pt-BR`) for genuine single-language regional
variation, **not** for distinct belt languages.

## Query

```sh
# What should we build next? Top unimplemented by native speakers, with any blocker.
sqlite3 -header -column languages.db "
  SELECT code, name, family, l1_speakers/1000000 AS l1_m,
         COALESCE(rejection_reason,'(buildable)') AS blocker
  FROM languages WHERE decision='unimplemented' ORDER BY l1_speakers DESC LIMIT 15;"

# Why did we NOT do X?
sqlite3 languages.db "SELECT decision, rejection_reason, notes FROM languages WHERE code='ctg';"

# Everything blocked by data scarcity (revisit when a referee appears).
sqlite3 languages.db "SELECT code,name FROM languages WHERE rejection_reason='data scarcity';"

# Coverage summary.
sqlite3 -header -column languages.db "SELECT decision, COUNT(*) FROM languages GROUP BY decision;"

# FLEURS-102 coverage: which benchmark languages are still unbuilt (top build targets by speakers)?
sqlite3 -header -column languages.db "
  SELECT code, name, l1_speakers/1000000 AS l1_m,
         COALESCE(rejection_reason,'(buildable)') AS blocker
  FROM languages WHERE fleurs=1 AND decision!='implemented' ORDER BY l1_speakers DESC;"
```

## Update workflow

1. Edit **`catalogue.tsv`** (or the blocks in `gen-seed.py`, then `python3 gen-seed.py`).
2. `python3 build.py` to rebuild `languages.db`.
3. Commit both `catalogue.tsv` and `languages.db`.

When a language is implemented, flip its `decision` to `implemented`, set the `verdict` + `pr`, and clear
`rejection_reason`. When a probe finds (or rules out) a referee, fill `wikipron_entries` / `kaikki_entries` /
`epitran` so we never re-probe.

> Populations are **estimates** (Ethnologue-style, rough); referee columns are filled **incrementally** as probed —
> a NULL means "not yet checked", not "absent".

## Planning the next normalization

`normalization` is a **separate axis from `verdict`**: a language can phonemize its words excellently and still
drop every percent sign, currency symbol and date range. Empty is the planning signal.

```sql
-- implemented, no normalization layer, biggest audience first
SELECT code, name, script,
       (COALESCE(l1_speakers,0)+COALESCE(l2_speakers,0))/1000000 AS m_speakers,
       verdict, fleurs
FROM languages
WHERE decision='implemented' AND normalization IS NULL
ORDER BY (COALESCE(l1_speakers,0)+COALESCE(l2_speakers,0)) DESC
LIMIT 20;
```

```
python3 derive-normalization.py && python3 build.py   # refresh after treating a language
sqlite3 -column -header languages.db < the query above
```

### ⚠ The column is DERIVED, and it has to be

A hand-kept column goes stale the moment a language is treated, and this one is only worth planning from if it is
true. `derive-normalization.py` computes it from the two things that decide the answer: whether the engine
directory has a `normalize.ts`, and whether the engine **calls** it. Those come apart in practice — `review.ts`
checks them separately for that reason — so `partial` is a real state rather than being rounded up to `done`.

⚠ **Delegation is followed, and it had to be.** 26 directories are wrappers with no `normalize.ts` of their own:
`spanish-419` calls `createSpanish`, six Hindi-belt languages (Awadhi, Bhojpuri, Chhattisgarhi, Magahi, Maithili,
Rangpuri) call the Hindi factory, four Sinitic lects call `sinitic`. Counting a missing file as a missing layer put
**Latin-American Spanish — 420 million speakers — at the head of this query**, when its normalization had been
running the whole time through the Spanish engine. The test is that the wrapper imports from another directory
*and calls something it imported*; an import alone is not enough, since a wrapper may borrow only a vowel table.

⚠ **A directory's own layer outranks `served_by`.** Testing `served_by` first got two rows wrong: `af` carries
`served_by='native'` — a sentinel, not a language code — and Afrikaans has its own normalizer; `zsm` points at
`id` but resolves to the `malay` directory, which has its own.

⚠ **`done` may mean a SHARED layer.** Four directories serve sixteen codes — `arabic` alone serves ten dialect
codes — so `done` says a normalizer *runs* for this code, not that one was written for it specifically. Whether a
shared layer is right for each dialect is the same question `served_by` exists to record.

⚠ **And `done` does not mean the review gate is clean.** It means a layer runs. `npx tsx
tools/normalization/review.ts --lang <code>` is what says whether that layer has outstanding defects, and
`tools/normalization/coverage.ts` gives the fleet matrix.

Current state: **91 done, 17 inherited, 83 implemented-but-unnormalized** (105 rows carry no layer, but 21 of
those are `rejected`/`unimplemented` and are not candidates — the planning query filters on
`decision='implemented'`, so 84 is the number to plan from).

⚠ **Re-derive before reading this line, not after.** The six most recent normalization layers — `jv`, `wuu`,
`nan`, `cjy`, `hak`, `ln` — all landed with the column still blank, so the planning query was offering
languages that had already been treated. `derive-normalization.py` is cheap and the column is only worth
planning from if it was regenerated more recently than the last merge.
