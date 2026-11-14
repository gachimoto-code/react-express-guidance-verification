import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  api,
  getToken,
  setToken,
  type Item,
  type Me,
  type Stats,
} from "./api";
import "./App.css";

type View = "dashboard" | "items" | "settings";
type SortKey = "name" | "category" | "value" | "date";

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [serverError, setServerError] = useState("");
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);

  // Guidance (accessible-error-announcement): keep aria-invalid in sync with
  // the visual :user-invalid state, so the error is exposed to assistive
  // technology only after interaction — mirroring the visual experience.
  // aria-invalid starts at "false" rather than unset (Firefox/Safari expose
  // an empty required field as invalid from page load otherwise).
  const syncEmail = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setEmailInvalid(e.currentTarget.matches(":user-invalid"));
  const syncPassword = (e: React.SyntheticEvent<HTMLInputElement>) =>
    setPasswordInvalid(e.currentTarget.matches(":user-invalid"));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    const form = new FormData(e.currentTarget);
    const res = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (!res.ok) {
      setServerError("メールアドレスまたはパスワードが違います。");
      return;
    }
    const data = (await res.json()) as { token: string };
    setToken(data.token);
    onLogin();
  }

  return (
    <div className="login-wrap">
      {/* Guidance (autofill-sign-in-form): a real <form>, stable name/id,
          autocomplete="username" for the email identifier and
          autocomplete="current-password" + required on the password. */}
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>ログイン</h1>
        <div className="field">
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={emailInvalid}
            aria-describedby={emailInvalid ? "email-error" : undefined}
            data-error="email-error"
            onBlur={syncEmail}
            onInput={syncEmail}
          />
          <span id="email-error" className="error-msg">
            <span role="img" aria-label="Error">
              ❌
            </span>{" "}
            メールアドレスの形式で入力してください。
          </span>
        </div>
        <div className="field">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            enterKeyHint="done"
            aria-invalid={passwordInvalid}
            aria-describedby={passwordInvalid ? "password-error" : undefined}
            data-error="password-error"
            onBlur={syncPassword}
            onInput={syncPassword}
          />
          <span id="password-error" className="error-msg">
            <span role="img" aria-label="Error">
              ❌
            </span>{" "}
            パスワードを入力してください。
          </span>
        </div>
        {serverError && (
          <p className="server-error" role="alert">
            {serverError}
          </p>
        )}
        <button type="submit" className="primary-button">
          ログイン
        </button>
        <p className="demo-hint">デモ用: demo@example.com / password</p>
      </form>
    </div>
  );
}

