import {useNavigate} from 'react-router-dom';
import {useTheme} from '../../context/Theme';
import {CalendarData} from '../../context/Types';
import {formatPct} from '../common/Util';
import dayjs from 'dayjs';

interface CalendarHeatmapProps {
    data: CalendarData;
}

export default function CalendarHeatmap({data}: CalendarHeatmapProps) {
    const {isDarkMode} = useTheme();
    const navigate = useNavigate();

    const today = dayjs();
    const months: dayjs.Dayjs[] = [];
    for (let i = 2; i >= 0; i--) {
        months.push(today.subtract(i, 'month'));
    }

    const weekdaysFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    function getCellColor(dateStr: string): string {
        const day = data[dateStr];
        if (!day) return isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-100';
        if (day.pl > 0) return isDarkMode
            ? (day.pl > 50 ? 'bg-cyan-500' : 'bg-cyan-600/50')
            : (day.pl > 50 ? 'bg-pink-500' : 'bg-pink-400/60');
        if (day.pl < 0) return isDarkMode
            ? (day.pl < -50 ? 'bg-[#6b2020]' : 'bg-[#3a1a1a]')
            : (day.pl < -50 ? 'bg-red-400' : 'bg-red-300/60');
        return isDarkMode ? 'bg-[#252525]' : 'bg-gray-300';
    }

    function renderMonth(month: dayjs.Dayjs) {
        const start = month.startOf('month');
        const end = month.endOf('month');
        const days: (dayjs.Dayjs | null)[] = [];

        for (let i = 0; i < start.day(); i++) {
            days.push(null);
        }
        for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
            days.push(d);
        }

        return (
            <div key={month.format('YYYY-MM')} className="flex-1 min-w-0">
                <h4 className={`text-xs font-sans font-medium mb-2 ${isDarkMode ? 'text-[#888]' : 'text-gray-600'}`}>
                    {month.format('MMMM YYYY')}
                </h4>
                <div className="grid grid-cols-7 gap-1">
                    {weekdaysFull.map((wd, i) => (
                        <div key={wd}
                             className={`text-[10px] text-center font-sans ${isDarkMode ? 'text-[#444]' : 'text-gray-400'}`}>
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
                                    aspect-square rounded-sm flex items-center justify-center text-[10px] font-sans
                                    ${isFuture ? 'opacity-20' : ''}
                                    ${!isFuture && entry ? 'cursor-pointer hover:ring-1 hover:ring-cyan-500' : ''}
                                    ${getCellColor(dateStr)}
                                    ${isDarkMode ? 'text-[#999]' : 'text-gray-700'}
                                `}
                                title={entry ? `${dateStr}: ${formatPct(entry.pl)} (${entry.winners}W/${entry.losers}L)` : dateStr}
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
        <>
            <div className="flex gap-6 overflow-x-auto">
                {months.map(m => renderMonth(m))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] font-sans">
                <div className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-sm ${isDarkMode ? 'bg-cyan-500' : 'bg-pink-500'}`}/>
                    <span className={isDarkMode ? 'text-[#555]' : 'text-gray-500'}>Profit</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-sm ${isDarkMode ? 'bg-[#6b2020]' : 'bg-red-400'}`}/>
                    <span className={isDarkMode ? 'text-[#555]' : 'text-gray-500'}>Loss</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-sm ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}/>
                    <span className={isDarkMode ? 'text-[#555]' : 'text-gray-500'}>No trades</span>
                </div>
            </div>
        </>
    );
}
