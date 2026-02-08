/**
 * Analytics Charts Component
 * Displays visual analytics for user data including mood trends, activity patterns, and wellness metrics
 * Temporarily using placeholder until Recharts hooks issue is resolved
 */

import React from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import useAuth from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/tailwind/Card';
import { Alert } from '@/components/ui/tailwind/Feedback';
import { Spinner } from '@/components/ui/tailwind/Display';

interface AnalyticsChartsProps {
  /** Optional className for styling */
  className?: string;
}

/**
 * AnalyticsCharts - Displays user analytics in chart format
 * Currently shows summary statistics until chart library is stabilized
 */
const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ className }) => {
  const { user } = useAuth();
  const { stats, loading, error, refresh } = useDashboardData(user?.user_id);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="error">
            Failed to load analytics data.{' '}
            <button
              onClick={refresh}
              className="underline hover:no-underline"
              aria-label="Retry loading analytics"
            >
              Try again
            </button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!stats || (!stats.totalMoods && !stats.totalChats)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No analytics data available yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Start logging your mood and activities to see insights here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Moods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMoods}</div>
            <p className="text-xs text-muted-foreground">
              Mood entries logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Mood</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageMood.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of 10 scale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Streak Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.streakDays}</div>
            <p className="text-xs text-muted-foreground">
              Consecutive days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.weeklyProgress}/{stats.weeklyGoal}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for Charts - To be implemented with stable chart library */}
      <Card>
        <CardHeader>
          <CardTitle>Mood Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">
                📊 Charts Coming Soon
              </p>
              <p className="text-sm text-muted-foreground">
                Visual analytics will be available once chart library is stabilized
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b border-muted last:border-b-0"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-sm capitalize">{activity.type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {activity.timestamp.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No recent activity to display
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Performance optimization with React.memo
export default React.memo(AnalyticsCharts);
