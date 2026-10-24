# 開発引き継ぎメモ（ClaudeとCodexの共用）

このリポジトリはClaudeとCodexの両方で開発しています。会話の記憶ではなく、**現在のmainブランチの実装**を基準にしてください。このファイルは引き継ぎの入口です。詳細は既存文書に書かれているため、ここでは重複させず参照先を示します。

| 目的 | 読む文書 |
|---|---|
| ポータル全体の構成・保存先・PWA運用 | `README.md` |
| 合宿のAPI版（サーバー方式）の運用 | `docs/camp-operations.md` |
| 合宿の無料版（Firestore共有リンク方式）の導入 | `firebase-free/README.md` |
| 利用者向けの使い方 | `guide.html` / `camp-free-guide.html` |

## 作業を始める前に

1. `git fetch` してmainを最新にし、`git status` で未コミット変更を確認する
2. `npm test` を実行し、着手前の正常状態を記録する
3. 専用ブランチを切る（mainへ直接コミットしない）
4. push直前にもう一度mainの更新を確認する

## アプリ構成

ビルド工程のない静的サイトです。GitHub Pagesで配信し、各ページは単独のHTMLに処理を書く方式です。共通処理だけを`common.js`・`common.css`・`firebase-config.js`に置いています。フレームワークとバンドラーは使いません。

保存先はFirebase Realtime Database（既存機能）とCloud Firestore（合宿の無料版のみ）に分かれます。**既存のRealtime Databaseのパスとデータ構造は変更しないでください。**

## 合宿機能の現状

合宿には方式の異なる2系統があり、**現在の運用対象は無料版です**。

| 系統 | 入口 | 処理 | 保存先 | 状態 |
|---|---|---|---|---|
| 無料版 | `camps.html` | `camp/free-app.mjs`<br>`camp/free-model.mjs`<br>`camp/free-service.mjs` | Firestore `campShared` | **運用対象**。コードは実装済み |
| API版 | `camps-api.html` | `camp/app.js`＋`camp-server/` | SQLite | 旧方式。無料版では使わないが参照用に温存 |

画面の入口はホーム最下部の「🏕️ 合宿」欄（`index.html`の`#sec-camp`）です。合宿管理とビンゴをここにまとめており、ビンゴから戻るとこの欄に戻ります。コーチ画面からは移設済みのため、重複して置かないでください。

無料版はログイン不要の共有リンク方式です。これは利用者の決定事項で、Firebase Authenticationの設定・Googleログイン・管理者UID登録はいずれも不要です。URLのフラグメントにUUIDを置き、リンクを知る人が閲覧・編集できます。本人認証ではないため、**緊急連絡先と健康情報は入力させない設計**です。この制約は`firestore.rules`でも拒否しています。緩める変更をしないでください。

特別収支は利用者の指定（2026-10-23）により、`camp-special.html` で共有リンクを知る人がログインなしで編集します。`campShared/{id}/specialItems` と `specialHistory` は共有可能な金額・状態と端末識別子の履歴だけを保存します。制度名・対象者・申請根拠・受給者などは入力させません。以前の `campSpecialPrivate` と `campSpecialAdmins` は権限を緩めず保護し、今回管理者ACLは付与しません。旧管理者ページは互換用に残すだけです。非表示合宿は通常一覧から除外し、折りたたみから復元できます。

機能はタブ構成で、参加集約・費用の見立て・ルート・集金決算などを持ちます。金額は円の整数で扱い、未納は参加者ごとに0以上で計算します（他人の過入金と相殺しない）。

### 無料版を実際に動かすために必要な手作業

コードの配置だけでは動きません。`firebase-free/README.md`の手順どおり、**Firestoreの作成と`firestore.rules`の反映がFirebaseコンソールで必要**です。この反映状況はリポジトリからは確認できないため、動かない場合はまずここを疑ってください。

## 検証コマンド

```sh
npm test               # 既存機能の全検査（CIと同じ）
npm run test:camp      # 合宿API版のサーバー検査
npm run test:camp:free # 合宿無料版の計算検査
```

上記3つはGitHub Actionsでも実行します。次の2つは外部依存が必要なため、CIには入れず手元で実行します。

```sh
node scripts/camp-browser.test.mjs       # API版のブラウザ検査（Playwrightが必要）
node scripts/camp-free-rules.test.mjs    # Firestoreルール検査（エミュレーターが必要）
node scripts/camp-free-browser.test.mjs  # 無料版のブラウザ検査（両方が必要）
```

外部依存の場所は環境変数で差し替えます。既定値はリポジトリ隣の`../qa`です。

| 環境変数 | 内容 |
|---|---|
| `CAMP_QA_PACKAGE` | QA依存の`package.json`の絶対パス。同じフォルダに`firebase-*-compat.js`を置く |
| `PLAYWRIGHT_MODULE` | Playwrightを別の場所へ入れた場合のパッケージ絶対パス |
| `CAMP_QA_OUTPUT` | 画像・PDF・JSONの出力先。既定は`work/`配下で、Gitの追跡から除外済み |

