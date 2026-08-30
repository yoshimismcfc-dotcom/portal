from pathlib import Path

p=Path('tournament.html')
s=p.read_text()
old='#doc-youkou .guideline-content-input[type=date],#doc-taisen #t-date{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;inline-size:100%!important;min-inline-size:0!important;max-inline-size:100%!important;box-sizing:border-box!important;margin:0!important;overflow:hidden!important}'
new='#doc-youkou .guideline-content-input[type=date],#doc-taisen #t-date{display:block!important;width:calc(100% - 16px)!important;min-width:0!important;max-width:calc(100% - 16px)!important;inline-size:calc(100% - 16px)!important;min-inline-size:0!important;max-inline-size:calc(100% - 16px)!important;box-sizing:border-box!important;margin-left:8px!important;margin-right:8px!important;overflow:hidden!important}'
if old not in s:
    raise SystemExit('date css target not found')
s=s.replace(old,new,1)
s=s.replace('content="20260830-9"','content="20260830-10"',1)
p.write_text(s)

for file in ['index.html','sw.js','package.json']:
    q=Path(file)
    t=q.read_text()
    t=t.replace('20260830-9','20260830-10').replace('20260830.9.0','20260830.10.0')
    q.write_text(t)

# lightweight regression assertion
text=Path('tournament.html').read_text()
assert 'width:calc(100% - 16px)!important' in text
assert 'margin-left:8px!important;margin-right:8px!important' in text
