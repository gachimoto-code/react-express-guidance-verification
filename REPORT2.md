# 比較検証レポート 第2段階:実装フェーズ(認証+ダッシュボード)でガイダンスは何を変えるか

実施日: 2026-11-14 / 場所: `~/workspace/guidance-setup-test/`(`plain/` と `guided/`、第1段階の続き)

## 検証方法

第1段階(セットアップ)では差がほぼ出なかったため、両側に**同じ仕様**で「認証」と
「ダッシュボード」を追加実装し、出来上がったコードを比較した。

- **plain**: ガイドを一切見ずに、通常の書き方で実装。
- **guided**: 実装前に install 済み SKILL.md の手順どおり、機能ごとにガイドを
  検索(`search` 6クエリ)・取得(`retrieve` 10ガイド)してから実装。
  差を無理に作らず、ガイドに従っても変わらない部分はそのままにした。
- backend は両側とも同一コード(ガイダンスは設計上 backend 対象外。第1段階で確認済み)。

## 1. 追加した機能の概要(両側共通の仕様)

| 領域 | 内容 |
|------|------|
| backend 認証 | `POST /api/login`(固定デモユーザー demo@example.com / password、トークン発行)、`POST /api/logout`、`GET /api/me`(Bearer 検証)。セッションはインメモリ Map |
| backend 集計 | `GET /api/stats`(登録数・合計・カテゴリ数・平均・最新日を items から集計) |
| backend items | `GET /api/items` を拡張(名前・カテゴリ・数値・日付を持つ10件)。認証必須に変更 |
| frontend ログイン | メール+パスワード、入力エラー表示、成功でダッシュボードへ。トークンは localStorage |
| frontend ダッシュボード | サイドバー付きシェル(ダッシュボード/一覧/設定の3ビュー)、統計カード4個(API連動) |
| frontend 一覧 | 列見出しクリックでソートできるテーブル、行選択で詳細ダイアログ |

コード量: frontend は App.tsx が plain 300行 → guided 504行、App.css が plain 238行 →
guided 442行。**ガイド適用側のほうが約1.7倍に増えた**(フォールバック、ARIA 同期、
コンテナクエリの分)。「モダン化=コードが短くなる」ではない、というのも本検証の所見である。

## 2. guided 側で取得したガイドの一覧

検索クエリ: `form validation errors` / `login form autofill` / `light dismiss dialog` /
`sortable data table` / `responsive sidebar layout` / `page view transitions`(計6回)

| # | ガイドID | 使った箇所 | 効いたか |
|---|----------|-----------|----------|
| 1 | `autofill-sign-in-form` | ログインフォーム全体 | ◎ 効いた。`autocomplete="username"`(メール欄)/`current-password`、`required`、`<label for>`、安定した name/id など、フォームの骨格がガイドで確定した |
| 2 | `validate-input-after-interaction` | ログインの入力エラー表示 | ◎ 効いた。`:user-invalid` で「操作後にだけ」エラーを出す方式になり、表示タイミングの自前管理が不要になった |
| 3 | `accessible-error-announcement` | `aria-invalid` と `aria-describedby` の同期 | ○ 効いた。ただしガイドの汎用スクリプトはそのまま使えず、React の onBlur/onInput で `:user-invalid` との同期ブリッジを再実装した |
| 4 | `dialog` | 詳細ダイアログ | ◎ 効いた。ネイティブ `<dialog>` + `showModal()` で、フォーカストラップ・Esc処理・背景 inert・フォーカス復帰がすべてブラウザ提供に置き換わった |
| 5 | `light-dismiss-a-dialog` | ダイアログの外側クリック閉じ | ○ 効いた。`closedby="any"` が宣言的。未対応ブラウザ(Safari)向けにポインタ位置判定のフォールバック追加が必要だった |
| 6 | `sortable-table` | テーブルの見出し・ソート状態・比較 | △ 大部分は効いた(`aria-sort`、`<th>` 内ボタン、`caption`、`Intl.Collator`)。ただし「既存の `<tr>` を `moveBefore` で動かし再レンダリング禁止」という中核ルールは React の宣言的レンダリングと衝突し**不採用**(後述) |
| 7 | `responsive-table` | テーブルのスクロール領域・狭幅表示 | ◎ 効いた。`role="region"` + `tabindex="0"`、sticky 見出し、`@container` によるカード化(ラベル注入)まで一式が決まった |
| 8 | `dynamic-sort` | ソート時のアニメーションと通知 | ○ 効いた。並び替えを View Transition 化し、`role="status"` で結果を1回だけ通知。`moveBefore` の指定は #6 と同じ理由でキー再利用に代替 |
| 9 | `same-document-transitions` | ビュー切替(ダッシュボード/一覧/設定) | ○ 効いた。切替を `document.startViewTransition` で包み、遷移後に新しい見出しへフォーカスを誘導。共有要素のモーフィングは今回対象がなく未使用 |
| 10 | `size-aware-styling` | 統計カードの並び | ◎ 効いた。`@container` で「置かれた場所の幅」に反応するカードになり、ビューポート前提のメディアクエリが不要になった |

