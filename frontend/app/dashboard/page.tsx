'use client';

import useAuth from '../../src/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Dashboard from '../../src/components/Dashboard/Dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return <Dashboard />;
}