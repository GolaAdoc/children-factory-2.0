import type { ReactNode } from 'react';

export const metadata = {
  title: 'Webstore',
  description: 'Storefront scaffold',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
