import type { Metadata } from 'next';
import Script from 'next/script';
import { AgentationGuard } from '@/components/AgentationGuard';
import { HappySeedsWatermark } from '@/components/HappySeedsWatermark';
import './globals.css';

export const metadata: Metadata = {
  title: 'speceEMAIL — Sistema de E-mail Empresarial',
  description: 'Gerencie e-mails corporativos com R$ 20,00/mês e 10 GB por usuário.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {process.env.NODE_ENV === 'production' && (
          <Script
            async
            src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </head>
      <body>
        {children}
        <HappySeedsWatermark />
        <AgentationGuard />
      </body>
    </html>
  );
}
