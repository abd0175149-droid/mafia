import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Phygital Mafia Engine | محرك المافيا الهجين',
  description: 'نظام متطور لإدارة ألعاب المافيا الهجينة - يدمج بين التواجد الفعلي والإدارة الرقمية اللحظية',
  keywords: ['mafia', 'game', 'phygital', 'مافيا', 'لعبة'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-dark-900 text-white font-arabic antialiased">
        {children}
      </body>
    </html>
  );
}
