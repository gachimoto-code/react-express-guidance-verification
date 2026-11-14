# react-express-guidance-verification

Chrome の AI 向け Web 開発ガイダンス [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) を「全部入り」にした状態で、標準構成（frontend = Vite + React + TypeScript／backend = Express + TypeScript）のアプリを作ると、ガイダンスなしの場合と比べてコードがどう変わるかを検証した記録です。

同じ仕様のアプリを2回作り、出来上がったコードを比較しました。

- `plain/` — ガイダンスなし。普段どおりに実装
- `guided/` — プロジェクトにガイダンスを install（`npx modern-web-guidance@latest install -y`）してから、実装前にガイドを検索・取得して実装。`.agents/skills/` と `skills-lock.json` は install で実際に入ったもの

## 検証の2段階

1. **セットアップ**（[REPORT.md](REPORT.md)）: Vite テンプレートと最小 API の素のセットアップ同士を比較。差分は frontend の2ファイルだけ（テーマ色の書き方とタイポグラフィ）で、backend はバイト単位で同一だった。
2. **実装フェーズ**（[REPORT2.md](REPORT2.md)）: 両側に認証（ログイン／ログアウト／セッション確認）とダッシュボード（統計カード、ソート可能テーブル、詳細ダイアログ）を同仕様で実装。guided 側は実装前に10ガイドを取得。部品の作りが明確に変わり（ネイティブ `<dialog>`、`aria-sort`、`:user-invalid`、`@container` など）、コード量は約1.7倍になった。backend はこの段階でも完全同一。

## 動かし方

各フォルダ（`plain/` または `guided/`）で:

```sh
cd backend && npm install && npm run dev   # http://localhost:3001
cd frontend && npm install && npm run dev  # Vite の表示する URL
```

デモログイン: `demo@example.com` / `password`

## 関連

- 検証記事（note）: 「ガイダンス全部入り」で React アプリを作ったら、セットアップは無風・実装で激変だった（公開後にリンクを差し替え）
- 前編で作ったビューア: https://github.com/gachimoto-code/github-star-surge-viewer
