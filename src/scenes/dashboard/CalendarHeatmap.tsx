import {useNavigate} from 'react-router-dom';
import {useTheme} from '../../context/Theme';
import {CalendarData} from '../../context/Types';
import {formatDollar} from '../common/Util';
import dayjs from 'dayjs';

interface CalendarHeatmapProps {
    data: CalendarData;
}

export default function CalendarHeatmap({data}: CalendarHeatmapProps) {
    const {isDarkMode} = useTheme();
    const navigate = useNavigate();

    // Show the last 3 months
    const today = dayjs();
    const months: dayjs.Dayjs[] = [];
    for (let i = 2; i >= 0; i--) {
        months.push(today.subtract(i, 'month'));
    }

    const weekdaysFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    function getCellColor(dateStr: string): string {
        const day = data[dateStr];
        if (!day) return isDarkMode ? 'bg-slate-700' : 'bg-gray-100';
        if (day.pl > 0) return day.pl > 50 ? 'bg-emerald-500' : 'bg-emerald-400/70';
        if (day.pl < 0) return day.pl < -50 ? 'bg-red-500' : 'bg-red-400/70';
        return isDarkMode ? 'bg-slate-600' : 'bg-gray-300';
    }

    function renderMonth(month: dayjs.Dayjs) {
        const start = month.startOf('month');
        const end = month.endOf('month');
        const days: (dayjs.Dayjs | null)[] = [];

        // Pad beginning
        for (let i = 0; i < start.day(); i++) {
            days.push(null);
        }
        for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
            days.push(d);
        }

        return (
            <div key={month.format('YYYY-MM')} className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {month.format('MMMM YYYY')}
                </h4>
                <div className="grid grid-cols-7 gap-1">
                    {weekdaysFull.map((wd, i) => (
                        <div key={wd}
                             className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            <span className="hidden sm:inline">{wd}</span>
                            <span className="sm:hidden">{weekdaysShort[i]}</span>
                        </div>
                    ))}
                    {days.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`}/>;
                        const dateStr = day.format('YYYY-MM-DD');
                        const entry = data[dateStr];
                        const isFuture = day.isAfter(today, 'day');
                        return (
                            <div
                                key={dateStr}
                                onClick={() => !isFuture && entry && navigate(`/day/${day.format('YYYY/MM/DD')}`)}
                                className={`
                                    aspect-square rounded-sm flex items-center justify-center text-xs
                                    ${isFuture ? 'opacity-30' : ''}
                                    ${!isFuture && entry ? 'cursor-pointer hover:ring-2 hover:ring-cyan-500' : ''}
                                    ${getCellColor(dateStr)}
                                    ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}
                                `}
                                title={entry ? `${dateStr}: ${formatDollar(entry.pl)} (${entry.winners}W/${entry.losers}L)` : dateStr}
                            >
                                {day.date()}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-4 shadow transition-colors duration-500`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Daily Performance
            </h3>
            <div className="flex gap-6 overflow-x-auto">
                {months.map(m => renderMonth(m))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"/>
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Profit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-red-500"/>
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Loss</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-sm ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}/>
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>No trades</span>
                </div>
            </div>
        </div>
    );
}
