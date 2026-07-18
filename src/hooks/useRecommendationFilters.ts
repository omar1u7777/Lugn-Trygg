import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Recommendation } from '../types/recommendation';

type SortBy = 'rating' | 'duration' | 'difficulty';

export function useRecommendationFilters(recommendations: Recommendation[]) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('rating');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(recommendations.map(r => r.category))).sort()],
    [recommendations]
  );

  const hasActiveFilters = useMemo(
    () => searchTerm.trim().length > 0 || selectedCategory !== 'all' || sortBy !== 'rating',
    [searchTerm, selectedCategory, sortBy]
  );

  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(rec =>
        rec.title.toLowerCase().includes(searchLower) ||
        rec.description.toLowerCase().includes(searchLower) ||
        rec.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        rec.category.toLowerCase().includes(searchLower)
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(rec => rec.category === selectedCategory);
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'duration': return (a.duration || 0) - (b.duration || 0);
        case 'difficulty': {
          const difficultyOrder: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
          return (difficultyOrder[a.difficulty] ?? 1) - (difficultyOrder[b.difficulty] ?? 1);
        }
        default: return 0;
      }
    });
    return filtered;
  }, [recommendations, searchTerm, selectedCategory, sortBy]);

  const sortLabel = sortBy === 'rating'
    ? t('recommendations.sort.rating', 'Betyg')
    : sortBy === 'duration'
      ? t('recommendations.sort.duration', 'Längd')
      : t('recommendations.sort.difficulty', 'Svårighetsgrad');

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    categories,
    hasActiveFilters,
    filteredRecommendations,
    sortLabel,
  };
}
