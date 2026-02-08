import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/tailwind';
import { getJournalEntries } from '../api/api';
import useAuth from '../hooks/useAuth';
import { logger } from '../utils/logger';
import {
  CalendarDaysIcon,
  TagIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface JournalEntry {
  id: string;
  content: string;
  tags: string[];
  mood?: number;
  createdAt: string;
  updatedAt: string;
  user_id: string;
}

interface JournalListProps {
  refreshTrigger?: number;
}

const JournalList: React.FC<JournalListProps> = ({ refreshTrigger }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadJournalEntries = useCallback(async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      logger.debug('📝 Loading journal entries for user:', user.user_id);

      const response = await getJournalEntries(user.user_id, 100);
      logger.debug('✅ Journal entries loaded:', response.length);

      setEntries(response);
    } catch (error: any) {
      logger.error('❌ Failed to load journal entries:', error);
      setError(error?.response?.data?.error || 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    loadJournalEntries();
  }, [loadJournalEntries, refreshTrigger]);

  // Define categories based on tags
  const categories = [
    { id: 'all', name: 'Alla kategorier', icon: '📚' },
    { id: 'positive', name: 'Positiva känslor', icon: '😊', tags: ['Glad', 'Tacksam', 'Hoppfull', 'Energisk'] },
    { id: 'negative', name: 'Utmaningar', icon: '😔', tags: ['Ledsen', 'Stressad', 'Ångest', 'Överväldigad'] },
    { id: 'neutral', name: 'Reflektion', icon: '🤔', tags: ['Kalm', 'Trött'] },
    { id: 'growth', name: 'Personlig utveckling', icon: '🌱', tags: ['Hoppfull', 'Tacksam', 'Energisk'] }
  ];

  const filteredEntries = entries
    .filter(entry => {
      const matchesSearch = searchTerm === '' ||
        entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTag = selectedTag === 'all' || entry.tags.includes(selectedTag);

      const matchesCategory = selectedCategory === 'all' ||
        categories.find(cat => cat.id === selectedCategory)?.tags?.some(tag => entry.tags.includes(tag)) ||
        false;

      return matchesSearch && matchesTag && matchesCategory;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const allTags = Array.from(new Set(entries.flatMap(entry => entry.tags)));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportJournalEntries = () => {
    if (filteredEntries.length === 0) return;

    const exportData = filteredEntries.map(entry => ({
      date: formatDate(entry.createdAt),
      content: entry.content,
      tags: entry.tags.join(', '),
      wordCount: getWordCount(entry.content),
      mood: entry.mood || 'N/A'
    }));

    const csvContent = [
      ['Datum', 'Innehåll', 'Taggar', 'Antal ord', 'Humör'],
      ...exportData.map(entry => [
        entry.date,
        `"${entry.content.replace(/"/g, '""')}"`,
        entry.tags,
        entry.wordCount.toString(),
        entry.mood.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `journal-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getJournalAnalytics = () => {
    if (entries.length === 0) return null;

    const totalEntries = entries.length;
    const totalWords = entries.reduce((sum, entry) => sum + getWordCount(entry.content), 0);
    const avgWordsPerEntry = Math.round(totalWords / totalEntries);

    // Most common tags
    const tagCounts: { [key: string]: number } = {};
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tag, count]) => ({ tag, count }));

    // Writing frequency
    const entriesByMonth: { [key: string]: number } = {};
    entries.forEach(entry => {
      const month = new Date(entry.createdAt).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long'
      });
      entriesByMonth[month] = (entriesByMonth[month] || 0) + 1;
    });

    const mostActiveMonth = Object.entries(entriesByMonth)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      totalEntries,
      totalWords,
      avgWordsPerEntry,
      topTags,
      mostActiveMonth: mostActiveMonth ? {
        month: mostActiveMonth[0],
        count: mostActiveMonth[1]
      } : null
    };
  };

  const getWordCount = (content: string) => {
    return content.trim().split(/\s+/).filter(Boolean).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Laddar dagboksanteckningar...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <DocumentTextIcon className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Kunde inte ladda dagboksanteckningar
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadJournalEntries}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <Card className="world-class-dashboard-card">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök i dina anteckningar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            <div className="sm:w-40">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">Alla taggar</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="sm:w-32">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="newest">Nyast först</option>
                <option value="oldest">Äldst först</option>
              </select>
            </div>
          </div>

          {/* Results Summary and Export */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredEntries.length === entries.length
                ? `Visar alla ${entries.length} anteckningar`
                : `Visar ${filteredEntries.length} av ${entries.length} anteckningar`
              }
            </div>
            <div className="flex gap-2">
              {entries.length > 0 && (
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  title="Visa skrivstatistik och insikter"
                >
                  📊 Analys
                </button>
              )}
              {filteredEntries.length > 0 && (
                <button
                  onClick={exportJournalEntries}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                  title="Exportera dina journalanteckningar till CSV"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Exportera
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Analytics Section */}
      {showAnalytics && entries.length > 0 && (
        <Card className="world-class-dashboard-card">
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Dina Skrivvanor
            </h3>

            {(() => {
              const analytics = getJournalAnalytics();
              if (!analytics) return null;

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {analytics.totalEntries}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Totalt antal anteckningar
                    </div>
                  </div>

                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                      {analytics.totalWords}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Totalt antal ord skrivna
                    </div>
                  </div>

                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                      {analytics.avgWordsPerEntry}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Genomsnitt ord per anteckning
                    </div>
                  </div>

                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                      {analytics.mostActiveMonth?.count || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Flest anteckningar: {analytics.mostActiveMonth?.month || 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Top Tags */}
            {(() => {
              const analytics = getJournalAnalytics();
              if (!analytics?.topTags?.length) return null;

              return (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                    🏷️ Dina mest använda taggar
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analytics.topTags.map(({ tag, count }) => (
                      <div
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          #{tag}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          ({count}x)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Journal Entries */}
      {filteredEntries.length === 0 ? (
        <Card className="world-class-dashboard-card">
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {entries.length === 0 ? 'Inga dagboksanteckningar än' : 'Inga matchande anteckningar'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {entries.length === 0
                ? 'Börja skriva dina första tankar och känslor!'
                : 'Prova att ändra dina sök- eller filterinställningar.'
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="world-class-dashboard-card hover:shadow-lg transition-shadow">
              <div className="p-4 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CalendarDaysIcon className="w-4 h-4" />
                    <span>{formatDate(entry.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <ClockIcon className="w-4 h-4" />
                    <span>{getWordCount(entry.content)} ord</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                    {entry.content}
                  </p>
                </div>

                {/* Tags */}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span
                        key={`${entry.id}-${tag}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                      >
                        <TagIcon className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mood Indicator */}
                {entry.mood && (
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Humör:</span> {entry.mood}/10
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalList;