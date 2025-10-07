import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { getMemories } from '../../api/api';
import { useAuth } from '../../contexts/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MemoryChart: React.FC = () => {
  const { user } = useAuth();
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.user_id) return;

    const fetchMemoryData = async () => {
      try {
        const memories = await getMemories(user.user_id);

        // Prepare data for last 7 days
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          last7Days.push(date.toISOString().substring(0, 10));
        }

        const memoryCounts = last7Days.map(date => {
          return memories.filter((memory: any) => {
            const timestamp = memory.timestamp;
            if (!timestamp) return false;
            try {
              // Handle Firestore Timestamp objects
              const memoryDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
              if (isNaN(memoryDate.getTime())) return false;
              const dateString = memoryDate.toISOString().split('T')[0];
              return dateString === date;
            } catch {
              return false;
            }
          }).length;
        });

        const data = {
          labels: last7Days.map(date => new Date(date).toLocaleDateString('sv-SE')),
          datasets: [{
            label: 'Antal minnen',
            data: memoryCounts,
            backgroundColor: '#2196F3',
            borderColor: '#1976D2',
            borderWidth: 1
          }]
        };

        setChartData(data);
      } catch (error) {
        console.error('Failed to fetch memory data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemoryData();
  }, [user]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Veckovis Minnesaktivitet' }
    }
  };

  if (loading) {
    return <div className="loading-message">Laddar diagram...</div>;
  }

  if (!chartData) {
    return <div className="error-message">Kunde inte ladda diagramdata</div>;
  }

  return (
    <div style={{ height: '300px' }}>
      <Bar key={JSON.stringify(chartData)} data={chartData} options={options} />
    </div>
  );
};

export default MemoryChart;