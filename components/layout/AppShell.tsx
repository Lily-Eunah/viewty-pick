import React from 'react';
import BottomTabBar from './BottomTabBar';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: 'home' | 'category' | 'search' | 'wishlist' | 'my';
  showTabBar?: boolean;
}

export default function AppShell({
  children,
  activeTab = 'home',
  showTabBar = true,
}: AppShellProps) {
  return (
    <div className="w-full min-h-screen bg-[#F0EEE2] flex justify-center items-start overflow-x-hidden font-sans">
      {/* Mobile-centric Frame container */}
      <div className="w-full max-w-[430px] min-h-screen bg-bg shadow-xl flex flex-col relative pb-[80px]">
        <main className="w-full flex-grow flex flex-col">
          {children}
        </main>

        {showTabBar && <BottomTabBar activeTab={activeTab} />}
      </div>
    </div>
  );
}
