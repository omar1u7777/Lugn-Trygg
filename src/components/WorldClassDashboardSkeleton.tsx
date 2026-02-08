import React from 'react';
import { Card } from './ui/tailwind/Card';
import { cn } from '../utils/cn';

const SkeletonLine = ({ className }: { className?: string }) => (
  <div className={cn('h-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse', className)}></div>
);

const QuickActionSkeleton = () => (
  <Card className="p-6 text-center">
    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true"></div>
    <SkeletonLine className="w-3/4 h-5 mx-auto mb-2" />
    <SkeletonLine className="w-full h-4 mx-auto mb-4" />
    <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" aria-hidden="true"></div>
  </Card>
);

const ActivitySkeleton = () => (
  <Card>
    <div className="p-6 space-y-5">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-1/2" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true"></div>
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-3/4" />
              <SkeletonLine className="w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </Card>
);

const WorldClassDashboardSkeleton: React.FC = () => (
  <div className="world-class-dashboard relative" aria-hidden="true" data-testid="dashboard-skeleton">
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <div className="h-16 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 animate-pulse"></div>
    </div>

    <div className="world-class-dashboard-content px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      <Card className="overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-32 h-32 rounded-3xl bg-gray-100 dark:bg-gray-700 animate-pulse" aria-hidden="true"></div>
          <div className="flex-1 w-full space-y-4">
            <SkeletonLine className="w-32" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="w-5/6" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={`stat-${idx}`} className="p-6 space-y-4 h-36">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="w-2/3" />
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true"></div>
          <div className="flex-1">
            <SkeletonLine className="w-48" />
            <SkeletonLine className="w-32 h-3 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <QuickActionSkeleton key={`qa-${idx}`} />
          ))}
        </div>
      </section>

      <Card>
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            <div className="flex-1">
              <SkeletonLine className="w-40" />
              <SkeletonLine className="w-24 h-3 mt-2" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`rec-${idx}`} className="h-16 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 animate-pulse"></div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="world-class-dashboard-card world-class-dashboard-card-premium">
        <div className="p-6 sm:p-8 space-y-4">
          <SkeletonLine className="w-40" />
          <SkeletonLine className="w-56" />
          <div className="h-3 bg-white/40 rounded-full animate-pulse"></div>
          <div className="flex items-center gap-4">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-24" />
          </div>
        </div>
      </Card>

      <ActivitySkeleton />
    </div>
  </div>
);

export default WorldClassDashboardSkeleton;
