import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const QuickNavigation: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    {
      path: '/ai-stories',
      icon: '📖',
      title: 'AI-berättelser',
      description: 'Generera personliga berättelser',
      color: 'from-indigo-500 to-purple-600',
      hoverColor: 'hover:from-indigo-600 hover:to-purple-700',
    },
    {
      path: '/analytics',
      icon: '📊',
      title: 'Analys',
      description: 'Humörprognoser & insikter',
      color: 'from-blue-500 to-cyan-600',
      hoverColor: 'hover:from-blue-600 hover:to-cyan-700',
    },
    {
      path: '/integrations',
      icon: '❤️',
      title: 'Integrationer',
      description: 'Anslut hälsoenheter',
      color: 'from-red-500 to-pink-600',
      hoverColor: 'hover:from-red-600 hover:to-pink-700',
    },
    {
      path: '/subscribe',
      icon: '⭐',
      title: 'Premium',
      description: 'Uppgradera ditt konto',
      color: 'from-yellow-500 to-orange-600',
      hoverColor: 'hover:from-yellow-600 hover:to-orange-700',
    },
    {
      path: '/referral',
      icon: '🎁',
      title: 'Referensprogram',
      description: 'Bjud in vänner & få belöningar',
      color: 'from-emerald-500 to-teal-600',
      hoverColor: 'hover:from-emerald-600 hover:to-teal-700',
    },
    {
      path: '/feedback',
      icon: '💬',
      title: 'Feedback',
      description: 'Dela dina åsikter',
      color: 'from-violet-500 to-fuchsia-600',
      hoverColor: 'hover:from-violet-600 hover:to-fuchsia-700',
    },
  ];

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span>🚀</span>
        Snabb åtkomst
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {navItems.map((item, index) => (
          <motion.button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`bg-gradient-to-br ${item.color} ${item.hoverColor} text-white rounded-xl p-4 shadow-lg transition-all duration-200 flex flex-col items-center text-center group`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <h4 className="font-bold text-sm mb-1">{item.title}</h4>
            <p className="text-xs opacity-90 line-clamp-2">{item.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickNavigation;
