from pathlib import Path
import re

# Remove only the duplicated top score URL panel. Keep score-entry functions and
# the score-entry LINE URL control that already exists inside the results area.
path = Path('tournament.html')
html = path.read_text(encoding='utf-8')
start_marker = '      <div class="match-day-actions" id="match-day-actions">'
end_marker = '      <div class="sec">📌 大会基本情報</div>'
start = html.find(start_marker)
if start < 0:
    raise SystemExit('match-day-actions block not found')
end = html.find(end_marker, start)
if end < 0:
    raise SystemExit('basic info marker not found after match-day-actions')
html = html[:start] + html[end:]

old_version = '20260830-2'
new_version = '20260830-3'
if old_version not in html:
    raise SystemExit('old tournament app version not found')
html = html.replace(old_version, new_version)
path.write_text(html, encoding='utf-8')

# The duplicate top panel is intentionally gone, so do not require its labels in UI tests.
test_path = Path('scripts/tournament-result-ui.test.mjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('  "🔗 スコア入力URLを作る",\n', '')
test = test.replace('  "LINE用の案内文＋URLをコピー",\n', '')
# Guard against accidentally bringing the duplicate panel back later.
guard = 'assert.ok(!html.includes(\'id="match-day-actions"\'),"対戦表上部に重複したスコア入力URLパネルを表示しないでください");\n'
if guard not in test:
    test += '\n' + guard

test_path.write_text(test, encoding='utf-8')

# Bump PWA version so installed/mobile users receive this UI cleanup promptly.
for filename in ['index.html', 'sw.js']:
    p = Path(filename)
    text = p.read_text(encoding='utf-8')
    if old_version not in text:
        raise SystemExit(f'{old_version} not found in {filename}')
    p.write_text(text.replace(old_version, new_version), encoding='utf-8')

pkg = Path('package.json')
pkg_text = pkg.read_text(encoding='utf-8')
old_pkg = '"version": "20260830.2.0"'
new_pkg = '"version": "20260830.3.0"'
if old_pkg not in pkg_text:
    raise SystemExit('old package version not found')
pkg.write_text(pkg_text.replace(old_pkg, new_pkg), encoding='utf-8')

print('removed duplicated top score URL panel; results-area score URL retained')
