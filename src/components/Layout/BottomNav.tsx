import React, { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  FaceSmileIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from '@heroicons/react/24/solid';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  iconActive: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Hem', icon: HomeIcon, iconActive: HomeIconSolid },
  { path: '/mood-basic', label: 'Humör', icon: FaceSmileIcon, iconActive: FaceSmileIconSolid },
  { path: '/ai-chat', label: 'AI', icon: ChatBubbleLeftRightIcon, iconActive: ChatBubbleLeftRightIconSolid },
  { path: '/profile', label: 'Profil', icon: UserCircleIcon, iconActive: UserCircleIconSolid },
  // Hidden for v1.0: wellness - will be revealed progressively
];

/**
 * Bottom Navigation Component
 * 
 * Mobile-only bottom navigation bar with 5 main links.
 * Optimized with React.memo and useMemo for performance.
 * 
 * @component
 * @example
 * <BottomNav />
 */
const BottomNav: React.FC = memo(() => {
  const location = useLocation();
  
  // Memoize nav items rendering
  const navItemsRendered = useMemo(() => (
    NAV_ITEMS.map((item) => {
      const active = location.pathname === item.path;
      const Icon = active ? item.iconActive : item.icon;

      return (
        <Link
          key={item.path}
          to={item.path}
          className={`
            flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-xl transition-all duration-200
            ${active 
              ? 'text-[#2c8374]' 
              : 'text-[#a89f97] hover:text-[#6d645d] dark:text-gray-500 dark:hover:text-gray-300'
            }
          `}
          aria-current={active ? 'page' : undefined}
        >
          <div className={`
            relative p-2 rounded-xl transition-all duration-200
            ${active ? 'bg-[#2c8374]/10' : ''}
          `}>
            <Icon className="w-6 h-6" />
            {active && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#2c8374] rounded-full" />
            )}
          </div>
          <span className={`
            text-[10px] font-medium mt-1 transition-all duration-200
            ${active ? 'text-[#2c8374] font-semibold' : ''}
          `}>
            {item.label}
          </span>
        </Link>
      );
    })
  ), [location.pathname]);

  return (
    <nav 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-[#f2e4d4] dark:border-slate-700 safe-area-pb"
      aria-label="Mobilnavigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItemsRendered}
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
