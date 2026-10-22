import {BrowserRouter as Router, Route, Routes, Navigate} from 'react-router-dom';
import {useDeviceAuth} from './context/DeviceAuth';
import Dashboard from './scenes/dashboard/Dashboard';
import History from './scenes/history/History';
import DayDetail from './scenes/day/DayDetail';
import TradeDetail from './scenes/trade/TradeDetail';
import Analysis from './scenes/analysis/Analysis';
import Status from './scenes/status/Status';
import System from './scenes/system/System';
import Optimizer from './scenes/optimizer/Optimizer';
import Profiles from './scenes/profiles/Profiles';
import ProfilesAll from './scenes/profiles/ProfilesAll';
import Devices from './scenes/devices/Devices';
import Error404 from './scenes/common/404';
import ErrorBoundary from './scenes/common/ErrorBoundary';
import ArchiveBanner from './scenes/common/ArchiveBanner';
import {ARCHIVED} from './archive';
import SystemArchive from './scenes/archive/SystemArchive';

function AuthedRoute({children}: {children: React.ReactNode}) {
    const {trusted} = useDeviceAuth();
    if (trusted === null) return null;
    if (!trusted) return <Navigate to="/" replace/>;
    return <>{children}</>;
}

function AdminRoute({children}: {children: React.ReactNode}) {
    const {isAdmin, trusted} = useDeviceAuth();
    if (trusted === null) return null;
    if (!isAdmin) return <Navigate to="/" replace/>;
    return <>{children}</>;
}

export default function App() {
    return (
        <ErrorBoundary>
            <ArchiveBanner/>
            <div className={ARCHIVED ? 'archived' : undefined}>
            <Router>
                <Routes>
                    <Route path="/" element={<Dashboard/>}/>
                    <Route path="/history" element={ARCHIVED ? <SystemArchive focus="history"/> : <AuthedRoute><History/></AuthedRoute>}/>
                    <Route path="/analysis" element={ARCHIVED ? <SystemArchive focus="analysis"/> : <AdminRoute><Analysis/></AdminRoute>}/>
                    <Route path="/system" element={ARCHIVED ? <SystemArchive focus="system"/> : <AdminRoute><Status/></AdminRoute>}/>
                    <Route path="/health" element={ARCHIVED ? <SystemArchive focus="health"/> : <AdminRoute><System/></AdminRoute>}/>
                    <Route path="/profiles" element={ARCHIVED ? <SystemArchive focus="profiles"/> : <AdminRoute><Profiles/></AdminRoute>}/>
                    <Route path="/profiles/all" element={ARCHIVED ? <SystemArchive focus="profiles"/> : <AdminRoute><ProfilesAll/></AdminRoute>}/>
                    <Route path="/optimizer" element={ARCHIVED ? <SystemArchive focus="optimizer"/> : <AdminRoute><Optimizer/></AdminRoute>}/>
                    <Route path="/day/:year/:month/:day" element={<AuthedRoute><DayDetail/></AuthedRoute>}/>
                    <Route path="/trade/:year/:month/:day/:id" element={<AuthedRoute><TradeDetail/></AuthedRoute>}/>
                    <Route path="/devices" element={ARCHIVED ? <Navigate to="/" replace/> : <Devices/>}/>
                    <Route path="*" element={<Error404/>}/>
                </Routes>
            </Router>
            </div>
        </ErrorBoundary>
    );
}
