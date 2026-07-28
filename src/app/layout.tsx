import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AE Project Manager | АзияЭнергоАвтоматика',
  description: 'Система управления инженерными проектами ТОО «АзияЭнергоАвтоматика» с Telegram и ИИ интеграцией.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
