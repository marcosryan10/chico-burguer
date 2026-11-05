import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Chico Burguer — Pra fome de verdade.',
  description: 'Lanches, omeletes e bebidas. Faça seu pedido no Chico Burguer.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#8b281c" />
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/orders.css" />
      </head>
      <body>
        <script src="/navigation.js" defer />
        {children}
      </body>
    </html>
  );
}
