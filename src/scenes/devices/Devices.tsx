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
    ip: string;
    role: string;
    created_at: string;
    last_seen: string;
}

interface PendingDevice {
    id: number;
    fingerprint: string;
    label: string;
    user_agent: string;
    ip: string;
    created_at: string;
    last_seen: string;
}

export default function Devices() {
    const {isDarkMode} = useTheme();
    const [fingerprint, setFingerprint] = useState('');
    const [trusted, setTrusted] = useState<boolean | null>(null);
    const [role, setRole] = useState<string>('user');
    const [apiError, setApiError] = useState(false);
    const [devices, setDevices] = useState<TrustedDevice[]>([]);
    const [pending, setPending] = useState<PendingDevice[]>([]);
    const [message, setMessage] = useState<{text: string; ok: boolean} | null>(null);
    const [requested, setRequested] = useState(false);

    // Request form
    const [requestLabel, setRequestLabel] = useState('');

    // Add device form (admin)
    const [addFP, setAddFP] = useState('');
    const [addLabel, setAddLabel] = useState('');
    const [adding, setAdding] = useState(false);

    const isAdmin = role === 'admin';

    const authHeaders = (): Record<string, string> => {
        const fp = getFingerprintSync();
        return fp ? {'X-Device-FP': fp} : {};
    };

    const loadDevices = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices`, {headers: authHeaders()});
            if (res.ok) setDevices(await res.json());
        } catch { /* ignore */ }
    }, []);

    const loadPending = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/pending`, {headers: authHeaders()});
            if (res.ok) setPending(await res.json());
        } catch { /* ignore */ }
    }, []);

    const checkStatus = useCallback(async (fp: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/status?fp=${encodeURIComponent(fp)}`);
            if (res.ok) {
                const data = await res.json();
                setTrusted(data.trusted);
                setApiError(false);
                if (data.trusted) {
                    setRole(data.role || 'user');
                    loadDevices();
                    if (data.role === 'admin') loadPending();
                }
                return data.trusted;
            } else {
                setTrusted(false);
            }
        } catch {
            setApiError(true);
            setTrusted(false);
        }
        return false;
    }, [loadDevices, loadPending]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        (async () => {
            const fp = await getFingerprint();
            setFingerprint(fp);
            const isTrusted = await checkStatus(fp);

            if (!isTrusted) {
                interval = setInterval(() => checkStatus(fp), 10_000);
            }
        })();

        return () => { if (interval) clearInterval(interval); };
    }, [checkStatus]);

    // Refresh pending every 15s for admins
    useEffect(() => {
        if (!isAdmin || !trusted) return;
        const interval = setInterval(loadPending, 15_000);
        return () => clearInterval(interval);
    }, [isAdmin, trusted, loadPending]);

    const handleRequestAccess = async () => {
        if (!fingerprint || !requestLabel.trim()) return;
        setMessage(null);
        try {
            const res = await fetch(`${getApiBase()}/api/devices/request`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({fingerprint, label: requestLabel.trim()}),
            });
            if (res.ok) {
                setRequested(true);
                setMessage({text: 'Access requested — waiting for admin approval', ok: true});
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        }
    };

    const handleRegisterSelf = async () => {
        if (!fingerprint) return;
        setMessage(null);
        try {
            const res = await fetch(`${getApiBase()}/api/devices/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...authHeaders()},
                body: JSON.stringify({fingerprint, label: window.location.hostname || 'bootstrap'}),
            });
            if (res.ok) {
                setTrusted(true);
                setMessage({text: 'Device registered (bootstrap)', ok: true});
                loadDevices();
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        }
    };

    const handleApprove = async (id: number) => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/approve/${id}`, {
                method: 'POST',
                headers: authHeaders(),
            });
            if (res.ok) {
                setMessage({text: 'Device approved', ok: true});
                loadPending();
                loadDevices();
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Approve failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        }
    };

    const handleDismiss = async (id: number) => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/pending/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (res.ok) loadPending();
        } catch { /* ignore */ }
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
        if (fp === fingerprint) return;
        try {
            const res = await fetch(`${getApiBase()}/api/devices/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (res.ok) loadDevices();
        } catch { /* ignore */ }
    };

    const handleRoleChange = async (id: number, newRole: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/devices/${id}/role`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...authHeaders()},
                body: JSON.stringify({role: newRole}),
            });
            if (res.ok) {
                setMessage({text: `Role changed to ${newRole}`, ok: true});
                loadDevices();
            } else {
                const data = await res.json().catch(() => ({error: 'Failed'}));
                setMessage({text: data.error || 'Failed', ok: false});
            }
        } catch {
            setMessage({text: 'Network error', ok: false});
        }
    };

    const card = isDarkMode
        ? 'bg-slate-800/50 border border-slate-700 rounded-xl p-6'
        : 'bg-white border border-gray-200 rounded-xl shadow-sm p-6';

    const roleBadge = (r: string) => {
        if (r === 'admin') return isDarkMode ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-50 text-purple-600';
        return isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500';
    };

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
                            <>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>Trusted
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge(role)}`}>
                                    {role}
                                </span>
                            </>
                        )}
                        {trusted === false && !apiError && !requested && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
                            }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>Not trusted
                            </span>
                        )}
                        {trusted === false && !apiError && requested && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
                            }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>Waiting for approval...
                            </span>
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

                    {/* Request Access Form (untrusted, not yet requested) */}
                    {trusted === false && !apiError && !requested && (
                        <div className="mt-4">
                            <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Enter a label for this device and request access from an admin.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={requestLabel}
                                    onChange={e => setRequestLabel(e.target.value)}
                                    placeholder="Device label (e.g. Work Laptop)"
                                    className={`flex-1 px-3 py-2 rounded text-xs ${
                                        isDarkMode
                                            ? 'bg-slate-700 border-slate-600 text-gray-200 placeholder-gray-500'
                                            : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                                    } border focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                                />
                                <button
                                    onClick={handleRequestAccess}
                                    disabled={!requestLabel.trim()}
                                    className={`px-4 py-2 rounded text-xs font-medium whitespace-nowrap ${
                                        !requestLabel.trim()
                                            ? 'opacity-50 cursor-not-allowed'
                                            : isDarkMode
                                                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                    }`}
                                >
                                    Request Access
                                </button>
                            </div>
                            <button onClick={handleRegisterSelf} className={`mt-2 text-[10px] ${isDarkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'}`}>
                                Bootstrap (first device only)
                            </button>
                        </div>
                    )}
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

                {/* Pending Device Requests (admin only) */}
                {trusted === true && isAdmin && pending.length > 0 && (
                    <div className={`${card} mb-6`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Pending Requests ({pending.length})
                        </h2>
                        <div className="space-y-3">
                            {pending.map(p => (
                                <div key={p.id} className={`rounded-lg px-4 py-3 ${
                                    isDarkMode ? 'bg-amber-900/20 border border-amber-800/30' : 'bg-amber-50 border border-amber-200'
                                }`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                    {p.label}
                                                </span>
                                                <code className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                    isDarkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {p.fingerprint.slice(0, 12)}...
                                                </code>
                                            </div>
                                            <div className={`text-xs space-y-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {p.ip && <div>IP: {p.ip}</div>}
                                                <div className="truncate max-w-md">{p.user_agent}</div>
                                                <div>Requested {dayjs(p.created_at).fromNow()}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => handleApprove(p.id)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium ${
                                                    isDarkMode
                                                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                }`}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleDismiss(p.id)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium ${
                                                    isDarkMode
                                                        ? 'text-red-400 hover:bg-red-900/30 border border-red-800/30'
                                                        : 'text-red-500 hover:bg-red-50 border border-red-200'
                                                }`}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge(d.role)}`}>
                                                    {d.role}
                                                </span>
                                            </div>
                                            <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {d.label || 'unlabeled'}
                                                {d.ip && <><span className="mx-1.5">&middot;</span>{d.ip}</>}
                                                <span className="mx-1.5">&middot;</span>
                                                last seen {dayjs(d.last_seen).fromNow()}
                                            </div>
                                        </div>
                                        {isAdmin && d.fingerprint !== fingerprint && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleRoleChange(d.id, d.role === 'admin' ? 'user' : 'admin')}
                                                    className={`text-[10px] px-2 py-1 rounded ${
                                                        isDarkMode
                                                            ? 'text-purple-400 hover:bg-purple-900/30'
                                                            : 'text-purple-500 hover:bg-purple-50'
                                                    }`}
                                                    title={d.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                                                >
                                                    {d.role === 'admin' ? 'Demote' : 'Promote'}
                                                </button>
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
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Add Another Device (admin only) */}
                {trusted === true && isAdmin && (
                    <div className={`${card}`}>
                        <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            Add Device Directly
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
