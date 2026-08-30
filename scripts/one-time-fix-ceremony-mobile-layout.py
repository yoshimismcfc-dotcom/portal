from pathlib import Path
import re, json

p=Path('tournament.html')
s=p.read_text(encoding='utf-8')
old='''      .ceremony-toggle input[type="checkbox"]{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;flex:0 0 22px!important;margin:0!important}\n      .panel{overflow-x:hidden}'''
new='''      .ceremony-settings{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;width:100%!important;max-width:100%!important;min-width:0!important}\n      .ceremony-row{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;padding:12px!important;margin:0!important;overflow:visible!important;box-sizing:border-box!important}\n      .ceremony-toggle{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:44px!important;padding:0!important;margin:0!important;box-sizing:border-box!important}\n      .ceremony-toggle span{display:block!important;flex:1 1 auto!important;min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}\n      .ceremony-toggle input[type="checkbox"]{display:block!important;width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;max-height:22px!important;flex:0 0 22px!important;margin:0!important;padding:0!important;position:static!important;transform:none!important}\n      .ceremony-detail{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;margin-top:10px!important;padding:0!important;box-sizing:border-box!important}\n      .ceremony-detail .form-group{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0!important}\n      .ceremony-help{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;overflow-wrap:anywhere!important;word-break:break-word!important}\n      .panel{overflow-x:hidden}'''
if old not in s:
    raise SystemExit('mobile ceremony anchor not found')
s=s.replace(old,new,1)
s=s.replace('content="20260830-7"','content="20260830-8"',1)
p.write_text(s,encoding='utf-8')

# versions
for fn in ['index.html']:
    q=Path(fn); t=q.read_text(encoding='utf-8').replace('content="20260830-7"','content="20260830-8"'); q.write_text(t,encoding='utf-8')
q=Path('sw.js'); t=q.read_text(encoding='utf-8').replace('const APP_VERSION = "20260830-7";','const APP_VERSION = "20260830-8";'); q.write_text(t,encoding='utf-8')
q=Path('package.json'); data=json.loads(q.read_text(encoding='utf-8')); data['version']='20260830.8.0'; q.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# add regression assertions
q=Path('scripts/tournament-result-ui.test.mjs')
t=q.read_text(encoding='utf-8')
marker='console.log("tournament result UI tests passed");'
asserts='''\nassert.ok(html.includes('.ceremony-row{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important'),"スマホの開会式・閉会式カードは巨大化しない高さにしてください");\nassert.ok(html.includes('.ceremony-toggle input[type="checkbox"]{display:block!important;width:22px!important'),"開会式・閉会式のチェックボックスは通常サイズにしてください");\nassert.ok(html.includes('.ceremony-detail .form-group{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important'),"開会式・閉会式の入力欄はスマホ幅内へ収めてください");\n'''
if asserts.strip() not in t:
    t=t.replace(marker,asserts+marker,1)
q.write_text(t,encoding='utf-8')
