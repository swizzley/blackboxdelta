import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import Dashboard from './scenes/dashboard/Dashboard';
import History from './scenes/history/History';
import DayDetail from './scenes/day/DayDetail';
import TradeDetail from './scenes/trade/TradeDetail';
import Analysis from './scenes/analysis/Analysis';
import Status from './scenes/status/Status';
import System from './scenes/system/System';
import Error404 from './scenes/common/404';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard/>}/>
                <Route path="/history" element={<History/>}/>
                <Route path="/analysis" element={<Analysis/>}/>
                <Route path="/status" element={<Status/>}/>
                <Route path="/system" element={<System/>}/>
                <Route path="/day/:year/:month/:day" element={<DayDetail/>}/>
                <Route path="/trade/:year/:month/:day/:id" element={<TradeDetail/>}/>
                <Route path="*" element={<Error404/>}/>
            </Routes>
        </Router>
    );
}
