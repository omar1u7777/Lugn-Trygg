import React, { useRef, useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon 
} from '@heroicons/react/24/outline';

interface TabItem {
  icon: React.ReactNode;
  label: string;
  index: number;
}

interface ScrollableTabsProps {
  tabs: TabItem[];
  activeTab: number;
  onTabChange: (index: number) => void;
  ariaLabel?: string;
}

const ScrollableTabs: React.FC<ScrollableTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Tabs'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    
    setShowLeftShadow(scrollLeft > 0);
    setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const handleScroll = () => {
    updateScrollState();
  };

  const scrollLeft = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    el.scrollBy({ left: 200, behavior: 'smooth' });
  };

  // Update scroll state on mount and when tabs change
  useEffect(() => {
    updateScrollState();
    
    // Also update after a short delay to account for any layout shifts
    const timeout = setTimeout(updateScrollState, 100);
    
    // Add resize listener
    window.addEventListener('resize', updateScrollState);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [tabs]);

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const activeTabElement = el.querySelector(`[data-tab-index="${activeTab}"]`) as HTMLElement;
    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      const { clientWidth } = el;
      
      // Check if active tab is partially hidden
      if (offsetLeft < el.scrollLeft) {
        // Tab is to the left of visible area
        el.scrollTo({ left: offsetLeft - 20, behavior: 'smooth' });
      } else if (offsetLeft + offsetWidth > el.scrollLeft + clientWidth) {
        // Tab is to the right of visible area
        el.scrollTo({ left: offsetLeft - clientWidth + offsetWidth + 20, behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  return (
    <div className="relative">
      {/* Left shadow indicator */}
      {showLeftShadow && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent dark:from-slate-900 z-10 pointer-events-none" />
      )}
      
      {/* Right shadow indicator */}
      {showRightShadow && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-slate-900 z-10 pointer-events-none" />
      )}

      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll left"
        >
          <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll right"
        >
          <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Tabs container */}
      <nav
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth scrollbar-hide"
        role="tablist"
        aria-label={ariaLabel}
        onScroll={handleScroll}
      >
        {tabs.map((tab) => (
          <button
            key={tab.index}
            data-tab-index={tab.index}
            onClick={() => onTabChange(tab.index)}
            role="tab"
            className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              activeTab === tab.index
                ? 'border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
            id={`profile-tab-${tab.index}`}
            aria-controls={`profile-tabpanel-${tab.index}`}
            aria-selected={activeTab === tab.index}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {/* Mobile-only indicator */}
            <span className="sm:hidden text-xs">
              {tab.label.slice(0, 3)}
            </span>
          </button>
        ))}
      </nav>

      {/* Scroll hint for mobile */}
      {showRightShadow && (
        <div className="absolute bottom-0 right-0 flex items-center gap-1 px-2 py-1 bg-gradient-to-l from-gray-100 dark:from-slate-800 to-transparent">
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse delay-75" />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse delay-150" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrollableTabs;
