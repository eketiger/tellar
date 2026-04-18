'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from '../login/page';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', json: { name, email, password } });
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Registration failed');
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

  return <AuthShell mode="register" onSubmit={onSubmit} onOauth={oauth} err={err} busy={busy}
    name={name} setName={setName}
    email={email} setEmail={setEmail}
    password={password} setPassword={setPassword} />;
}
