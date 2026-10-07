#!/usr/bin/env python3
"""Jediný spôsob, ako zvýšiť verziu Flow.

Použitie:
  python3 tools/bump_version.py 2.50.2 --title "Krátky názov" --note "Čo sa zmenilo" --note "Ďalšia zmena"

Skript:
  1. prepíše assets/js/version.js (číta ho aplikácia aj service worker),
  2. pridá záznam na začiatok assets/js/changelog.js (okno Changelog v aplikácii),
  3. pridá záznam na začiatok CHANGELOG.md.
"""
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JS = ROOT / 'assets/js/version.js'
CHANGELOG_JS = ROOT / 'assets/js/changelog.js'
CHANGELOG_MD = ROOT / 'CHANGELOG.md'

p = argparse.ArgumentParser()
p.add_argument('version')
p.add_argument('--title', default='')
p.add_argument('--note', action='append', default=[])
a = p.parse_args()

if not re.fullmatch(r'\d+\.\d+\.\d+', a.version):
    sys.exit('Verzia musí mať tvar X.Y.Z')
if not a.note:
    sys.exit('Pridaj aspoň jednu poznámku cez --note')

v = VERSION_JS.read_text(encoding='utf-8')
if not re.search(r"const APP_VERSION = '[^']*';", v):
    sys.exit('V version.js sa nenašiel riadok APP_VERSION')
VERSION_JS.write_text(re.sub(r"const APP_VERSION = '[^']*';", f"const APP_VERSION = '{a.version}';", v), encoding='utf-8')

js = CHANGELOG_JS.read_text(encoding='utf-8')
m = re.search(r'/\*ENTRIES\*/(.*?)/\*END\*/', js, flags=re.S)
if not m:
    sys.exit('V changelog.js chýbajú značky /*ENTRIES*/ ... /*END*/')
entries = json.loads(m.group(1))
if entries and entries[0]['version'] == a.version:
    entries.pop(0)  # opätovné spustenie pre tú istú verziu záznam nahradí
entry = {'version': a.version}
if a.title:
    entry['title'] = a.title
entry['items'] = a.note
entries.insert(0, entry)
CHANGELOG_JS.write_text(js[:m.start()] + '/*ENTRIES*/' + json.dumps(entries, ensure_ascii=False, indent=2) + '/*END*/' + js[m.end():], encoding='utf-8')

md = CHANGELOG_MD.read_text(encoding='utf-8')
md = re.sub(rf'## v{re.escape(a.version)}\b.*?(?=\n## v|\Z)', '', md, count=1, flags=re.S).lstrip('\n')
head = f"## v{a.version}" + (f" – {a.title}" if a.title else '')
section = head + '\n\n' + '\n'.join(f'- {n}' for n in a.note) + '\n\n'
if md.startswith('# Flow changelog'):
    first, rest = md.split('\n', 1)
    md = first + '\n\n' + section + rest.lstrip('\n')
else:
    md = '# Flow changelog\n\n' + section + md
CHANGELOG_MD.write_text(md, encoding='utf-8')
print(f'Verzia {a.version} zapísaná (version.js, changelog.js, CHANGELOG.md).')
