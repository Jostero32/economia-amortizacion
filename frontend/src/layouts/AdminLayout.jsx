import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fc]">
      <Navbar />
      <div className="flex-1 pt-20 max-w-[1440px] w-full mx-auto flex">
        <Sidebar mode="admin" />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
