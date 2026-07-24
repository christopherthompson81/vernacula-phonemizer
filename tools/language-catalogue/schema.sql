-- Language catalogue for vernacula-phonemizer.
--
-- One row per language / lect we have considered. The point is to STOP re-deriving the same scope + data-
-- availability verdicts: every language we implement, reject, or defer is recorded here with WHY, plus the
-- phonological-referee material we found (so we don't re-probe wikipron/kaikki/epitran each time).
--
-- Source of truth is catalogue.tsv (diffable); build.py regenerates languages.db from this schema + that TSV.

DROP TABLE IF EXISTS languages;

CREATE TABLE languages (
    code             TEXT PRIMARY KEY,          -- our code / ISO 639-3 (e.g. 'hi', 'ckb', 'arq', 'es-419')
    name             TEXT NOT NULL,
    family           TEXT,                      -- family / branch (e.g. 'Indo-Aryan', 'Semitic (Arabic)', 'Sinitic')
    script           TEXT,                      -- primary writing system

    -- Estimated speaker populations, in absolute numbers. L1 = native, L2 = second-language. NULL = unknown
    -- (fill incrementally); 0 = genuinely ~none (e.g. MSA has ~no L1 speakers).
    l1_speakers      INTEGER,
    l2_speakers      INTEGER,

    -- Presence / size of relevant phonological material (independent referees). For the count columns: a positive
    -- integer = # entries found, 0 = confirmed ABSENT, NULL = not yet probed. For the flag columns: 1 = exists,
    -- 0 = confirmed none, NULL = unknown.
    wikipron_entries INTEGER,                   -- wikipron <iso>_*_broad entry count
    kaikki_entries   INTEGER,                   -- kaikki (Wiktionary) IPA entry count
    epitran          INTEGER,                   -- 1 = an epitran mapping exists
    espeak           INTEGER,                   -- 1 = espeak-ng ships a voice (legacy reference only)
    fleurs           INTEGER,                   -- 1 = in the FLEURS-102 speech benchmark, 0 = not, NULL = unknown

    -- The disposition.
    decision         TEXT NOT NULL
                       CHECK (decision IN ('implemented','rejected','unimplemented')),

    -- WHY a language is rejected, or the provisional blocker for an unimplemented one. NULL for implemented.
    rejection_reason TEXT
                       CHECK (rejection_reason IS NULL OR rejection_reason IN (
                           'unsuitable orthography',                    -- no community-adopted standard script
                           'macrolanguage umbrella',                    -- a cover term, not a single phonology
                           'spoken-only',                               -- no established written tradition
                           'data scarcity',                             -- no independent referee to verify against
                           'variant without sufficient vowel-encoding'  -- an abjad/variant that under-writes vowels
                       )),

    verdict          TEXT,                      -- for implemented rows: maturity ✅ 🟢 🟡 🔷 ⛔ (else NULL)

    -- If this language is served by ANOTHER language's engine as a labelled approximation (rather than a bespoke
    -- module), the code of that sibling — e.g. Magahi (mag) served_by 'bho'. NULL = its own bespoke module (or
    -- not implemented). An aliased row is still `decision='implemented'` (the code works) but carries no verdict.
    served_by        TEXT REFERENCES languages(code),

    pr               TEXT,                      -- PR / commit reference
    notes            TEXT,

    -- An implemented row carries no rejection reason; a rejected row must state one.
    CHECK (decision != 'implemented' OR rejection_reason IS NULL),
    CHECK (decision != 'rejected'    OR rejection_reason IS NOT NULL)
);

CREATE INDEX idx_decision ON languages(decision);
CREATE INDEX idx_reason   ON languages(rejection_reason);
CREATE INDEX idx_family   ON languages(family);
