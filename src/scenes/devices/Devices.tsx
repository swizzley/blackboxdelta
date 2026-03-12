import {useEffect, useState} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {getFingerprint, getFingerprintSync} from '../../api/fingerprint';
import {getApiBase} from '../../api/config';

export default function Devices() {
    const {isDarkMode} = useTheme();
    const [fingerprint, setFingerprint] = useState<string>('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [label, setLabel] = useState('');
    const [registering, setRegistering] = useState(false);
    const [message, setMessage] = useState<{text: string; ok: boolean} | null>(null);

    const [apiError, setApiError] = useState(false);

    // Load fingerprint and check trust status
    useEffect(() => {
        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);

            try {
                const res = await fetch(`${getApiBase()}/api/devices/status?fp=${encodeURIComponent(fp)}`);
                if (res.ok) {
                    const data = await res.json();
                    setTrusted(data.trusted);
                } else {
                    setTrusted(false);
                }
            } catch {
                setApiError(true);
                setTrusted(false);
            }
        })();
    }, []);

    const handleRegister = async () => {
        if (!fingerprint) return;
        setRegistering(true);
        setMessage(null);
        try {
            const headers: Record<string, string> = {'Content-Type': 'application/json'};
            const callerFP = getFingerprintSync();
            if (callerFP) headers['X-Device-FP'] = callerFP;

            const res = await fetch(`${getApiBase()}/api/devices/register`, {
                method: 'POST',
                headers,
                body: JSON.stringify({fingerprint, label: label || navigator.userAgent.slice(0, 100)}),
            });
            if (res.ok) {
                setTrusted(true);
                setMessage({text: 'Device registered successfully', ok: true});
            } else {
                const data = await res.json().catch(() => ({error: 'Registration failed'}));
                setMessage({text: data.error || 'Registration failed', ok: false});
            }
        } catch (e) {
            setMessage({text: 'Network error', ok: false});
        } finally {
            setRegistering(false);
        }
    };

    const card = isDarkMode
        ? 'bg-slate-800/50 border border-slate-700 rounded-xl p-6'
        : 'bg-white border border-gray-200 rounded-xl shadow-sm p-6';

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            <Nav/>
            <main className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Device Registration</h1>

                <div className={`${card} mb-6`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        This Device
                    </h2>

                    <div className="space-y-3">
                        <div>
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Fingerprint
                            </span>
                            <div className={`font-mono text-sm mt-1 px-3 py-2 rounded ${
                                isDarkMode ? 'bg-slate-700 text-cyan-400' : 'bg-gray-100 text-cyan-700'
                            }`}>
                                {fingerprint || 'Loading...'}
                            </div>
                        </div>

                        <div>
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Status
                            </span>
                            <div className="mt-1">
                                {trusted === null && !apiError && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                                        isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        Checking...
                                    </span>
                                )}
                                {apiError && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                                        isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                                    }`}>
                                        <span className="w-2 h-2 rounded-full bg-yellow-400"/>
                                        API unreachable — auth not enabled yet, device can be registered after deploy
                                    </span>
                                )}
                                {trusted === true && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                                        isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                        <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                                        Trusted
                                    </span>
                                )}
                                {trusted === false && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                                        isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
                                    }`}>
                                        <span className="w-2 h-2 rounded-full bg-red-400"/>
                                        Not Trusted
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {trusted === false && (
                    <div className={`${card}`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Register This Device
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Device Label (optional)
                                </label>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={e => setLabel(e.target.value)}
                                    placeholder="e.g. MacBook Pro, iPhone, etc."
                                    className={`mt-1 w-full px-3 py-2 rounded text-sm ${
                                        isDarkMode
                                            ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder-gray-500'
                                            : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                                    } border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                                />
                            </div>
                            <button
                                onClick={handleRegister}
                                disabled={registering || !fingerprint}
                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                    registering
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                            : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                }`}
                            >
                                {registering ? 'Registering...' : 'Register Device'}
                            </button>
                            {message && (
                                <div className={`text-sm px-3 py-2 rounded ${
                                    message.ok
                                        ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                                        : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')
                                }`}>
                                    {message.text}
                                </div>
                            )}
                        </div>
                        <p className={`mt-4 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            First device registered automatically. Additional devices require registration from an already-trusted device.
                        </p>
                    </div>
                )}

                {trusted === true && (
                    <div className={`${card}`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            This device is already trusted. All API requests from this browser will include the device fingerprint automatically.
                        </p>
                    </div>
                )}
            </main>
            <Foot/>
        </div>
    );
}
