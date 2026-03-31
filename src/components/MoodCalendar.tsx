
import React from 'react';
import { eachDayOfInterval, startOfMonth, endOfMonth, format, isSameDay } from 'date-fns';
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

  const firstDay = days[0]?.getDay?.() ?? 0;
  const weeks: (Date | null)[][] = [[]];
  let weekIndex = 0;
  for (let i = 0; i < firstDay; i++) {
    if (!weeks[weekIndex]) weeks[weekIndex] = [];
    weeks[weekIndex]!.push(null);
  }
  days.forEach((day) => {
    if (!weeks[weekIndex]) weeks[weekIndex] = [];
    if (weeks[weekIndex]!.length === 7) {
      weeks.push([]);
      weekIndex++;
    }
    if (!weeks[weekIndex]) weeks[weekIndex] = [];
    weeks[weekIndex]!.push(day);
  });

  return (
    <div className="overflow-x-auto">
      <table className="table-fixed w-full border-collapse">
        <thead>
          <tr>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <th key={d} className="p-1 text-xs font-medium text-gray-500">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} className="p-1" />;
                const entry = getMoodForDay(day, moodEntries);
                return (
                  <td key={j} className="p-1">
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center mx-auto',
                        entry ? moodColor(entry.mood) : 'bg-gray-200',
                        'cursor-pointer',
                        entry && 'ring-2 ring-primary-500'
                      )}
                      title={entry ? `Mood: ${entry.mood}\n${entry.tags?.join(', ') || ''}` : format(day, 'd MMM yyyy')}
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
