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

## 残っている課題

- 無料版のFirestoreルール反映が本番で完了しているか未確認（リポジトリ外のため検証不可）
- 共有リンクの無効化・再発行はFirebaseコンソールでの手作業
- 自動バックアップとワンクリック復元は未実装（設定画面からのJSON保存のみ）
- API版の本番サーバー配置先は未定。配置しない限り`camps-api.html`は動作しない
