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
import Neo from './scenes/neo/Neo';
import Devices from './scenes/devices/Devices';
import Error404 from './scenes/common/404';
import ErrorBoundary from './scenes/common/ErrorBoundary';

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
            <Router>
                <Routes>
                    <Route path="/" element={<Dashboard/>}/>
                    <Route path="/history" element={<AuthedRoute><History/></AuthedRoute>}/>
                    <Route path="/analysis" element={<AdminRoute><Analysis/></AdminRoute>}/>
                    <Route path="/system" element={<AdminRoute><Status/></AdminRoute>}/>
                    <Route path="/health" element={<AdminRoute><System/></AdminRoute>}/>
                    <Route path="/profiles" element={<AdminRoute><Profiles/></AdminRoute>}/>
                    <Route path="/profiles/all" element={<AdminRoute><ProfilesAll/></AdminRoute>}/>
                    <Route path="/optimizer" element={<AdminRoute><Optimizer/></AdminRoute>}/>
                    <Route path="/neo" element={<AdminRoute><Neo/></AdminRoute>}/>
                    <Route path="/day/:year/:month/:day" element={<AuthedRoute><DayDetail/></AuthedRoute>}/>
                    <Route path="/trade/:year/:month/:day/:id" element={<AuthedRoute><TradeDetail/></AuthedRoute>}/>
                    <Route path="/devices" element={<Devices/>}/>
                    <Route path="*" element={<Error404/>}/>
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}
