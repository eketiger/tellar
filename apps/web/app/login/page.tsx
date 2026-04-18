'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('martin@tellar.studio');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', json: { email, password } });
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'github') {
    setBusy(true);
    try {
      await api(`/auth/oauth/${provider}`);
      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      mode="login"
      onSubmit={onSubmit}
      onOauth={oauth}
      err={err}
      busy={busy}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
    />
  );
}
