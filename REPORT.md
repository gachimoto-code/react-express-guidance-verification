# 比較検証レポート:単純なセットアップに Modern Web Guidance を入れると何が変わるか

実施日: 2026-11-14 / 場所: `~/workspace/guidance-setup-test/`(`plain/` と `guided/`)

## 検証方法

ユーザーの標準構成(frontend = Vite + React + TypeScript、backend = Express + TypeScript)で、
まったく同じ「単純なセットアップ」を2回行った。

- **plain**: ガイダンスなし。Vite の react-ts テンプレートをほぼそのまま使い、タイトル
  (`<title>` と `<h1>`)だけ "guidance setup test" に変更。backend は Express+TS で
  `GET /api/health` と `GET /api/items`(固定配列)のみの最小構成を手書き。
- **guided**: プロジェクト直下で本物の install を実行してから、同じセットアップを実施。
  ただし生成コードは、install された SKILL.md のワークフロー(実装前にガイドを検索・取得する)に
  従って書いた。無理な作り替えはせず「ガイドに従うと自然にこうなる」範囲に留めた。

## 1. セットアップ手順の差

### plain の手順

1. `npm create vite@latest frontend -- --template react-ts`
2. backend を手書き(package.json / tsconfig.json / src/index.ts)
3. 各自 `npm install` → ビルド確認

### guided で増えた手順: install が1回だけ

`npx -y modern-web-guidance@latest install` の実挙動を記録する。

- **対話モード(引数なし)**: ウィザードが起動し、GitHub からリポジトリを clone →「Found 2 skills」
  → スキル `modern-web-guidance` を自動選択 → 導入先エージェントの検出(表示上は Codex、
  フォーマットは universal)→ **「Installation scope: Project / Global」の選択プロンプトで
  キー入力待ちになる**。TTY がない環境ではここで止まり、ファイルは何も書き込まれない
  (stdin を閉じて実行したところ、プロンプト表示のまま終了し、作業フォルダには何も残らなかった)。
- **`-y` フラグ付き(プロンプト省略)**: Project スコープ既定のまま完走した。このVMでの実測は
  約15秒(clone 込み)。途中でセキュリティ評価の表示(Gen: Safe / Socket: 1 alert / Snyk: Low Risk)が出る。
- **書き込まれるもの**(プロジェクト直下):
  - `.agents/skills/modern-web-guidance/SKILL.md` ― エージェントへの指示書
    (「HTML/CSS とクライアント側 JS のタスクでは、まずガイドを検索・取得せよ」というワークフロー定義)
  - `.agents/skills/modern-web-guidance/guides/` ― ガイド全文のローカルコピー
    (17カテゴリ、計 2.3MB)
  - `skills-lock.json` ― 導入記録(ソースとハッシュ)
- 配置先は `.agents/skills/` という複数エージェント共通(Codex / Amp / Cline / Cursor 等)の
  プロジェクト内パスで、「プロジェクトと一緒にコミットする」想定のスコープだった。

**重要な前提**: install は「指示書 + ガイド全文」を置くだけで、**既存コードは1行も変わらない**。
コードが変わるのは、その後にエージェントが SKILL.md のワークフローに従ってコードを書くときだけである。
本検証の guided 側の差分は、そのワークフローに従って starter の CSS を書いた結果である。

## 2. コードの差分要約

`diff -r` の結果、差分があったのは **frontend の2ファイルだけ**だった
(`frontend/index.html` と `frontend/src/index.css`)。

### plain のコードの特徴(テンプレート素の状態)

- テーマ色はカスタムプロパティのトークン方式。ただしライト値を `:root` に定義し、
  ダークは `@media (prefers-color-scheme: dark)` で**トークン全量を再定義**する二重管理。
- 色の表記は hex / rgba。
- フォントサイズは px(`:root` が 18px、h1 は 56px を 1024px ブレークポイントで 36px に切替)。
  line-height は % 表記(145% / 118% / 135%)。
- `color-scheme: light dark` は `:root` に既に宣言済み。
- レイアウトは flex、`border-inline` 等の論理プロパティ、`100svh`、CSS ネスティングを使用。
- App.css はトークン参照のみで完結し、`.counter` には `:focus-visible` スタイルがある。
- 常時アニメーションはこの版のテンプレートには存在しない(ロゴ回転などがない)。
- backend は express の最小形(`express.json()` 等のミドルウェアも入れていない)。

