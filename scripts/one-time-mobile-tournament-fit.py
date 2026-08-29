from pathlib import Path
import re, json

p=Path('tournament.html')
s=p.read_text(encoding='utf-8')
marker='/* ===== 20260830 smartphone tournament fit ===== */'
if marker not in s:
    css=r'''
    /* ===== 20260830 smartphone tournament fit ===== */
    @media(max-width:760px){
      html,body{max-width:100%;overflow-x:hidden}
      #doc-taisen,#taisen-preview{width:100%;max-width:100%;min-width:0;overflow-x:hidden!important}
      #taisen-preview>*{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
      .tai-sheet:not(.pdf-capture){width:100%!important;max-width:100%!important;min-width:0!important;padding:10px 8px!important;overflow:hidden!important;box-sizing:border-box!important}
      .tai-sheet:not(.pdf-capture) *{box-sizing:border-box;min-width:0}
      .tai-sheet:not(.pdf-capture) table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important}
      .tai-sheet:not(.pdf-capture) th,.tai-sheet:not(.pdf-capture) td{min-width:0!important;max-width:none!important;padding-left:3px!important;padding-right:3px!important;overflow-wrap:anywhere;word-break:break-word}
      .tai-sheet:not(.pdf-capture) .st{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important}
      .tai-sheet:not(.pdf-capture) .st th,.tai-sheet:not(.pdf-capture) .st td{font-size:clamp(10px,2.75vw,12px)!important;line-height:1.25!important}
      .tai-sheet:not(.pdf-capture) .st .sched-th{font-size:clamp(9px,2.55vw,11px)!important;padding:5px 2px!important}
      .tai-sheet:not(.pdf-capture) .score-input{width:48px!important;max-width:100%!important;min-width:0!important;height:48px!important;min-height:48px!important;padding:0!important;margin:0 auto!important}
      .tai-sheet:not(.pdf-capture) .taisen-team,.tai-sheet:not(.pdf-capture) .team-name{min-width:0!important;overflow-wrap:anywhere!important;word-break:break-word!important;white-space:normal!important}
      .tai-sheet:not(.pdf-capture) .rank-table,.tai-sheet:not(.pdf-capture) .round-table,.tai-sheet:not(.pdf-capture) .matrix-table{font-size:clamp(9px,2.55vw,11px)!important}
      .tai-sheet:not(.pdf-capture) .rank-table th,.tai-sheet:not(.pdf-capture) .rank-table td,
      .tai-sheet:not(.pdf-capture) .round-table th,.tai-sheet:not(.pdf-capture) .round-table td,
      .tai-sheet:not(.pdf-capture) .matrix-table th,.tai-sheet:not(.pdf-capture) .matrix-table td{padding:4px 2px!important;min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .tai-sheet:not(.pdf-capture) .rank-table th:first-child,.tai-sheet:not(.pdf-capture) .rank-table td:first-child{width:7%!important}
      .tai-sheet:not(.pdf-capture) .rank-table th:nth-child(2),.tai-sheet:not(.pdf-capture) .rank-table td:nth-child(2){width:35%!important}
      .tai-sheet:not(.pdf-capture) .round-table th:first-child,.tai-sheet:not(.pdf-capture) .round-table td:first-child,
      .tai-sheet:not(.pdf-capture) .matrix-table th:first-child,.tai-sheet:not(.pdf-capture) .matrix-table td:first-child{width:24%!important}
      .tai-sheet:not(.pdf-capture) .pdf-result-cta{width:100%!important;max-width:100%!important;padding-left:10px!important;padding-right:10px!important}
    }
    @media(max-width:390px){
      .tai-sheet:not(.pdf-capture){padding:8px 5px!important}
      .tai-sheet:not(.pdf-capture) th,.tai-sheet:not(.pdf-capture) td{padding-left:2px!important;padding-right:2px!important}
      .tai-sheet:not(.pdf-capture) .st th,.tai-sheet:not(.pdf-capture) .st td{font-size:9.5px!important}
      .tai-sheet:not(.pdf-capture) .rank-table,.tai-sheet:not(.pdf-capture) .round-table,.tai-sheet:not(.pdf-capture) .matrix-table{font-size:9px!important}
      .tai-sheet:not(.pdf-capture) .score-input{width:44px!important;height:46px!important;min-height:46px!important}
    }
'''
    idx=s.find('</style>')
    if idx<0: raise SystemExit('style closing tag not found')
    s=s[:idx]+css+s[idx:]

s=s.replace('content="20260830-3"','content="20260830-4"',1)
p.write_text(s,encoding='utf-8')

for fn in ['index.html','sw.js']:
    q=Path(fn); t=q.read_text(encoding='utf-8'); t=t.replace('20260830-3','20260830-4'); q.write_text(t,encoding='utf-8')
q=Path('package.json'); data=json.loads(q.read_text(encoding='utf-8')); data['version']='20260830.4.0'; q.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('mobile tournament fit applied')
