# Language catalogue

A queryable record of every language we've **implemented**, **rejected**, or left **unimplemented** — with *why*,
plus the phonological-referee material we found for each. The point is to **stop re-deriving the same scope and
data-availability verdicts** every time we pick the next language.

## Files

- **`schema.sql`** — the table definition (one table, `languages`).
- **`catalogue.tsv`** — the diffable **source of truth** (edit this, or `gen-seed.py`, to change data).
- **`build.py`** — rebuilds `languages.db` from `schema.sql` + `catalogue.tsv`.
- **`gen-seed.py`** — regenerates `catalogue.tsv` from inline data blocks (the bootstrap/bulk-edit aid).
- **`languages.db`** — the built SQLite database (committed for immediate querying).

## Schema (columns)

| column | meaning |
|---|---|
| `code` | our code / ISO 639-3 (`hi`, `ckb`, `arq`, `es-419`) |
| `name`, `family`, `script` | descriptive |
| `l1_speakers`, `l2_speakers` | estimated speakers, **absolute** (NULL = unknown, 0 = ~none e.g. MSA) |
| `wikipron_entries`, `kaikki_entries` | referee size: count if probed, 0 = confirmed absent, NULL = not probed |
| `epitran`, `espeak` | 1 = exists, 0 = none, NULL = unknown |
| `decision` | `implemented` \| `rejected` \| `unimplemented` |
| `rejection_reason` | one of the fixed set below (NULL for implemented) |
| `verdict` | for implemented rows: maturity `✅ 🟢 🟡 🔷 ⛔` |
| `pr`, `notes` | provenance / free text |

**`rejection_reason`** is an enforced enum: `unsuitable orthography`, `macrolanguage umbrella`, `spoken-only`,
`data scarcity`, `variant without sufficient vowel-encoding`. A `rejected` row **must** have one; an `implemented`
row **must not**; an `unimplemented` row **may** carry one as a provisional blocker (e.g. Algerian Arabic →
`data scarcity`). The CHECK constraints enforce this.

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
