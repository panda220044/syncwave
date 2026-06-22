'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinRedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Store intent in sessionStorage so room page knows to join this code
    sessionStorage.setItem('joinCode', code.toUpperCase());
    router.replace(`/room/${code.toUpperCase()}`);
  }, [code, router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
        <p className="text-secondary">Joining room {code.toUpperCase()}...</p>
      </div>
    </div>
  );
}
