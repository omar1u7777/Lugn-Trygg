/**
 * Health Analytics Utilities
 * Helper functions for working with health-mood correlation analysis
 */

import { analyzeHealthMoodPatterns } from '@/api/integrations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HealthPattern {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface HealthRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  expected_benefit: string;
}

export interface HealthSummary {
  avg_steps?: number;
  steps_status?: 'good' | 'low';
  avg_sleep?: number;
  sleep_status?: 'good' | 'too_much' | 'too_little';
  avg_hr?: number;
  hr_status?: 'good' | 'elevated';
}

export interface HealthMoodAnalysis {
  success: boolean;
  message: string;
  status: 'success' | 'insufficient_data' | 'error';
  days_analyzed?: number;
  patterns?: HealthPattern[];
  recommendations?: HealthRecommendation[];
  mood_average?: number;
  mood_trend?: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  health_summary?: HealthSummary;
  user_id?: string;
  generated_at?: string;
  data_points?: {
    health_entries: number;
    mood_entries: number;
  };
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Get health-mood correlation analysis
 * @param days - Number of days to analyze (default: 30)
 * @returns Analysis results with patterns and recommendations
 */
export async function getHealthMoodAnalysis(days: number = 30): Promise<HealthMoodAnalysis> {
  try {
    const result = await analyzeHealthMoodPatterns(days);
    return result;
  } catch (error) {
    console.error('Failed to get health-mood analysis:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'error',
      patterns: [],
      recommendations: []
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color for pattern impact level
 */
export function getPatternImpactColor(impact: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-blue-600 dark:text-blue-400'
  };
  return colors[impact];
}

/**
 * Get badge color for pattern impact
 */
export function getPatternImpactBadge(impact: 'high' | 'medium' | 'low'): string {
  const badges = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  };
  return badges[impact];
}

/**
 * Get color for recommendation priority
 */
export function getRecommendationPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
  };
  return colors[priority];
}

/**
 * Format mood trend for display
 */
export function formatMoodTrend(trend?: 'improving' | 'stable' | 'declining' | 'insufficient_data'): string {
  const trends = {
    improving: '📈 Förbättras',
    stable: '➡️ Stabilt',
    declining: '📉 Försämras',
    insufficient_data: '❓ Otillräcklig data'
  };
  return trends[trend || 'insufficient_data'];
}

/**
 * Get trend color
 */
export function getMoodTrendColor(trend?: 'improving' | 'stable' | 'declining' | 'insufficient_data'): string {
  const colors = {
    improving: 'text-green-600 dark:text-green-400',
    stable: 'text-blue-600 dark:text-blue-400',
    declining: 'text-red-600 dark:text-red-400',
    insufficient_data: 'text-gray-600 dark:text-gray-400'
  };
  return colors[trend || 'insufficient_data'];
}

/**
 * Format health status for display
 */
export function formatHealthStatus(status: string): { icon: string; text: string; color: string } {
  const statusMap: Record<string, { icon: string; text: string; color: string }> = {
    good: { 
      icon: '✅', 
      text: 'Bra', 
      color: 'text-green-600 dark:text-green-400' 
    },
    low: { 
      icon: '⚠️', 
      text: 'Låg', 
      color: 'text-yellow-600 dark:text-yellow-400' 
    },
    elevated: { 
      icon: '⚠️', 
      text: 'Förhöjd', 
      color: 'text-red-600 dark:text-red-400' 
    },
    too_little: { 
      icon: '😴', 
      text: 'För lite', 
      color: 'text-red-600 dark:text-red-400' 
    },
    too_much: { 
      icon: '😴', 
      text: 'För mycket', 
      color: 'text-yellow-600 dark:text-yellow-400' 
    }
  };
  
  return statusMap[status] || { 
    icon: '❓', 
    text: 'Okänd', 
    color: 'text-gray-600 dark:text-gray-400' 
  };
}

/**
 * Calculate progress percentage for health metrics
 */
export function calculateHealthProgress(value: number, target: number): number {
  return Math.min(100, Math.round((value / target) * 100));
}

/**
 * Get actionable patterns (patterns that can be acted upon)
 */
