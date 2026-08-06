# Corpus / wordlist tooling

Reusable builders for the language data a bring-up needs, so we stop hand-rolling throwaway `/tmp` scrapers.
With the hard-won lesson baked in:

> **Batch + cache; dumps ≫ sequential live API.** The MediaWiki API rate-limits and paginates; one request per
> word is minutes of round-trips. Use the API's batch/generator forms (or a dump), and cache every response so a
> re-run — or `--no-network` — is instant and reproducible.

## `build-referee.ts` — Wiktionary word→IPA referee

Builds the `word<TAB>IPA` referee that `tools/referee-eval` grades against, from en.wiktionary's
`Category:<Lang> terms with IPA pronunciation`. Uses the MediaWiki **generator** to fetch 50 pages' wikitext per
request (ki's 1062 words → ~22 round-trips, ~11s; the naive per-word scraper was minutes at ~57% coverage), and
caches each batch under `.cache/<lang>/`.

```sh
npx tsx tools/corpus/build-referee.ts --lang ki                 # → referees/ki.wiktionary-ki.tsv
npx tsx tools/corpus/build-referee.ts --lang mos --wnl Moore    # Wiktionary section name ≠ our label
npx tsx tools/corpus/build-referee.ts --lang ki --no-network    # rebuild from cache only
```

Extend the `WNL` / `CODE` maps in the file when a language's Wiktionary section name or `{{IPA|code}}` differs from
a naive capitalisation of our code. See the file header for all flags.

`.cache/` is regeneratable and git-ignored.
