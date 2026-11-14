const TOKEN_KEY = "gst-token";
const API_BASE = "http://localhost:3001";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export type Me = { email: string; name: string };

export type Stats = {
  totalItems: number;
  totalValue: number;
  categoryCount: number;
  averageValue: number;
  latestDate: string;
};

export type Item = {
  id: number;
  name: string;
  category: string;
  value: number;
  date: string;
};
