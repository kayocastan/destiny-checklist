"""Exporta o SQLite do bot antigo (Python) para SQL do D1 `orla`.

Uso:  python scripts/export-legacy.py caminho/orla.sqlite3 > legacy-import.sql
      npx wrangler d1 execute orla --remote --file legacy-import.sql

Converte datas para ISO UTC e ids do Discord para texto. O catálogo (curated/bungie_activities)
já vem da migração 0002, então só users, activities, participantes e player_activities são copiados.
"""
import sqlite3
import sys


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def iso(v):
    if v is None:
        return None
    s = str(v).replace(" ", "T")
    return s if s.endswith("Z") or "+" in s[10:] else s + "Z"


db = sqlite3.connect(sys.argv[1])
out = ["PRAGMA defer_foreign_keys = ON;"]
for r in db.execute("SELECT discord_user_id, discord_member_name, bungie_membership_id, bungie_membership_type, bungie_name FROM users"):
    out.append(f"INSERT OR REPLACE INTO users (discord_user_id, discord_member_name, bungie_membership_id, bungie_membership_type, bungie_name, linked_at) VALUES ({q(str(r[0]))},{q(r[1])},{q(r[2])},{r[3]},{q(r[4])},'');")
for r in db.execute("SELECT id, name, curated_bungie_activity_id, capacity, rookie_limit, starts_at, description, created_by_discord_id, created_at, discord_channel_id, discord_message_id FROM activities"):
    cols = [r[0], q(r[1]), q(r[2]), r[3], q(r[4]), q(iso(r[5])), q(r[6]), q(str(r[7])), q(iso(r[8])), q(None if r[9] is None else str(r[9])), q(None if r[10] is None else str(r[10]))]
    out.append("INSERT OR REPLACE INTO activities (id, name, curated_bungie_activity_id, capacity, rookie_limit, starts_at, description, created_by_discord_id, created_at, discord_channel_id, discord_message_id) VALUES (" + ",".join(str(c) for c in cols) + ");")
for r in db.execute("SELECT id, activity_id, discord_user_id, category, is_rookie, created_at FROM activity_participants"):
    out.append(f"INSERT OR REPLACE INTO activity_participants (id, activity_id, discord_user_id, category, is_rookie, created_at) VALUES ({r[0]},{r[1]},{q(str(r[2]))},{q(r[3])},{q(r[4])},{q(iso(r[5]))});")
for r in db.execute("SELECT user_discord_id, activity_bungie_id, clear_count, skill, checked_at FROM player_activities"):
    out.append(f"INSERT OR REPLACE INTO player_activities (user_discord_id, activity_bungie_id, clear_count, skill, checked_at) VALUES ({q(str(r[0]))},{r[1]},{r[2]},{q(r[3])},{q(iso(r[4]))});")
print("\n".join(out))
