import { useEffect, useMemo, useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    const res = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError("メールアドレスまたはパスワードが違います。");
      return;
    }
    const data = (await res.json()) as { token: string };
    setToken(data.token);
    onLogin();
  }

  return (
    <div className="login-wrap">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>ログイン</h1>
        <label className="field">
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary-button">
          ログイン
        </button>
        <p className="demo-hint">デモ用: demo@example.com / password</p>
      </form>
    </div>
  );
}

function DashboardView() {
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
      <h2>ダッシュボード</h2>
      <div className="stat-cards">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <p className="stat-label">{card.label}</p>
            <p className="stat-value">{card.value}</p>
          </div>
        ))}
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

function ItemsView() {
  const [items, setItems] = useState<Item[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    api("/api/items")
      .then((res) => res.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortAsc]);

  function handleHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div>
      <h2>一覧</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="sortable-th"
                  onClick={() => handleHeaderClick(col.key)}
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? " ▲" : " ▼") : ""}
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
                <td>{item.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.name}</h3>
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
                <dd>{selected.date}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => setSelected(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsView({ me }: { me: Me | null }) {
  return (
    <div>
      <h2>設定</h2>
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
        <nav className="side-nav">
          <button
            type="button"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
            ダッシュボード
          </button>
          <button
            type="button"
            className={view === "items" ? "active" : ""}
            onClick={() => setView("items")}
          >
            一覧
          </button>
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
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
        {view === "dashboard" && <DashboardView />}
        {view === "items" && <ItemsView />}
        {view === "settings" && <SettingsView me={me} />}
      </main>
    </div>
  );
}
