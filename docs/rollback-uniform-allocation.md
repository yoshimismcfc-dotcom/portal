# ユニフォーム配布計画機能の復元手順

## 復元情報

- 変更前の `main` SHA: `53b165e788fef72863cc1bda6d2e388abd3413c6`
- 復元用ブランチ: `backup/before-uniform-allocation-20260816-0045`
- 復元用タグ名: `backup-before-uniform-allocation-20260816-0045`
- Firebaseバックアップ日時: 2026-08-16 01:22:46 JST
- Firebaseバックアップ: 公開リポジトリ外の管理者専用保存領域
- 変更後コミット: この文書を含む公開コミット（`git log -1 --oneline main` で確認）

復元用ブランチはGitHub上に作成済みです。タグは作業環境に作成しましたが、Git認証を使わない公開方式のためGitHubへは送信していません。変更前SHAと復元用ブランチの両方から変更前ファイルを取得できます。

## 変更ファイル

- `members.html`
- `uniform.html`
- `scripts/uniform-display.test.mjs`
- `scripts/uniform-allocation.test.mjs`
- `package.json`
- `docs/rollback-uniform-allocation.md`

## コードだけを戻す

公開コミットSHAを確認し、管理者の承認後に次を実行します。

```sh
git revert <変更後コミットSHA>
git push origin main
```

履歴を破壊する `git reset --hard` や `git push --force` は使用しません。

## Firebaseデータを戻す条件

コードのrevertだけでは解決できず、今回の配布予定・貸出処理によって保存されたデータそのものを取り消す必要がある場合に限ります。`members_v2.num` と `members_v2.uniforms` は今回削除しないため、通常はコードのrevertと表示元設定の切替で旧表示を確認できます。

Firebaseの復元は、必ず利用者の承認を得て、対象レコードと差分を確認してから行います。バックアップJSONで本番データ全体を一括上書きしません。