export function getActionablePatterns(patterns: HealthPattern[]): HealthPattern[] {
  return patterns.filter(p => p.actionable);
}

/**
 * Get high priority recommendations
 */
export function getHighPriorityRecommendations(recommendations: HealthRecommendation[]): HealthRecommendation[] {
  return recommendations.filter(r => r.priority === 'high');
}

/**
 * Format days analyzed text
 */
export function formatDaysAnalyzed(days?: number): string {
  if (!days) return 'Ingen data';
  if (days === 1) return '1 dag';
  return `${days} dagar`;
}

/**
 * Check if analysis has sufficient data
 */
export function hasSufficientData(analysis: HealthMoodAnalysis): boolean {
  return (
    analysis.status === 'success' &&
    (analysis.data_points?.health_entries || 0) >= 3 &&
    (analysis.data_points?.mood_entries || 0) >= 3
  );
}

/**
 * Get summary statistics text
 */
export function getSummaryStatistics(analysis: HealthMoodAnalysis): string[] {
  const stats: string[] = [];
  
  if (analysis.mood_average !== undefined) {
    stats.push(`Genomsnittligt humör: ${analysis.mood_average.toFixed(1)}/10`);
  }
  
  if (analysis.health_summary?.avg_steps) {
    stats.push(`Genomsnittliga steg: ${analysis.health_summary.avg_steps.toLocaleString()}`);
  }
  
  if (analysis.health_summary?.avg_sleep) {
    stats.push(`Genomsnittlig sömn: ${analysis.health_summary.avg_sleep.toFixed(1)}h`);
  }
  
  if (analysis.health_summary?.avg_hr) {
    stats.push(`Genomsnittlig vilopuls: ${analysis.health_summary.avg_hr} bpm`);
  }
  
  return stats;
}

/**
 * Group recommendations by priority
 */
export function groupRecommendationsByPriority(recommendations: HealthRecommendation[]): {
  high: HealthRecommendation[];
  medium: HealthRecommendation[];
  low: HealthRecommendation[];
} {
  return {
    high: recommendations.filter(r => r.priority === 'high'),
    medium: recommendations.filter(r => r.priority === 'medium'),
    low: recommendations.filter(r => r.priority === 'low')
  };
}

/**
 * Get pattern type icon
 */
export function getPatternTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    activity_mood_correlation: '🏃',
    sleep_mood_correlation: '😴',
    hr_stress_correlation: '❤️',
    sedentary_pattern: '🪑',
    sleep_deprivation: '😴'
  };
  return icons[type] || '📊';
}

/**
 * Export analysis for sharing
 */
export function exportAnalysisAsText(analysis: HealthMoodAnalysis): string {
  let text = `HEALTH-MOOD ANALYSIS RAPPORT\n`;
  text += `Genererad: ${new Date(analysis.generated_at || new Date()).toLocaleString('sv-SE')}\n\n`;
  
  text += `STATUS: ${analysis.status}\n`;
  text += `Dagar analyserade: ${analysis.days_analyzed || 0}\n`;
  text += `Humörtrend: ${formatMoodTrend(analysis.mood_trend)}\n\n`;
  
  if (analysis.patterns && analysis.patterns.length > 0) {
    text += `UPPTÄCKTA MÖNSTER (${analysis.patterns.length}):\n`;
    analysis.patterns.forEach((p, i) => {
      text += `${i + 1}. ${p.title}\n`;
      text += `   ${p.description}\n`;
      text += `   Impact: ${p.impact.toUpperCase()}\n\n`;
    });
  }
  
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    text += `REKOMMENDATIONER (${analysis.recommendations.length}):\n`;
    analysis.recommendations.forEach((r, i) => {
      text += `${i + 1}. ${r.title} [${r.priority.toUpperCase()}]\n`;
      text += `   ${r.description}\n`;
      text += `   Åtgärd: ${r.action}\n`;
      text += `   Förväntad nytta: ${r.expected_benefit}\n\n`;
    });
  }
  
  return text;
}

/**
 * Download analysis as text file
 */
export function downloadAnalysisReport(analysis: HealthMoodAnalysis): void {
  const text = exportAnalysisAsText(analysis);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-mood-analysis-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
