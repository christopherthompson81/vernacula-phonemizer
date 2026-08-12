#!/usr/bin/env python3
"""Build languages.db from schema.sql + catalogue.tsv (the diffable source of truth).

    python3 build.py            # rebuild languages.db
    python3 build.py --check    # is the COMMITTED db in sync with the tsv? change nothing
    sqlite3 languages.db 'SELECT code,name,decision,rejection_reason FROM languages WHERE decision!="implemented"'

catalogue.tsv is authoritative; regenerate it from the inline data blocks with `python3 gen-seed.py`.

⚠ `--check` EXISTS BECAUSE THE DB IS A COMMITTED BUILD ARTIFACT and the two-step (edit tsv → run build.py)
is exactly the kind of thing that gets half-done. It builds into a temp file and compares ROW CONTENT — not
bytes, which would make the check hostage to sqlite's page layout — and exits non-zero on any divergence, so
a test or a pre-merge script can gate it.
"""
import csv, os, sqlite3, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DB   = os.path.join(HERE, "languages.db")

INT_COLS = {"l1_speakers","l2_speakers","wikipron_entries","kaikki_entries","epitran","espeak","fleurs"}

def rows_of(path):
    """Every row, every column, ordered — the comparable content of a built db."""
    con = sqlite3.connect(path)
    cols = [r[1] for r in con.execute("PRAGMA table_info(languages)")]
    out = con.execute(f"SELECT {','.join(cols)} FROM languages ORDER BY code").fetchall()
    con.close()
    return cols, out


def build(db_path):
    with open(os.path.join(HERE,"schema.sql")) as f:
        schema = f.read()
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    # ⚠ FOREIGN KEYS ON. SQLite ignores REFERENCES by default, so `served_by` accepted anything — which is how
    # `served_by='native'`, not a language code, survived in the source of truth. With this the build FAILS on a
    # served_by that names no row, which is the only way a convention documented in a comment stays true.
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(schema)

    con.execute("BEGIN")            # one transaction, so the DEFERRED served_by check runs at COMMIT
    with open(os.path.join(HERE,"catalogue.tsv")) as f:
        reader = csv.DictReader(f, delimiter="\t")
        cols = reader.fieldnames
        n = 0
        for row in reader:
            vals = {}
            for c in cols:
                v = (row[c] or "").strip()
                if v == "":
                    vals[c] = None
                elif c in INT_COLS:
                    vals[c] = int(v)
                else:
                    vals[c] = v
            placeholders = ",".join(":"+c for c in cols)
            con.execute(f"INSERT INTO languages ({','.join(cols)}) VALUES ({placeholders})", vals)
            n += 1
    con.commit()

    tot = con.execute("SELECT COUNT(*) FROM languages").fetchone()[0]
    by = dict(con.execute("SELECT decision, COUNT(*) FROM languages GROUP BY decision").fetchall())
    con.close()
    return tot, by


def main():
    if "--check" in sys.argv:
        if not os.path.exists(DB):
            print(f"  MISSING {DB} — run `python3 build.py`")
            sys.exit(1)
        with tempfile.TemporaryDirectory() as td:
            fresh = os.path.join(td, "fresh.db")
            build(fresh)
            want_cols, want = rows_of(fresh)
            got_cols, got = rows_of(DB)
        if want_cols != got_cols:
            print(f"  STALE {DB}: columns differ — run `python3 build.py`")
            sys.exit(1)
        drift = [(w[0], c, g[i], w[i]) for w, g in zip(want, got) if w != g
                 for i, c in enumerate(want_cols) if w[i] != g[i]] if len(want) == len(got) else []
        if len(want) != len(got):
            print(f"  STALE {DB}: {len(got)} rows committed, {len(want)} in the tsv — run `python3 build.py`")
            sys.exit(1)
        if drift:
            for code, col, was, now in drift[:10]:
                print(f"  STALE {code}.{col}: db has {was!r}, tsv says {now!r}")
            print(f"  {len(drift)} cell(s) stale — run `python3 build.py`")
            sys.exit(1)
        print(f"  {DB} is in sync with catalogue.tsv ({len(got)} rows)")
        return
    tot, by = build(DB)
    print(f"built {DB}: {tot} rows  ({', '.join(f'{k}={v}' for k,v in sorted(by.items()))})")

if __name__ == "__main__":
    main()
