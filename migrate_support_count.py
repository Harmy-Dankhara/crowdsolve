"""
Migration script: adds support_count column to the issues table if it doesn't exist.
Safe to run multiple times.
"""
import sqlite3

conn = sqlite3.connect("crowdsolve.db")
cur = conn.cursor()

cols = [row[1] for row in cur.execute("PRAGMA table_info(issues)").fetchall()]
if "support_count" not in cols:
    cur.execute("ALTER TABLE issues ADD COLUMN support_count INTEGER DEFAULT 0")
    conn.commit()
    print("Migration applied: support_count column added.")
else:
    print("Already up-to-date: support_count column exists.")

conn.close()