function DashboardView({
  headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api("/api/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!stats) return <p>読み込み中…</p>;

  const cards = [
    { label: "登録数", value: String(stats.totalItems) },
    { label: "合計値", value: stats.totalValue.toLocaleString() },
    { label: "カテゴリ数", value: String(stats.categoryCount) },
    { label: "平均値", value: stats.averageValue.toLocaleString() },
  ];

  return (
    <div>
      <h2 tabIndex={-1} ref={headingRef}>
        ダッシュボード
      </h2>
      {/* Guidance (size-aware-styling): the cards adapt to the width of
          their container via @container, not the viewport. */}
      <div className="stats-container">
        <div className="stat-cards">
          {cards.map((card) => (
            <div key={card.label} className="stat-card">
              <p className="stat-label">{card.label}</p>
              <p className="stat-value">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
      <p>最新データ日: {stats.latestDate}</p>
    </div>
  );
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "名前" },
  { key: "category", label: "カテゴリ" },
  { key: "value", label: "数値" },
  { key: "date", label: "日付" },
];

// Guidance (sortable-table): compare text with Intl.Collator
// (numeric: true, sensitivity: "base"), numbers and dates as numbers —
// never sort the formatted display strings.
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareItems(a: Item, b: Item, key: SortKey): number {
  switch (key) {
    case "value":
      return a.value - b.value;
    case "date":
      return Date.parse(a.date) - Date.parse(b.date);
    default:
      return collator.compare(a[key], b[key]);
  }
}

function ItemsView({
  headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [sortMessage, setSortMessage] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    api("/api/items")
      .then((res) => res.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // Guidance (dialog): open the native <dialog> with showModal(); the
  // browser provides inertness, focus containment, Esc dismissal and
  // focus return to the invoker — no hand-rolled focus trap.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) {
      dialog.showModal();
    } else if (!selected && dialog.open) {
      dialog.close();
    }
  }, [selected]);

  // Guidance (light-dismiss-a-dialog): closedby="any" gives light dismiss
  // where supported; add the pointer-position fallback where it is not
  // (Safari). Press and release must both be outside so a text-selection
  // drag ending on the backdrop does not dismiss.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ("closedBy" in HTMLDialogElement.prototype) return;
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const cmp = compareItems(a, b, sortKey);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    const nextAsc = key === sortKey ? !sortAsc : true;
    // Guidance (dynamic-sort): animate the reorder with a view transition.
    // In React the DOM update is a state change, so it is wrapped with
    // flushSync; rows keep their DOM identity through their keys and are
    // matched by view-transition-name: match-element (see App.css).
    const update = () =>
      flushSync(() => {
        setSortKey(key);
        setSortAsc(nextAsc);
      });
    if (typeof document.startViewTransition === "function") {
      document.startViewTransition(update);
    } else {
      update();
    }
    // Guidance (dynamic-sort / sortable-table): announce the result once
    // through a single role="status" element — never aria-live on the table.
    const col = COLUMNS.find((c) => c.key === key);
    setSortMessage(
      `${col?.label}の${nextAsc ? "昇順" : "降順"}で並び替えました。全${items.length}件`,
    );
  }

  return (
    <div>
      <h2 tabIndex={-1} ref={headingRef}>
        一覧
      </h2>
      <p role="status" className="visually-hidden">
        {sortMessage}
      </p>
      {/* Guidance (responsive-table): the scroll container is a named
          region that keyboard users can scroll, labelled by the caption. */}
      <div
        className="table-wrapper"
        role="region"
        aria-labelledby="items-caption"
        tabIndex={0}
      >
        <table className="data-table">
          {/* Guidance (sortable-table): the caption is the table's
              accessible name; sort state lives in aria-sort on the <th>,
              and each sortable header contains a real <button>. */}
          <caption id="items-caption">
            アイテム一覧（行を選ぶと詳細が開きます）
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    sortKey === col.key
                      ? sortAsc
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <button type="button" onClick={() => handleSort(col.key)}>
                    {col.label}
                    <span className="sort-icon" aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} onClick={() => setSelected(item)}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.value.toLocaleString()}</td>
                <td>
                  <time dateTime={item.date}>{item.date}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Guidance (dialog / light-dismiss-a-dialog): native modal dialog.
          closedby is spread with a cast because React's types do not know
          the newly shipped attribute yet. */}
      <dialog
        ref={dialogRef}
        className="detail-dialog"
        aria-labelledby="item-detail-title"
        onClose={() => setSelected(null)}
        {...({ closedby: "any" } as Record<string, string>)}
      >
        {selected && (
          <>
            <h3 id="item-detail-title">{selected.name}</h3>
            <dl className="detail-list">
              <div>
                <dt>カテゴリ</dt>
                <dd>{selected.category}</dd>
              </div>
              <div>
                <dt>数値</dt>
                <dd>{selected.value.toLocaleString()}</dd>
              </div>
              <div>
                <dt>日付</dt>
                <dd>
                  <time dateTime={selected.date}>{selected.date}</time>
                </dd>
              </div>
            </dl>
            <form method="dialog">
              <button type="submit" autoFocus>
                閉じる
              </button>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
}

function SettingsView({
  me,
  headingRef,
}: {
  me: Me | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div>
      <h2 tabIndex={-1} ref={headingRef}>
        設定
      </h2>
      <dl className="detail-list">
        <div>
          <dt>名前</dt>
          <dd>{me?.name ?? "-"}</dd>
        </div>
        <div>
          <dt>メールアドレス</dt>
          <dd>{me?.email ?? "-"}</dd>
        </div>
      </dl>
      <p>この検証用のダミー設定画面です。</p>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => !!getToken());
  const [view, setView] = useState<View>("dashboard");
  const [me, setMe] = useState<Me | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    api("/api/me")
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then(setMe)
      .catch(() => {
        setToken(null);
        setLoggedIn(false);
      });
  }, [loggedIn]);

  // Guidance (same-document-transitions): wrap SPA view changes in
  // document.startViewTransition, and route focus to the new view's
  // heading afterwards — view transitions do not manage focus, so
  // without this a keyboard user loses their place.
  function navigate(next: View) {
    if (next === view) return;
    const update = () => flushSync(() => setView(next));
    const focusHeading = () => headingRef.current?.focus();
    if (typeof document.startViewTransition === "function") {
      const transition = document.startViewTransition(update);
      transition.finished.finally(focusHeading);
    } else {
      update();
      focusHeading();
    }
  }

  async function handleLogout() {
    await api("/api/logout", { method: "POST" }).catch(() => undefined);
    setToken(null);
    setMe(null);
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <LoginForm onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <p className="brand">guidance setup test</p>
        <nav className="side-nav" aria-label="メインメニュー">
          <button
            type="button"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            ダッシュボード
          </button>
          <button
            type="button"
            className={view === "items" ? "active" : ""}
            onClick={() => navigate("items")}
          >
            一覧
          </button>
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            設定
          </button>
        </nav>
        <div className="sidebar-footer">
          <p className="user-email">{me?.email ?? ""}</p>
          <button type="button" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </aside>
      <main className="main">
        {view === "dashboard" && <DashboardView headingRef={headingRef} />}
        {view === "items" && <ItemsView headingRef={headingRef} />}
        {view === "settings" && (
          <SettingsView me={me} headingRef={headingRef} />
        )}
      </main>
    </div>
  );
}
