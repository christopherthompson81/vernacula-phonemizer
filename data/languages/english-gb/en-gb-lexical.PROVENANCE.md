# `en-gb-lexical.tsv` — provenance

**What it is.** British lexical variants: words where British and American English use a different word form,
not just a different accent of the same one (`aluminium`, `schedule`, `lieutenant`). Each row maps a word to
the citation, written in the parent's GenAm alphabet, that the en-GB accent delta starts from. An optional
third field names the parent reading the row may replace (used for `progress`/`progresses`, so the verb is
left alone).

**Hand-written, one row at a time.** Each row rests on one of three bases.

1. **Attested by the primary source.** The British reading is in the wikipron UK referee
   (`tools/referee-eval/referees/en-gb.wikipron-uk.tsv`). That referee comes from English Wiktionary's UK
   pronunciations, CC BY-SA 3.0. The row transcribes the attested reading into the parent alphabet.
2. **Attested by the second source.** `schedule`, `leisure` and `ballet` rest on a per-word human decision
   in espeak-ng's en-gb dictionary sources (GPL-3.0), which were read as plain files:
   - `en_list:1044–1045` `ballet` (the `?3` companion line moves the stress for General American);
   - `en_list:2407–2408` `leisure`;
   - `en_rules:5871` `?3 sch (ed → sk`.

   The espeak-ng binary was used only to search for candidates. A reading with no dictsource line behind it
   was refused. The shipped value is the parent's own CMUdict row with that one feature rewritten, and no
   espeak phoneme string is reproduced. This is the facts shape (`LICENSES/PROVENANCE.md` §1, and §5.1
   item 5 for the exact citations), not a GPL derivation.
3. **Entailed.** An inflection is the lemma's citation plus the suffix the parent dictionary itself
   produces for that form, so the suffix is the parent's (CMUdict-derived, public domain). Where the
   referee also lists the inflection, it was used as a check, not as the source.
   - The `sched-` family (`scheduler`, `unscheduled`, `reschedule`, …) is covered by the same `sch (ed`
     spelling rule as `schedule`. `reschedule` is also attested by the primary source.

| basis | rows |
|---|---|
| attested (primary) | aluminium, buoy, clerk, derby, figure, herb, lever, lieutenant, tomato, vitamin, process, progress; also confirmed in the referee: clerks, figures, leisurely, processed, processes, processing |
| attested (second source) | ballet, leisure, schedule |
| family of `schedule` | scheduler, schedulers, unscheduled, reschedule, rescheduled, rescheduling |
| entailed | ballets, leisured, scheduled, schedules, scheduling, progresses, buoyed, buoying, buoys, figured, figuring, herbs, levering, levers, lieutenants, tomatoes, vitamins |

**Licence.** The readings attested by the primary source are Wiktionary-derived (CC BY-SA 3.0), which puts
the file in the share-alike stratum with the other `english-gb/en-gb-*.tsv` tables (`LICENSES/PROVENANCE.md`
§3). The three second-source rows are facts, as above.

Build notes, the admission bar, and the rows deliberately left out: `docs/investigations/en-GB/en-gb-lexical_build_notes_investigation.md`.
