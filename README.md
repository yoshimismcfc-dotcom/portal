# 吉見SMCサッカースポーツ少年団 スマートポータル

埼玉土建上尾伊奈支部ポータルと同じデザインシステムを使用。

## ファイル構成
- `common.css` 共通スタイル（土建ポータルと同一デザインシステム）
- `common.js`  共通JS（タブ切り替えなど）
- `index.html` ホーム画面
- `heat.html`  熱中症チェック（WBGT推定・環境省準拠）
- `attendance.html` 出欠確認（調整さんリンク）
- `calendar.html`   チームカレンダー（Googleカレンダー埋め込み）
- `coach.html`      コーチ専用エリア（パスコードロック）
- `.nojekyll`  GitHub Pages用（削除しないこと）

## 差し替え必須箇所
1. `attendance.html` 内の調整さんURL（団員用・コーチ用 各1箇所）
2. `calendar.html` 内のGoogleカレンダーiframe URL
3. `index.html` 内の今日の連絡テキスト
4. `coach.html` 内のパスコード（PASSCODE定数）

## GitHub Pages公開手順
1. GitHubで新リポジトリを作成（例: `yoshimi-smc-portal`）
2. このフォルダの全ファイルをアップロード
3. Settings → Pages → Source: main ブランチ / root に設定