### 変わった点(guided)

| # | 箇所 | plain | guided | 根拠ガイド |
|---|------|-------|--------|-----------|
| 1 | index.html | meta なし | `<meta name="color-scheme" content="light dark">` を追加 | dark-mode(ガイド内で MANDATORY 指定) |
| 2 | テーマトークン | ライト定義 + ダーク再定義ブロック(14行) | 全トークンを `light-dark(oklch(…), oklch(…))` の単一定義に統合し、再定義ブロックを削除。影も色部分を light-dark() 化して合成 | dark-mode |
| 3 | ブラウザUI | なし | `:root` に `accent-color: var(--accent)` を追加 | dark-mode(細部のUI調整) |
| 4 | フォント単位 | px / line-height は % | rem に換算(18px→1.125rem 等)、line-height は unitless(1.45 等) | typography |
| 5 | h1 サイズ | 固定 56px + ブレークポイントで 36px | `clamp(2rem, 1.4rem + 2.2vw, 3.111rem)` の流動サイズにし、サイズ用のブレークポイント上書きを削除 | responsive-design |
| 6 | 見出し | なし | h1 / h2 に `text-wrap: balance` | improve-text-layout-and-legibility |

なお #2 でも、アイコン画像の `filter: invert(1)`(色ではない分岐)だけは
`@media (prefers-color-scheme: dark)` に残った。light-dark() は色しか解決できないためで、
これはガイド自身も認める使い分けである。

### 変わらなかった点

- **App.tsx / main.tsx / App.css / vite.config.ts / tsconfig / package.json / 依存関係は完全一致。**
  コンポーネント側 CSS が元々トークン参照だけで書かれていたため、ガイドの影響は
  トークン定義層(index.css)に閉じた。
- レイアウト手法(flex、論理プロパティ、100svh、ネスティング)と `color-scheme` の
  `:root` 宣言、`:focus-visible` スタイルは、**現在の Vite テンプレートが最初からガイド適合**だった。
- ダイアログ、フォーム、リスト並び替え、アニメーション等に対応するガイドは、
  スターター画面にそれらの部品が存在しないため発動しなかった(CLI のガイド総数は 208 件で、
  この段階で関係したのは上表の 4 ガイドだけ)。
- 色の値そのものは変えていない(hex → oklch は同じ色の換算)。

## 3. backend への影響

**なし。** guided の backend は plain とバイト単位で同一(package.json / tsconfig.json /
src/index.ts とも diff なし)。
これは手抜きではなくガイド側の設計どおりで、install された SKILL.md 自身に
「DO NOT trigger for: backend (SQL, ORMs, API routes)」と明記されている。
Modern Web Guidance はブラウザ側プラットフォームのガイドであり、Express の API 実装には
参照すべきガイドが存在しない。

## 4. ビルド・動作確認

両方とも /tmp にコピーして `npm install` から実施(ワークスペースには node_modules を残していない)。

| 対象 | 結果 |
|------|------|
| plain frontend | `npm run build`(tsc -b && vite build)成功 |
| guided frontend | 同上、成功(生成 CSS は 4.10kB → 4.88kB、主にコメントとトークン表記の差) |
| plain backend | `tsc` 成功。起動して `GET /api/health` → `{"status":"ok"}`、`GET /api/items` → 固定配列3件 |
| guided backend | 新規 install から `tsc` 成功。起動確認の応答も plain と同一 |

## 5. 結論

単純なセットアップにガイダンスを入れても、変わるのは**テーマ色の書き方とタイポグラフィの
流儀くらい**に留まる。実際にコードが変わったのは、ダークモードのトークン化
(light-dark + oklch による二重管理の解消)と、px → rem / clamp() 化で、これは
「書き方の現代化」としては本物だが、画面の見た目や機能は plain とほぼ同じである。
理由は単純で、(1) 現在の Vite テンプレート自体が既にかなりモダンで、レイアウトや
color-scheme などは最初からガイドと一致していたこと、(2) ガイドの本領である
ダイアログ、フォーム、並び替え、アニメーション等の部品が、セットアップ段階の画面には
まだ存在しないこと、(3) backend はガイドの対象外であること。
導入コストは install 1回(約15秒、対話なしフラグ必須)と 2.3MB のガイド同梱だけなので、
「セットアップの時点で入れておく保険」としては安い。ただし効果が目に見えて出るのは、
部品を足していく実装フェーズに入ってからである。
