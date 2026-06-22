import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from '@/contexts/SocketContext';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'SyncWave — Synchronized Speaker System',
  description:
    'Turn multiple phones into a single synchronized speaker system. Play music across all devices with less than 50ms drift.',
  keywords: 'synchronized music, multi-device audio, party speaker, sync music',
  openGraph: {
    title: 'SyncWave',
    description: 'Your phones, one sound.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#080810" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <SocketProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#1e1e30',
                color: '#f8f8ff',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
              },
              success: {
                iconTheme: { primary: '#1ed760', secondary: '#000' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </SocketProvider>
      </body>
    </html>
  );
}
