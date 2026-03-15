import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">{children}</main>
      <footer className="bg-gray-800 text-gray-300 text-center py-4 text-sm">
        &copy; {new Date().getFullYear()} Store. All rights reserved.
      </footer>
    </div>
  );
}
