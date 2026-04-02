import {useTheme} from '../../context/Theme';

interface PaginationProps {
    page: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({page, totalItems, pageSize, onPageChange}: PaginationProps) {
    const {isDarkMode} = useTheme();
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, totalItems);

    return (
        <div className={`flex items-center justify-between pt-3 mt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {start}–{end} of {totalItems}
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-slate-700 text-gray-200 disabled:opacity-30' : 'bg-gray-100 text-gray-700 disabled:opacity-30'}`}
                >
                    Prev
                </button>
                <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {page + 1} / {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-slate-700 text-gray-200 disabled:opacity-30' : 'bg-gray-100 text-gray-700 disabled:opacity-30'}`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
