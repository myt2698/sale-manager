import { useCallback, useMemo, useState, useEffect } from "react";

const AUTH_KEY = "sales-sys-auth-user";

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "sales" | "finance";
  avatar?: string | null;
}

const MOCK_USERS: AppUser[] = [
  { id: 1, name: "管理员", email: "admin@example.com", role: "admin" },
  { id: 2, name: "张三", email: "zhangsan@example.com", role: "sales" },
  { id: 3, name: "李四", email: "lisi@example.com", role: "finance" },
  { id: 4, name: "王五", email: "wangwu@example.com", role: "sales" },
];

function loadUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveUser(user: AppUser | null) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
}

export function useAuth(_options?: any) {
  const [user, setUser] = useState<AppUser | null>(loadUser);

  useEffect(() => {
    saveUser(user);
  }, [user]);

  const login = useCallback((userId: number) => {
    const found = MOCK_USERS.find((u) => u.id === userId);
    if (found) setUser(found);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    saveUser(null);
    window.location.href = "/#/login";
  }, []);

  return useMemo(
    () => ({
      user,
      users: MOCK_USERS,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
      login,
      logout,
      refresh: () => {},
    }),
    [user, login, logout]
  );
}
