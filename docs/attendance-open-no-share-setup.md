# 出欠テスト（共有リンク不要）の導入・確認

この版では `attendance-preview.html` を通常のURLで開くだけで、団員・コーチの氏名を選び、出欠を入力する構成です。旧 `#test=...` の入力画面・識別子依存を使いません。

## データの区分（重要）
- 氏名：既存 Realtime Database の `members_v2` と `staff/coach` を読み取り専用で参照
- 新しい回答：Realtime Database `attendance_open_v1/answers`
- 新しい出欠受付停止・再開：`attendance_open_v1/eventVisibility`
- 新しい祝日例外：`attendance_open_v1/holidayExclusions`
- 新しい招集対象：`attendance_open_v1/recruitment`
- **以前の回答**：Firestore `attendancePreviewSessions/{旧セッション}/answers` のまま維持。削除・移行・上書きしない

同じGitHub Pages URLの全端末が同じ `attendance_open_v1` を参照する。Firestoreの旧回答は自動的に引き継がず、新しい回答は空欄から再入力する。

## 公開前に必要なFirebase確認

1. Firebase Console → Realtime Database → ルールで、既存ルールをバックアップする。
2. `attendance_open_v1` だけの読み取り・書き込み権限が適切か確認する。これはコード変更だけでは設定できない。**接続できない場合、既存DB全体の `.read` / `.write` を `true` にしてはいけない。**
3. 入力先に個人情報を含む自由記入があるため、URLを知る人が読み取り・編集できる公開運用のリスクをコーチ間で確認する。必要なら認証や招待方式を採用する。ログイン不要のまま機密保持は保証できない。
4. スマートフォン2台で、団員・コーチの氏名表示、名前タップ、出欠保存、別端末での同期、再読込後の永続化、コメント表示、受付停止・復元、CSVを確認する。
5. データベースのルールで許可されていない場合、出欠画面には接続エラーが出る。成功を偽装したり端末だけに保存して「共有済み」と表示したりしない。

## コーチの確認後の本番移行

- 本番 `attendance.html` と試験 `attendance-preview.html` は切替まで分離する。
- 既存の「調整さん」・保護者向けLINE案内など、本番の機能を棚卸しする。
- 旧データはバックアップし、移行承認後に本番の導線だけ変更できるPRを作る。新しい回答の保存先を変えない。
- 切替が問題を起こしたら導線とコードを元に戻す。回答データを削除しない。

## 注意
現時点では、Firebase Consoleでのルール設定や実端末同期テストはGitHubコードだけから確認できない。本番反映前に必ず実地検証する。
