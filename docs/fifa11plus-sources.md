# FIFA 11＋ / Kids 掲載資料の確認

確認日: 2026-10-24。アプリの本文は短い要約。写真・動画・PDFの転載はしない。治療・復帰判断や年齢別の自動負荷設定は実装しない。

## 通常版（14歳以上）

- 対象年齢: https://www.jfa.jp/mie/news/00016685/
- JFA動画一覧: https://www.jfa.jp/medical/11plus.html
- 日本語PDF: https://www.jfa.jp/medical/pdf/11plus_a4.pdf
- 補助解説（一部紹介）: https://www.sportsanzen.org/syogai_yobo/soccer/page3.html

PDFは22ページ。本文が画像のためレンダリングして確認した。参照先の `#page=` は閲覧上のページ番号。

| 種目 | JFA PDFページ |
| --- | --- |
| 準備・コーン6組、約5〜6m間隔 | 2 |
| 1〜3 ストレート・アヘッド / ヒップ・アウト / ヒップ・イン | 4 |
| 4〜6 サークリング・パートナー / ショルダー・コンタクト / 前後走 | 6 |
| 7 ベンチ | 8 |
| 8 サイドベンチ | 10 |
| 9 ハムストリング（初級3〜5回） | 12 |
| 10 シングルレッグスタンス | 14 |
| 11 スクワット | 16 |
| 12 ジャンプ | 18 |
| 13〜15 アクロス・ザ・ピッチ / バウンディング / プラント＆カット | 20 |

Part 1=8分、Part 2=10分、Part 3=2分。Part 2の要約は初級のみ。中級・上級は同じPDFページの原本で確認。動画URLはJFAページに掲載された `.mpg` リンクを使用し、再生できない端末にはJFA一覧を案内する。

## Kids（7〜13歳）

FIFA / F-MARC発行の `FIFA 11+ FOR KIDS MANUAL`（2016年版）をNepean Football Associationの掲載先から確認:
https://nepeanfootball.com.au/wp-content/uploads/2020/04/11__kids_manual.pdf

配信元はFIFAドメインではないため、画面では「FIFA発行・Nepean Football Association掲載／英語PDF」と明記する。82ページ、17,555,342 bytes。本文で対象年齢7〜13、7種目、各5レベル、レベル1から順序を飛ばさないことを確認。FAQ掲載の時間は15〜20分、練習の開始時・週2回以上。幼児へ一律適用しない。

| 種目 | PDF上のレベル1〜5 | 印刷上のレベル1 |
| --- | --- | --- |
| 1 Alertness running game | 14〜18 | 11 |
| 2 Skating jumps | 22〜26 | 19 |
| 3 Single-leg stance | 30〜34 | 27 |
| 4 Press-ups | 38〜42 | 35 |
| 5 Single-leg jumps | 46〜50 | 43 |
| 6 Spiderman | 54〜58 | 51 |
| 7 Sideways roll | 62〜66 | 59 |

Kidsの要約はレベル1のみ。高いレベルの動きは原本の各ページへリンクし、独自に負荷や種目順を変更しない。受け身は頭を接地しないこと、次の合図まで5秒以上あけることを原本で確認した。通常版のコーン配置図をKidsへ流用しない。

## 実装と保存

`coach_menu.html` の固定カードから `fifa11plus.html` へ遷移。既存の `practice_menu` / `smc_menu_urls_v1` は変更せず、FIFAの項目を保存データへ追加しない。新しいページにFirebase接続や実施記録の保存はない。外部資料は事前キャッシュせず、端末への保存成功を表示しない。

## 日本語優先の導線（2026-10-24）
主ボタンはアプリ内の日本語7種目へ移動。Kidsの原本写真と5レベルは「英語」と明示した補足details内に配置する。日本語のKids公式翻訳を確認できなかったため、通常版のJFA日本語資料をKidsの翻訳として代用しない。既存の短い日本語要約を公式翻訳と称さない。
