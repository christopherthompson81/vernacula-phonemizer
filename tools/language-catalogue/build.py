#!/usr/bin/env python3
"""Build languages.db from schema.sql + catalogue.tsv (the diffable source of truth).

    python3 build.py            # rebuild languages.db
    sqlite3 languages.db 'SELECT code,name,decision,rejection_reason FROM languages WHERE decision!="implemented"'

catalogue.tsv is authoritative; regenerate it from the inline data blocks with `python3 gen-seed.py`.
"""
import csv, os, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB   = os.path.join(HERE, "languages.db")

INT_COLS = {"l1_speakers","l2_speakers","wikipron_entries","kaikki_entries","epitran","espeak","fleurs"}

def main():
    with open(os.path.join(HERE,"schema.sql")) as f:
        schema = f.read()
    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
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
    print(f"built {DB}: {tot} rows  ({', '.join(f'{k}={v}' for k,v in sorted(by.items()))})")

if __name__ == "__main__":
    main()
