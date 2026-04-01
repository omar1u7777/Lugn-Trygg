import React from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, format, isSameDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { MoodEntry } from '../features/mood/types';
import clsx from 'clsx';

type MoodCalendarEntry = Omit<MoodEntry, 'mood'> & {
  date: string; // ISO string
  mood: number; // for color
};

interface MoodCalendarProps {
  year: number;
  month: number; // 0-indexed (0 = January)
  moodEntries: MoodCalendarEntry[];
}

// Swedish day headers (Monday first)
const DAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

// Get day of week with Monday = 0 (ISO 8601)
function getDayOfWeekMonday(date: Date): number {
  const day = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  return day === 0 ? 6 : day - 1; // Convert to 0=Monday, ..., 6=Sunday
}

const MoodCalendar: React.FC<MoodCalendarProps> = ({ year, month, moodEntries }) => {
  const getMoodForDay = (date: Date, entries: MoodCalendarEntry[]) => {
    return entries.find(entry => isSameDay(new Date(entry.date), date));
  };

  const moodColor = (mood: number) => {
    if (typeof mood !== 'number') return 'bg-gray-200';
    if (mood >= 8) return 'bg-green-400';
    if (mood >= 5) return 'bg-yellow-300';
    if (mood >= 3) return 'bg-orange-300';
    return 'bg-red-400';
  };

  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month)),
    end: endOfMonth(new Date(year, month)),
  });

  if (!days || days.length === 0) return null;

  // Calculate offset for Monday-start weeks
  const firstDayOffset = getDayOfWeekMonday(days[0]);
  
  // Build weeks array with Monday as first day
  const weeks: (Date | null)[][] = [[]];
  let weekIndex = 0;
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOffset; i++) {
    weeks[weekIndex]!.push(null);
  }
  
  // Add all days of the month
  days.forEach((day) => {
    if (weeks[weekIndex]!.length === 7) {
      weeks.push([]);
      weekIndex++;
    }
    weeks[weekIndex]!.push(day);
  });
  
  // Fill last week with empty cells if needed
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek && lastWeek.length < 7) {
    for (let i = lastWeek.length; i < 7; i++) {
      lastWeek.push(null);
    }
  }

  // Check if there are any entries for this month
  const hasEntriesThisMonth = moodEntries.some(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.getFullYear() === year && entryDate.getMonth() === month;
  });

  return (
    <div className="overflow-x-auto">
      {!hasEntriesThisMonth && moodEntries.length > 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          Inga humörloggar denna månad
        </p>
      )}
      <table className="table-fixed w-full border-collapse">
        <thead>
          <tr>
            {DAY_HEADERS.map(d => (
              <th key={d} className="p-1 text-xs font-medium text-gray-500 dark:text-gray-400">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} className="p-1" />;
                const entry = getMoodForDay(day, moodEntries);
                const tooltipParts = [];
                if (entry) {
                  tooltipParts.push(`Humör: ${entry.mood}/10`);
                  if (entry.tags && entry.tags.length > 0) {
                    tooltipParts.push(entry.tags.join(', '));
                  }
                } else {
                  tooltipParts.push(format(day, 'd MMM yyyy', { locale: sv }));
                }
                return (
                  <td key={j} className="p-1">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs',
                        entry ? moodColor(entry.mood) : 'bg-gray-200 dark:bg-gray-700',
                        'cursor-pointer transition-transform hover:scale-110',
                        entry && 'ring-2 ring-primary-500'
                      )}
                      title={tooltipParts.join(' | ')}
                      aria-label={entry ? `Humör ${entry.mood} av 10 den ${format(day, 'd MMMM', { locale: sv })}` : format(day, 'd MMMM yyyy', { locale: sv })}
                    >
                      {format(day, 'd')}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MoodCalendar;
