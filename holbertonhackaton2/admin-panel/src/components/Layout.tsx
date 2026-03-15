import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
