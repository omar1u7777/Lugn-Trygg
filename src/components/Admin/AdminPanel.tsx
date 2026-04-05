import React, { useEffect, useState, useCallback } from 'react';
import SecurityMonitor from './SecurityMonitor';
import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  type AdminStats,
  type AdminUser,
} from '../../api/admin';
import { logger } from '../../utils/logger';

type Tab = 'overview' | 'users' | 'security';

// ──────────────────────────────────────────────────
// Overview tab — system-wide stats
// ──────────────────────────────────────────────────
const OverviewTab: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAdminStats()
      .then(data => { if (mounted) setStats(data); })
      .catch(err => {
        logger.error('AdminPanel: failed to load stats', err as Error);
        if (mounted) setError('Kunde inte hämta statistik');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Hämtar statistik…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 p-4 text-sm text-red-700 dark:text-red-400">
        {error ?? 'Ingen data'}
      </div>
    );
  }

  const tiles = [
    { label: 'Totalt användare', value: stats.users.total.toLocaleString('sv-SE'), icon: '👥' },
    { label: 'Aktiva (7 dagar)', value: stats.users.active7d.toLocaleString('sv-SE'), icon: '🟢' },
    { label: 'Nya (30 dagar)', value: stats.users.new30d.toLocaleString('sv-SE'), icon: '✨' },
    { label: 'Premium-användare', value: stats.users.premium.toLocaleString('sv-SE'), icon: '💎' },
    { label: 'Humörloggar totalt', value: stats.moods.total.toLocaleString('sv-SE'), icon: '📊' },
    { label: 'Loggar idag', value: stats.moods.today.toLocaleString('sv-SE'), icon: '📅' },
    { label: 'Snitthumör', value: `${stats.moods.averageScore} / 10`, icon: '🎯' },
    { label: 'Premiumandel', value: `${stats.engagement.premiumRate} %`, icon: '📈' },
    { label: 'Aktivitetsgrad', value: `${stats.engagement.activeRate} %`, icon: '⚡' },
    { label: 'Minnen', value: stats.content.memories.toLocaleString('sv-SE'), icon: '🖼️' },
    { label: 'Dagboksinlägg', value: stats.content.journals.toLocaleString('sv-SE'), icon: '📝' },
    { label: 'Chattsessioner', value: stats.content.chatSessions.toLocaleString('sv-SE'), icon: '💬' },
  ];

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Uppdaterat: {new Date(stats.generatedAt).toLocaleString('sv-SE')}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map(tile => (
          <div
            key={tile.label}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
          >
            <div className="text-xl mb-1">{tile.icon}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{tile.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tile.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────
// Users tab — paginated user list with status control
// ──────────────────────────────────────────────────
const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const PER_PAGE = 20;

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers(p, PER_PAGE, q || undefined);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      logger.error('AdminPanel: failed to load users', err as Error);
      setError('Kunde inte hämta användarlistan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, search); }, [load, page, search]);

  const handleSearch = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleStatusChange = useCallback(async (user: AdminUser, newStatus: 'active' | 'suspended' | 'banned') => {
    setUpdating(user.id);
    try {
      await updateUserStatus(user.id, newStatus);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      logger.error('AdminPanel: failed to update user status', err as Error);
    } finally {
      setUpdating(null);
    }
  }, []);

  const handlePrevPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage(p => p + 1);
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Sök e-post eller namn…"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Sök användare"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          Sök
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400 text-sm">
          <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Hämtar…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Användare', 'Roll', 'Status', 'Skapad', 'Senast aktiv', 'Åtgärd'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Inga användare hittades
                  </td>
                </tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{user.displayName || '—'}</div>
                    <div className="text-gray-400 text-xs">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role}
                    </span>
                    {user.premium && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Premium
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : user.status === 'banned'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {user.lastActive ? new Date(user.lastActive).toLocaleDateString('sv-SE') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.status}
                      onChange={e => void handleStatusChange(user, e.target.value as 'active' | 'suspended' | 'banned')}
                      disabled={updating === user.id}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      aria-label={`Ändra status för ${user.email}`}
                    >
                      <option value="active">Aktiv</option>
                      <option value="suspended">Suspenderad</option>
                      <option value="banned">Bannad</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{total} användare totalt</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              ← Föregående
            </button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Nästa →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────
// Root AdminPanel
// ──────────────────────────────────────────────────
const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Översikt', icon: '📊' },
    { id: 'users', label: 'Användare', icon: '👥' },
    { id: 'security', label: 'Säkerhet', icon: '🛡️' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Adminpanel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Systemöversikt, användarhantering och säkerhetsövervakning
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-800 border border-b-white dark:border-gray-700 dark:border-b-gray-800 text-indigo-600 dark:text-indigo-400 -mb-px'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'security' && <SecurityMonitor />}
      </div>
    </div>
  );
};

export default AdminPanel;
