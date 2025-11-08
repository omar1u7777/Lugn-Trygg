import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { getMemories } from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

// Chart.js registration is handled in src/config/chartConfig.ts

const MemoryChart: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.user_id) return;

    const fetchMemoryData = async () => {
      try {
        const memories = await getMemories(user.user_id);
        console.log('MemoryChart: Fetched memories:', memories.length, 'memories');

        // Prepare data for last 7 days
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          last7Days.push(date.toISOString().substring(0, 10));
        }

        const memoryCounts = last7Days.map(date => {
          const count = memories.filter((memory: any) => {
            const timestamp = memory.timestamp;
            if (!timestamp) return false;
            try {
              // Handle Firestore Timestamp objects and UTC timestamps
              let memoryDate: Date;
              if (timestamp.toDate) {
                memoryDate = timestamp.toDate();
              } else if (typeof timestamp === 'string' && timestamp.length === 14) {
                // Parse UTC timestamp format YYYYMMDDHHMMSS
                const year = parseInt(timestamp.substring(0, 4));
                const month = parseInt(timestamp.substring(4, 6)) - 1;
                const day = parseInt(timestamp.substring(6, 8));
                const hour = parseInt(timestamp.substring(8, 10));
                const minute = parseInt(timestamp.substring(10, 12));
                const second = parseInt(timestamp.substring(12, 14));
                memoryDate = new Date(Date.UTC(year, month, day, hour, minute, second));
              } else {
                memoryDate = new Date(timestamp);
              }

              if (isNaN(memoryDate.getTime())) return false;
              const dateString = memoryDate.toISOString().split('T')[0];
              const matches = dateString === date;
              if (matches) {
                console.log('MemoryChart: Found memory for date', date, 'timestamp:', timestamp, 'parsed date:', memoryDate);
              }
              return matches;
            } catch {
              return false;
            }
          }).length;
          console.log('MemoryChart: Count for date', date, ':', count);
          return count;
        });

        const data = {
          labels: last7Days.map(date => new Date(date).toLocaleDateString('sv-SE')),
          datasets: [{
            label: t('memories.count', 'Number of Memories'),
            data: memoryCounts,
            backgroundColor: '#2196F3',
            borderColor: '#1976D2',
            borderWidth: 1
          }]
        };

        setChartData(data);
        console.log('MemoryChart: Chart data updated:', data);
      } catch (error) {
        console.error('Failed to fetch memory data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemoryData();
  }, [user?.user_id]); // Add user.user_id to dependency array for reactivity

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: t('dashboard.weeklyMemoryActivity', 'Weekly Memory Activity') }
    }
  };

  if (loading) {
    return <div className="loading-message">{t('common.loading')}</div>;
  }

  if (!chartData || !chartData.datasets || chartData.datasets.length === 0) {
    return <div className="info-message">{t('dashboard.noMemoryData', '📊 No memory data available.')}</div>;
  }

  return (
    <div style={{ height: '300px' }}>
      <Bar key={JSON.stringify(chartData)} data={chartData} options={options} />
    </div>
  );
};

export default MemoryChart;