## 3. コードの主な差分

### 差分1: 詳細ダイアログ — 手書きオーバーレイ → ネイティブ `<dialog>`

plain(手書きの overlay div。Esc・フォーカストラップ・背景固定は未実装が普通):

```tsx
{selected && (
  <div className="modal-overlay" onClick={() => setSelected(null)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h3>{selected.name}</h3>
      ...
      <button onClick={() => setSelected(null)}>閉じる</button>
    </div>
  </div>
)}
```

guided(ガイド `dialog` / `light-dismiss-a-dialog`):

```tsx
<dialog ref={dialogRef} className="detail-dialog"
        aria-labelledby="item-detail-title"
        onClose={() => setSelected(null)}
        {...({ closedby: "any" } as Record<string, string>)}>
  ...
  <form method="dialog">
    <button type="submit" autoFocus>閉じる</button>
  </form>
</dialog>
```

開くのは `dialog.showModal()` の1行。inert 化、フォーカス閉じ込め、Esc、閉じた後の
フォーカス復帰はブラウザが担うため、自前の実装が消えた。逆に増えたのは
`closedby` 未対応ブラウザ向けのフォールバック(約25行)と、`dialog:modal` の
`overscroll-behavior: contain` 指定である。

### 差分2: テーブル見出し — `<th onClick>` → `aria-sort` + ボタン

plain(見出しセル自体をクリック可能にし、矢印を文字列で描く):

```tsx
<th className="sortable-th" onClick={() => handleHeaderClick(col.key)}>
  {col.label}
  {sortKey === col.key ? (sortAsc ? " ▲" : " ▼") : ""}
</th>
```

guided(ガイド `sortable-table`。状態は `aria-sort` が持ち、矢印は CSS が描く):

```tsx
<th scope="col" aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : undefined}>
  <button type="button" onClick={() => handleSort(col.key)}>
    {col.label}
    <span className="sort-icon" aria-hidden="true" />
  </button>
</th>
```

加えて `<caption>` がテーブルのアクセシブル名になり、スクロール領域は
`role="region"` + `tabindex="0"` になった(ガイド `responsive-table`)。
ソートのたびに `role="status"` へ「名前の昇順で並び替えました。全10件」と
1回だけ通知する(ガイド `dynamic-sort`)。plain には通知自体がない。

### 差分3: 比較ロジック — `localeCompare` → 型別の比較

plain:

```ts
cmp = String(av).localeCompare(String(bv)); // 数値も日付も文字列化して比較
```

guided(ガイド `sortable-table`:文字列は `Intl.Collator`、数値と日付は数値として):

```ts
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
// value: a.value - b.value / date: Date.parse(a.date) - Date.parse(b.date)
// name・category: collator.compare(...)
```

今回はデータが素直だったため結果は一致したが、「1,200」のような書式付き表示を
文字列ソートする事故を構造的に避ける形になった。

### 差分4: ログインフォームのエラー表示

plain は送信時に自前チェックし、エラー文を `<p>` で出すだけ。guided は
`required` + `type="email"` のネイティブ検証に寄せ、視覚表示は CSS
`input:user-invalid ~ .error-msg` が担い、`aria-invalid` は
`:user-invalid` との同期ブリッジで後追いさせる
(ガイド `validate-input-after-interaction` / `accessible-error-announcement`)。
「入力途中に赤くしない」「支援技術にも操作後だけ伝える」が両立した。
また `autocomplete` が付き、パスワードマネージャーが正しく働く形になった
(ガイド `autofill-sign-in-form`)。

