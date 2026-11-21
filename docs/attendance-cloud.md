# クラウド出欠の公開設定

クラウド出欠は既存の Firebase Authentication と Cloud Firestore を使う。GitHub Pages の画面公開と、個人情報を扱うクラウドの利用開始は別の操作。試作版の端末内データは、保護者またはコーチが対象試合を選んで明示的に読み込むまで送信されない。

## Firebase 管理者による初期設定

1. 本番の Firestore ルールを退避し、`firebase-free/firestore.rules` に追加された出欠のルールだけを既存のルールに統合する。既存の合宿データやルールは置換しない。出欠のパスにも権限を与える包括ルールがないことを確認する。検証環境で末尾の権限テストを通す。
2. Firebase Authentication のメールアドレスとパスワードによるログインを使用する。利用者のメール確認が済んだことを確認し、UIDごとに以下の権限を設定する。クライアントから権限文書は作成・変更できない。
3. 同じ Firestore に対象日程と対象者を登録する。導入直後はテスト用の団員・コーチ・予定を使う。
4. ルール・アカウント・日程を確認してから、`attendanceConfig/v1` の `enabled` を `true` にする。一時停止は `false` に戻す。

## 登録する文書

| パス | フィールド |
| --- | --- |
| `attendanceConfig/v1` | `enabled` 真偽値 |
| `attendanceAccounts/{認証UID}` | `active` 真偽値、`players` マップ（団員IDをキーとする `{name, grade}`）、`coachId`・`coachName`、`coachEvents` マップ（担当するクラウド予定IDをキーとする真偽値） |
| `attendanceCloudEvents/{予定ID}` | `date`（日本時間の YYYY-MM-DD）、`title`、`kind`（`match` または `practice`）、`open`、`cancelled`、`targetGrades` と `practiceExcludedGrades` の文字列配列、`localEventId` |
| `attendanceCloudEvents/{予定ID}/roster/{団員ID}` | `name`、`grade`。団員IDは団員名簿のIDと同一 |
| `attendanceCloudEvents/{予定ID}/playerAnswers/{団員ID}`・`coachAnswers/{コーチID}` | 画面が出欠、連絡、リビジョン、更新時刻を作成する |

- 保護者の `players` には、確認した本人に紐づく団員だけを登録する。コーチの担当試合は `coachEvents` に個別登録する。コーチ本人の出欠を扱う場合は `coachId` も設定する。
- `targetGrades` はアプリの名簿表記を使う。「1年以下」は `["1年","年長"]`。同じ日に試合がある場合、練習の `practiceExcludedGrades` に受付中の試合の対象学年を設定する。試合の中止・対象変更時は更新する。
- カレンダー上の予定と対応させるには、試作版の予定IDを `localEventId` に入れる。試作版の試合集計にある「クラウドの出欠・連絡一覧」のリンク先URLの `event` パラメータが、その試合の予定ID。Firestoreの文書IDは安定した値を使用し、日付だけをIDにしない。同じ日に複数の試合があっても別文書にする。クラウド側の日程・担当・対象者の初期登録と更新は管理者が行う。
- 端末内の試作回答は、同一の回答者ID・`localEventId` がある場合だけフォームから1件ずつ読み込める。読み込み時点では送信せず、保存前に内容を表示する。クラウドの既存回答があれば、置き換えるか確認できる。
- 保護者の端末を共有せず試す場合は、クラウド出欠のログアウトを利用する。担当外への権限付与は不要。

## 検証

`node --test scripts/attendance-cloud.test.mjs` で入力と競合のモデルを検査する。Firestore のエミュレーターを起動した状態で `CAMP_QA_PACKAGE=/path/to/qa/package.json node scripts/attendance-cloud-rules.test.mjs` を実行する。準備の方法は [合宿の検証環境](../firebase-free/README.md#検証) に準ずる。

初回公開時は実際の団員データを入れる前に、テスト用の保護者と担当コーチを別ブラウザーまたは別端末で使用し、同日の試合AとBに異なる連絡が保存されることと、担当外アカウントから読めないことを確認する。