## 変更時の注意

- **PWAのバージョンは4か所を同じ値に揃える**：`index.html`と`tournament.html`の`app-version`、`sw.js`の`APP_VERSION`、`package.json`の`version`。ずれると`npm test`が失敗します
- 利用者の入力をエスケープせずに`innerHTML`へ入れない（`firebase-config.js`の`escapeHtml`を使う）
- 保存が完了する前に「保存しました」と表示しない
- Firebaseに保存済みのデータを削除・初期化しない。テストデータを本番Firebaseへ保存しない
- 強制リロードや全キャッシュ削除を入れない（入力中の内容が消えるため）
- 利用者はITが苦手な保護者とスマートフォン中心のコーチです。入力欄の文字は16px以上、タップ領域は44px以上を保ってください（`common.css`の`@media (pointer: coarse)`）

## 配車・点呼の削除／合宿クラウド保存（2026-10-24）

利用者の指定により「配車・点呼」機能（配車・部屋割り・点呼の端末内管理）を撤去。合宿の概要・参加者・行程・会計は従来どおりCloud Firestoreの`campShared`に保存する。保存通知はFirestoreの書込み成功後とクラウドからの再取得後に表示する。端末内の旧配車データは利用者のブラウザに残っている場合があるが、自動消去しない。共有URLは本人認証ではないため、緊急連絡先・健康情報・個人の所在情報を保存させない。本番Firestoreルール公開状況は未確認のまま。

## 残っている課題

- 無料版のFirestoreルール反映が本番で完了しているか未確認（リポジトリ外のため検証不可）
- 共有リンクの無効化・再発行はFirebaseコンソールでの手作業
- 自動バックアップとワンクリック復元は未実装（設定画面からのJSON保存のみ）
- API版の本番サーバー配置先は未定。配置しない限り`camps-api.html`は動作しない

## 合宿会計の簡素化（2026-10-23）

「会計」の中に「予算を立てる」「お金を記録する」「決算を見る」を配置します。通常予算と特別収支は表示だけを統合し、保存先は変えません。合計額入力は既存の単価×数量で保持し、`accounting-model.mjs`で変換します。参加費の役割・部屋数・泊数などは詳細設定に残します。`special-entry-ui.mjs`は共有可能な金融項目だけを編集し、非公開記録は扱いません。Firestoreルール変更は不要です。検査は既存モデル・ルールに加え `camp-simple-accounting.test.mjs` と `camp-simple-accounting-browser.test.mjs` を使います。

## 合宿参加者のコンパクト表示（2026-10-24）

「参加集約」は氏名ボタンから出欠・参加費・入金を開きます。参加者の既存IDで紐づけ、`participant-accounting.mjs` は台帳から状態を導出するだけです。請求未設定と明示0円を区別し、徴収済みフラグは追加しません。参加情報・請求・入金は独立して保存し、入金は既存台帳の取引として追記します。出欠変更で金額を更新しません。Firestore構造・ルール・権限は変更不要です。追加検査は `scripts/camp-participant-accounting.test.mjs` と `scripts/camp-compact-participants-browser.test.mjs`。

## 参加費・期限の一括設定（2026-10-24）

`bulk-fees-model.mjs`で対象者と変更前後を確認し、`bulk-fees-ui.mjs`から既存台帳へ `charges` 操作として保存します。初期対象は参加・請求未設定のみ。既存額の変更、未回答・不参加の追加は明示選択です。期限だけは設定済み請求を対象とします。最大100人を1つのFirestoreトランザクションで保存し、台帳・公開集計のrevisionを1だけ更新します。対象者revisionも同じトランザクションで読み、競合なら全件中止します。既存の台帳historyに請求変更前後と操作署名を保持し、入出金は作りません。請求の任意noteだけを同じcharges内に追加します。保存先・Firestoreルール・権限の変更はありません。検査は `camp-bulk-fees.test.mjs` / `camp-bulk-fees-browser.test.mjs`。

## FIFA 11＋資料（2026-10-24）

練習メニュー `coach_menu.html` に固定カードを追加し、`fifa11plus.html` でKids（7〜13歳）と通常版（14歳以上）を分ける。既存URL保存の `practice_menu` と `smc_menu_urls_v1` に固定カードを書き込まない。静的HTML・native detailsとごく短いDOM操作だけを使用し、Firebase・実施記録は追加しない。公式写真/動画の転載はせず、原本へのリンクを使用する。照合資料・ページ対応は `docs/fifa11plus-sources.md`。検査: `scripts/fifa11plus.test.mjs`、`scripts/fifa11plus-browser.test.mjs`。

FIFA資料の主導線は日本語のアプリ内要約。Kids英語原本は明示して折りたたみ、通常版JFA日本語資料と混同しない（2026-10-24）。

## 名簿の小学校（2026-10-24）
`members_v2/{id}` に任意文字列 `school` を追加。既存の団員単位updateで保存し、一覧・編集・CSVに表示。未登録は空欄、既存データ一括更新・名簿以外への転記はしない。LINEコピーには学校名を追加しない。
