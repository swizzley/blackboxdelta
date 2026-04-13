import {useState} from 'react';
import type {AnalysisTodoApi} from '../../context/Types';
import {sendTodoToOptimizer, squashTodos} from '../../api/client';
import TodoCard from './TodoCard';

function detectTodoTimeframe(todo: AnalysisTodoApi): string {
    if (!todo.mutations) return '';
    for (const key of Object.keys(todo.mutations)) {
        if (key.endsWith('.scalp')) return 'scalp';
        if (key.endsWith('.intraday')) return 'intraday';
        if (key.endsWith('.swing')) return 'swing';
    }
    return '';
}

interface Props {
    todos: AnalysisTodoApi[];
}

export default function TodoList({todos}: Props) {
    const [expandedTodo, setExpandedTodo] = useState<number | null>(null);
    const [sendingTodo, setSendingTodo] = useState<number | null>(null);
    const [sentTodos, setSentTodos] = useState<Set<number>>(new Set());
    const [selectedForSquash, setSelectedForSquash] = useState<Set<number>>(new Set());
    const [squashing, setSquashing] = useState(false);
    const [copiedTodo, setCopiedTodo] = useState<number | null>(null);

    const sorted = [...todos].sort((a, b) => a.priority - b.priority);

    return (
        <>
            {sorted.length > 0 && (
                <div className="space-y-2">
                    {sorted.map(todo => (
                        <TodoCard
                            key={todo.id}
                            todo={todo}
                            isExpanded={expandedTodo === todo.id}
                            onToggleExpand={() => setExpandedTodo(expandedTodo === todo.id ? null : todo.id)}
                            isSending={sendingTodo === todo.id}
                            isSent={sentTodos.has(todo.id)}
                            isSelectedForSquash={selectedForSquash.has(todo.id)}
                            onSend={() => {
                                setSendingTodo(todo.id);
                                sendTodoToOptimizer(todo.id).then(() => {
                                    setSentTodos(prev => new Set(prev).add(todo.id));
                                }).catch(err => {
                                    alert(`Failed: ${err.message || err}`);
                                }).finally(() => setSendingTodo(null));
                            }}
                            onToggleSquash={() => setSelectedForSquash(prev => {
                                const next = new Set(prev);
                                next.has(todo.id) ? next.delete(todo.id) : next.add(todo.id);
                                return next;
                            })}
                            copiedId={copiedTodo}
                            onCopy={(id) => {
                                setCopiedTodo(id);
                                setTimeout(() => setCopiedTodo(null), 2000);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Squash Action Bar */}
            {selectedForSquash.size >= 2 && (
                <SquashBar
                    selectedCount={selectedForSquash.size}
                    paramCount={(() => {
                        const merged: Record<string, string> = {};
                        todos.filter(t => selectedForSquash.has(t.id) && t.mutations).forEach(t => {
                            Object.assign(merged, t.mutations);
                        });
                        return Object.keys(merged).length;
                    })()}
                    squashing={squashing}
                    onSquash={() => {
                        setSquashing(true);
                        squashTodos(Array.from(selectedForSquash)).then(() => {
                            const ids = selectedForSquash;
                            setSentTodos(prev => {
                                const next = new Set(prev);
                                ids.forEach(id => next.add(id));
                                return next;
                            });
                            setSelectedForSquash(new Set());
                        }).catch(err => {
                            alert(`Squash failed: ${err.message || err}`);
                        }).finally(() => setSquashing(false));
                    }}
                    onClear={() => setSelectedForSquash(new Set())}
                />
            )}
        </>
    );
}

// Exported for use by parent to detect queueable todos
export {detectTodoTimeframe};

function SquashBar({selectedCount, paramCount, squashing, onSquash, onClear}: {
    selectedCount: number; paramCount: number; squashing: boolean; onSquash: () => void; onClear: () => void;
}) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t shadow-lg bg-slate-800 border-slate-600">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-white">
                        {selectedCount} TODOs selected
                    </span>
                    <span className="text-xs text-gray-400">
                        {paramCount} param changes
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={onClear}
                        className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 text-gray-300 hover:bg-slate-600"
                    >
                        Clear
                    </button>
                    <button
                        onClick={onSquash}
                        disabled={squashing}
                        className="px-4 py-1.5 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {squashing ? 'Squashing...' : 'Squash & Queue for Backtest'}
                    </button>
                </div>
            </div>
        </div>
    );
}
