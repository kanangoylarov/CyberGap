import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function AppLayout() {
  return (
    <div id="app">
      <Sidebar />
      <main id="main">
        <div className="page active">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
