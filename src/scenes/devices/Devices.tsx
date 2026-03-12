import {useEffect, useState, useCallback} from 'react';
import Nav from '../common/Nav';
import Foot from '../common/Foot';
import {useTheme} from '../../context/Theme';
import {getFingerprint, getFingerprintSync} from '../../api/fingerprint';
import {getApiBase} from '../../api/config';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface TrustedDevice {
    id: number;
    fingerprint: string;
    label: string;
    created_at: string;
    last_seen: string;
}

export default function Devices() {
    const {isDarkMode} = useTheme();
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [apiError, setApiError] = useState(false);
    const [devices, setDevices] = useState<TrustedDevice[]>([]);
    const [message, setMessage] = useState<{text: string; ok: boolean} | null>(null);

    // Add device form
    const [addFP, setAddFP] = useState('');
    const [addLabel, setAddLabel] = useState('');
    const [adding, setAdding] = useState(false);

    const authHeaders = (): Record<string, string> => {
        const fp = getFingerprintSync();
        return fp ? {'X-Device-FP': fp} : {};
    };

    const loadDevices = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices`, {headers: authHeaders()});
            if (res.ok) {
                setDevices(await res.json());
            }
        } catch { /* ignore */ }
    }, []);

    const checkStatus = useCallback(async (fp: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/status?fp=${encodeURIComponent(fp)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                setApiError(false);
                if (data.trusted) loadDevices();
                return data.trusted;
            } else {
                setTrusted(false);
            }
        } catch {
            setApiError(true);
            setTrusted(false);
        }
        return false;
    }, [loadDevices]);

    // Load fingerprint, check status, poll every 10s if not yet trusted
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);
            const isTrusted = await checkStatus(fp);

            // If not trusted, poll every 10s (waiting for approval from another device)
            if (!isTrusted) {
                interval = setInterval(() => checkStatus(fp), 10_000);
            }
        })();

        return () => { if (interval) clearInterval(interval); };
    }, [checkStatus]);

    const handleRegisterSelf = async () => {
        if (!fingerprint) return;
        setMessage(null);
        try {
            const res = await fetch(`${getApiBase()}/api/devices/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...authHeaders()},
                body: JSON.stringify({fingerprint, label: navigator.userAgent.slice(0, 100)}),
            });
            if (res.ok) {
                setTrusted(true);
                setMessage({text: 'Device registered', ok: true});
                loadDevices();
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        }
    };

    const handleAddDevice = async () => {
        if (!addFP.trim()) return;
        setAdding(true);
        setMessage(null);
        try {
            const res = await fetch(`${getApiBase()}/api/devices/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...authHeaders()},
                body: JSON.stringify({fingerprint: addFP.trim(), label: addLabel.trim() || 'unnamed'}),
            });
            if (res.ok) {
                setMessage({text: `Device ${addFP.trim().slice(0, 8)}... registered`, ok: true});
                setAddFP('');
                setAddLabel('');
                loadDevices();
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: number, fp: string) => {
        if (fp === fingerprint) return; // can't delete yourself
        try {
            const res = await fetch(`${getApiBase()}/api/devices/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (res.ok) loadDevices();
        } catch { /* ignore */ }
    };

    const card = isDarkMode
        ? 'bg-slate-800/50 border border-slate-700 rounded-xl p-6'
        : 'bg-white border border-gray-200 rounded-xl shadow-sm p-6';

    return (
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            <Nav/>
            <main className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Device Management</h1>

                {/* This Device */}
                <div className={`${card} mb-6`}>
                    <h2 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        This Device
                    </h2>
                    <div className="flex items-center gap-3 flex-wrap">
                        <code
                            className={`text-xs px-2 py-1 rounded cursor-pointer select-all ${
                                isDarkMode ? 'bg-slate-700 text-cyan-400 hover:bg-slate-600' : 'bg-gray-100 text-cyan-700 hover:bg-gray-200'
                            }`}
                            onClick={() => { if (fingerprint) navigator.clipboard.writeText(fingerprint); setMessage({text: 'Fingerprint copied', ok: true}); }}
                            title="Click to copy"
                        >
                            {fingerprint || '...'}
                        </code>
                        {trusted === true && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>Trusted
                            </span>
                        )}
                        {trusted === false && !apiError && (
                            <>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Waiting for approval...
                                </span>
                                <button onClick={handleRegisterSelf} className="text-xs text-cyan-500 hover:text-cyan-400 underline">
                                    Self-register
                                </button>
                            </>
                        )}
                        {apiError && (
                            <>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>API unreachable
                                </span>
                                <button
                                    onClick={() => { if (fingerprint) checkStatus(fingerprint); }}
                                    className="text-xs text-cyan-500 hover:text-cyan-400 underline"
                                >
                                    Retry
                                </button>
                            </>
                        )}
                        {trusted === null && !apiError && (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Checking...</span>
                        )}
                    </div>
                </div>

                {message && (
                    <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${
                        message.ok
                            ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* Trusted Devices List */}
                {trusted === true && (
                    <div className={`${card} mb-6`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Trusted Devices ({devices.length})
                        </h2>
                        {devices.length === 0 ? (
                            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No devices found</p>
                        ) : (
                            <div className="space-y-2">
                                {devices.map(d => (
                                    <div key={d.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                                        isDarkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                                    } ${d.fingerprint === fingerprint ? (isDarkMode ? 'ring-1 ring-cyan-600/50' : 'ring-1 ring-cyan-300') : ''}`}>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <code className={`text-xs ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
                                                    {d.fingerprint.slice(0, 12)}...
                                                </code>
                                                {d.fingerprint === fingerprint && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                        isDarkMode ? 'bg-cyan-900/40 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
                                                    }`}>you</span>
                                                )}
                                            </div>
                                            <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {d.label || 'unlabeled'}
                                                <span className="mx-1.5">·</span>
                                                last seen {dayjs(d.last_seen).fromNow()}
                                            </div>
                                        </div>
                                        {d.fingerprint !== fingerprint && (
                                            <button
                                                onClick={() => handleDelete(d.id, d.fingerprint)}
                                                className={`text-xs px-2 py-1 rounded ${
                                                    isDarkMode
                                                        ? 'text-red-400 hover:bg-red-900/30'
                                                        : 'text-red-500 hover:bg-red-50'
                                                }`}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Add Another Device */}
                {trusted === true && (
                    <div className={`${card}`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Add Another Device
                        </h2>
                        <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Open <code>/devices</code> on the other device to see its fingerprint, then paste it here.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={addFP}
                                onChange={e => setAddFP(e.target.value)}
                                placeholder="Fingerprint"
                                className={`flex-1 px-3 py-2 rounded text-xs font-mono ${
                                    isDarkMode
                                        ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder-gray-500'
                                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                                } border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                            />
                            <input
                                type="text"
                                value={addLabel}
                                onChange={e => setAddLabel(e.target.value)}
                                placeholder="Label"
                                className={`w-36 px-3 py-2 rounded text-xs ${
                                    isDarkMode
                                        ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder-gray-500'
                                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                                } border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                            />
                            <button
                                onClick={handleAddDevice}
                                disabled={adding || !addFP.trim()}
                                className={`px-4 py-2 rounded text-xs font-medium whitespace-nowrap ${
                                    adding || !addFP.trim()
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isDarkMode
                                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                            : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                }`}
                            >
                                {adding ? '...' : 'Add'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
            <Foot/>
        </div>
    );
}