### 差分5: 統計カードとテーブルのレスポンシブ

plain は `display: flex` + 固定幅 180px + `@media (max-width: 768px)`。
guided は統計カードが `@container` で**コンテナ幅**に反応(1列→2列→4列)し、
テーブルは幅 600px 未満で**行がカード化**し、`::before` で列ラベルを注入する
(ガイド `size-aware-styling` / `responsive-table`)。
サイドバーに潰されるような配置でも崩れないのは guided 側だけである。

## 4. 変わらなかった点

- **backend はバイト単位で完全同一**(123行)。認証もセッションも集計も、
  ガイドに参照すべきものがなく、第1段階に続き「backend は対象外」が再確認された。
- **API クライアント(api.ts)は両側同一**。トークンの localStorage 保持と
  fetch ラッパに該当するガイドはなかった。
- **画面構成・文言・データ・API 仕様は同一**。見た目の第一印象も大きくは変わらない。
- **サーバーエラー(401)の表示**は両側とも単純な赤文字メッセージ
  (guided は `role="alert"` を付けた程度)。
- **設定画面**はほぼ同一。guided で増えたのは見出しのフォーカス受け取り
  (`tabIndex={-1}` と ref)だけ。
- **ソートの基本挙動**(クリックで切替、別列は昇順から、安定ソート)は両側同じ。
- **ログインの成功/失敗フロー、未認証時の 401 ハンドリング**も同一実装。

### React とぶつかった点(正直な記録)

`sortable-table` / `dynamic-sort` の中核ルール「既存の DOM ノードを
`moveBefore` で並べ替え、再レンダリングするな」は、React の
「状態から描画する」モデルと正面から衝突した。guided では
**キーの安定による DOM ノード再利用**を前提に、状態更新を
`flushSync` + `document.startViewTransition` で包む代替に置き換えた。
行内にフォーム等の状態がない本検証では実害はないが、「ガイドの指示が
フレームワークではそのまま実行できない」ことが分かったのは収穫である。
同様に `accessible-error-announcement` の汎用スクリプトも、
React ではイベントハンドラへの翻訳が必要だった。

## 5. ビルド・動作確認

両側とも /tmp にコピーして `npm install` から実施
(ワークスペースに node_modules / dist は残していない)。

| 対象 | 結果 |
|------|------|
| plain frontend | `npm run build`(tsc -b && vite build)成功(CSS 4.26 kB / JS 225.34 kB) |
| guided frontend | 同上、成功(CSS 7.79 kB / JS 228.19 kB) |
| plain backend | `tsc` 成功。認証フロー全段を curl で確認(下表) |
| guided backend | `tsc` 成功。同スクリプトで同一結果 |

curl による認証フロー確認(両側とも同じ結果):

| 手順 | 結果 |
|------|------|
| パスワード誤りでログイン | 401 |
| 正しい資格情報でログイン | 200 + トークン発行 |
| `GET /api/me`(トークンあり) | 200 `{"email":"demo@example.com","name":"Demo User"}` |
| `GET /api/stats`(トークンあり) | 200 `{totalItems:10, totalValue:18420, categoryCount:6, averageValue:1842, latestDate:"2026-11-12"}` |
| `GET /api/items`(トークンあり) | 200、10件 |
| `GET /api/items`(トークンなし) | 401 |
| `POST /api/logout` | 204 |
| ログアウト後に `GET /api/me` | 401 |

## 6. 結論

セットアップ段階ではほぼ無風だったガイダンスは、実装フェーズでは「部品の作り」を明確に変えた。
ダイアログは手書きオーバーレイからネイティブ `<dialog>` へ、テーブルのソートは
クリック可能な見出しから `aria-sort` と支援技術への通知を持つ構造へ、
フォームのエラーは「送信してから怒る」から「操作後にだけ静かに伝える」へ置き換わった。
一方で backend と API クライアントは完全に無風で、ガイドの射程はブラウザ側の部品に限られる。
そしてガイド適用はコードを約1.7倍に増やす——品質と引き換えの手間であり、
React では一部ルールが翻訳を要することも含め、「入れて終わり」ではなく「読みながら書く」道具だった。
