# kaikki-pashto-sounds.jsonl — provenance

**Artifact:** `tools/pashto/kaikki-pashto-sounds.jsonl` — 1,200 entries, `{word, sounds[].{ipa,tags}}`.
Tools-only (not under `src/`, not loaded by the runtime). The source for the four tag-derived Pashto variety
referees.

## Source and licence

**kaikki.org** machine-readable Wiktionary extraction — `kaikki.org-dictionary-Pashto.jsonl`, fetched
2026-08-10. Derived from **English Wiktionary**, so **CC-BY-SA 3.0/4.0**, the same stratum as every other
wikipron/kaikki artifact in this repo (LICENSES/PROVENANCE.md §3).

## Why it is vendored, and why only in part

⚠ **kaikki.org REGENERATES its dumps.** The file at that URL will not be the same file next month — entries
and dialect tags change as Wiktionary does. Without a local copy the referees built from it are a snapshot
nobody can audit or reproduce, which is precisely how `ps.kaikki-kandahari.tsv` (95 hand-cut rows, source
gone) became unverifiable and had to be retired. The playbook states the rule directly: *an artifact that
cannot be regenerated from the repository is not really committed* (trap 32).

⚠ **But the full dump is 4.1 MB of material nothing here reads.** Definitions, etymologies, senses,
translations, forms and examples are all dropped; the extract keeps only the two fields
`build_kaikki_dialect_referees.py` consumes, plus the headword.

```
full dump   4.1 MB   1,646 entries
extract      92 KB   1,200 entries (those with any IPA)
```

Verified: all four referees rebuild from the extract **byte-identically** to the ones built from the full
dump. That equality is the evidence the extract is complete for its purpose — without it, "the same" is a
claim.

## What is built from it

`tools/pashto/build_kaikki_dialect_referees.py` (no arguments — defaults to this file) →

| referee | words | what it is |
|---|---:|---|
| `ps.kaikki-pbt-tagged.tsv` | 97 | Kandahar · Southern · Southwestern |
| `ps.kaikki-pbu-tagged.tsv` | 102 | Northern · Peshawar · Eastern · Northeastern · … |
| `ps.kaikki-pst-tagged.tsv` | 43 | Wazirwola · Central · Wardak · Southeastern |
| `ps.kaikki-untagged.tsv` | 1041 | ⚠ **not a variety referee** — no dialect tag |

Refreshing from upstream is deliberately a separate flag (`--extract`), because it changes the referees and
therefore the reported scores; it should be a decision, not a side effect of running the build.
