/**
 * Mood Heatmap Component
 * 24h x 7d visualization of mood patterns
 * Shows when user typically feels best/worst
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getMoods } from '../../api/api';
import useAuth from '../../hooks/useAuth';
import { Card } from '../ui/tailwind';
import { logger } from '../../utils/logger';

interface HeatmapCell {
  hour: number;
  day: number;
  averageScore: number;
  count: number;
}

const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const MoodHeatmap: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMoodData = useCallback(async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);
      const moods = await getMoods(user.user_id);
      
      // Process moods into heatmap cells
      const cellMap = new Map<string, { scores: number[]; count: number }>();

      moods.forEach((mood) => {
        const rawMood = mood as { score?: number; sentiment_score?: number; timestamp?: string | { toDate: () => Date } };
        const score = rawMood.score ?? rawMood.sentiment_score;
        if (typeof score !== 'number' || score < 1 || score > 10) return;

        const rawTs = rawMood.timestamp;
        const timestamp = rawTs && typeof rawTs === 'object' && 'toDate' in rawTs
          ? rawTs.toDate()
          : new Date(rawTs as string);
        const hour = timestamp.getHours();
        const day = timestamp.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Convert Sunday (0) to 6, and shift others down
        const adjustedDay = day === 0 ? 6 : day - 1;
        
        const key = `${adjustedDay}-${hour}`;
        
        if (!cellMap.has(key)) {
          cellMap.set(key, { scores: [], count: 0 });
        }
        
        const cell = cellMap.get(key)!;
        cell.scores.push(score);
        cell.count++;
      });

      // Convert to heatmap cells with averages
      const cells: HeatmapCell[] = [];
      cellMap.forEach((value, key) => {
        const parts = key.split('-').map(Number);
        const day = parts[0] ?? 0;
        const hour = parts[1] ?? 0;
        const averageScore = value.scores.reduce((a, b) => a + b, 0) / value.scores.length;
        cells.push({ day, hour, averageScore, count: value.count });
      });

      setHeatmapData(cells);
    } catch (err) {
      logger.error('Failed to load mood heatmap data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (user?.user_id) {
      void loadMoodData();
    }
  }, [user?.user_id, loadMoodData]);

  const getCellColor = (score: number | undefined): string => {
    if (!score) return 'bg-gray-100 dark:bg-gray-800';
    
    if (score >= 8) return 'bg-green-500 dark:bg-green-600';
    if (score >= 7) return 'bg-green-400 dark:bg-green-500';
    if (score >= 6) return 'bg-yellow-400 dark:bg-yellow-500';
    if (score >= 5) return 'bg-yellow-300 dark:bg-yellow-600';
    if (score >= 4) return 'bg-orange-400 dark:bg-orange-500';
    if (score >= 3) return 'bg-orange-500 dark:bg-orange-600';
    return 'bg-red-500 dark:bg-red-600';
  };

  const getCell = (day: number, hour: number): HeatmapCell | undefined => {
    return heatmapData.find(cell => cell.day === day && cell.hour === hour);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('mood.heatmap.title', 'Humörmönster')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('mood.heatmap.subtitle', 'När mår du bäst och sämst under veckan?')}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-gray-600 dark:text-gray-400">{t('mood.heatmap.legend', 'Humör')}:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Lågt</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-400 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Medel</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Högt</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-12 flex-shrink-0"></div>
            {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
              <div key={hour} className="w-8 text-center text-xs text-gray-500 dark:text-gray-400">
                {hour}
              </div>
            ))}
          </div>

          {/* Days and cells */}
          {DAYS.map((dayLabel, dayIndex) => (
            <div key={dayIndex} className="flex items-center mb-1">
              <div className="w-12 flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400 pr-2">
                {dayLabel}
              </div>
              <div className="flex gap-0.5">
                {HOURS.map(hour => {
                  const cell = getCell(dayIndex, hour);
                  const color = getCellColor(cell?.averageScore);
                  
                  return (
                    <div
                      key={hour}
                      className={`w-3 h-6 rounded-sm ${color} transition-all hover:scale-110 cursor-pointer`}
                      title={cell 
                        ? `${dayLabel} ${hour}:00 - Humör: ${cell.averageScore.toFixed(1)}/10 (${cell.count} loggningar)`
                        : `${dayLabel} ${hour}:00 - Ingen data`
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {heatmapData.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {getBestTime()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('mood.heatmap.bestTime', 'Bästa tid')}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {getWorstTime()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('mood.heatmap.worstTime', 'Svåraste tid')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  function getBestTime(): string {
    if (heatmapData.length === 0) return '-';
    const best = heatmapData.reduce((prev, curr) => 
      curr.averageScore > prev.averageScore ? curr : prev
    );
    return `${DAYS[best.day]} ${best.hour}:00`;
  }

  function getWorstTime(): string {
    if (heatmapData.length === 0) return '-';
    const worst = heatmapData.reduce((prev, curr) => 
      curr.averageScore < prev.averageScore ? curr : prev
    );
    return `${DAYS[worst.day]} ${worst.hour}:00`;
  }
};
