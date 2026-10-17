import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Mailbox from "./pages/Mailbox";
import EmailDetail from "./pages/EmailDetail";
import Compose from "./pages/Compose";
import { api } from "./lib/api";
import type { User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  const logout = async () => { await api.logout(); setUser(null); };

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={logout} />}>
          <Route path="/scheduled" element={<Mailbox kind="scheduled" />} />
          <Route path="/sent" element={<Mailbox kind="sent" />} />
        </Route>
        <Route path="/email/:id" element={<EmailDetail />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/dashboard" element={<Navigate to="/scheduled" />} />
        <Route path="*" element={<Navigate to="/scheduled" />} />
      </Routes>
    </BrowserRouter>
  );
}
