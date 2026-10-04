import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/api';
import { API_ENDPOINTS } from '../../api/constants';
import { logger } from '../../utils/logger';
import { extractErrorMessage } from '../../api/errorMessage';


interface EmailInviteProps {
    referralCode?: string; // Made optional since it's not used yet
}

const EmailInvite: React.FC<EmailInviteProps> = () => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user?.user_id || !email) {
            setMessage({ type: 'error', text: 'Ange en giltig e-postadress' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setMessage({ type: 'error', text: 'Ogiltig e-postadress' });
            return;
        }

        try {
            setSending(true);
            const response = await api.post(API_ENDPOINTS.REFERRAL.INVITE, {
                user_id: user.user_id,
                email: email,
                referrer_name: user.displayName || user.email || 'Din vän'
            });

            if (response.data.success) {
                setMessage({ 
                    type: 'success', 
                    text: `✅ Inbjudan skickad till ${email}!` 
                });
                setEmail('');
            } else {
                setMessage({ 
                    type: 'error', 
                    text: 'Kunde inte skicka inbjudan' 
                });
            }
        } catch (err: unknown) {
            logger.error('Failed to send invite:', err);
            const errorMessage = extractErrorMessage(err, 'Något gick fel');
            setMessage({ 
                type: 'error', 
                text: errorMessage
            });
        } finally {
            setSending(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                ✉️ Skicka inbjudan
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
                Skicka en personlig inbjudan via e-post. Vi skickar ett vackert mejl med din referenskod!
            </p>

            {message && (
                <div className={`mb-4 p-4 rounded-lg border ${
                    message.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                    <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        E-postadress
                    </label>
                    <input
                        id="invite-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exempel@email.com"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-slate-900 dark:text-slate-100"
                        disabled={sending}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={sending || !email}
                    className="w-full py-3 px-6 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {sending ? (
                        <>
                            <span className="animate-spin">⚙️</span>
                            Skickar...
                        </>
                    ) : (
                        <>
                            <span>📧</span>
                            Skicka inbjudan
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                    <strong>🎁 Vad din vän får:</strong>
                </p>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1 ml-4">
                    <li>✅ Vackert välkomstmejl med din referenskod</li>
                    <li>✅ Direkt länk till registrering</li>
                    <li>✅ 1 vecka gratis premium automatiskt</li>
                    <li>✅ Information om alla funktioner</li>
                </ul>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                    💡 <strong>Tips:</strong> Din vän får ett e-postmeddelande med all info!
                </p>
            </div>
        </div>
    );
};

export default EmailInvite;
