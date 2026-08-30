from pathlib import Path
p=Path('tournament.html')
s=p.read_text()
s=s.replace('return entry[1] && entry[1].gameAdjustDateId===dateId && (!type || entry[1].type===type);','return entry[1] && String(entry[1].gameAdjustDateId||"")===String(dateId||"") && (!type || entry[1].type===type);')
s=s.replace('var date = _gameAdjustDates.find(function(item){return item.id===dateId;});','var date = _gameAdjustDates.find(function(item){return String(item&&item.id||"")===String(dateId||"");});')
s=s.replace('(group.id===_activeGameAdjustDateId?\' active\':\'\')','(String(group.id)===String(_activeGameAdjustDateId)?\' active\':\'\')')
s=s.replace('meta name="app-version" content="20260830-8"','meta name="app-version" content="20260830-9"')
p.write_text(s)
for f in ['index.html','sw.js','package.json']:
    q=Path(f); t=q.read_text(); t=t.replace('20260830-8','20260830-9').replace('20260830.8.0','20260830.9.0'); q.write_text(t)
# strengthen regression test
q=Path('scripts/tournament-game-adjust-sync.test.mjs')
t=q.read_text()
needle="  'TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view===\"results\"'\n"
if needle in t:
    t=t.replace(needle, needle.rstrip('\n')+",\n  'String(item&&item.id||\"\")===String(dateId||\"\")',\n  'String(entry[1].gameAdjustDateId||\"\")===String(dateId||\"\")'\n")
q.write_text(t)
