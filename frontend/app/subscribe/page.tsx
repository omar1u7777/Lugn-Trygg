'use client';

import useAuth from '../../src/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import SubscriptionForm from '../../src/components/SubscriptionForm';

export default function SubscribePage() {
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

  return <SubscriptionForm />;
}