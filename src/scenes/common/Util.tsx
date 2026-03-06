// Format a dollar value with appropriate precision.
// Values >= $0.01 use normal 2-decimal format: +$1.23
// Values < $0.01 (but non-zero) use scientific notation: +$3.5e-4
// This prevents sub-cent P&L from displaying as "$0.00" which hides real data.
export function formatDollar(value: number): string {
    const sign = value >= 0 ? '+' : '-';
    const abs = Math.abs(value);
    if (abs === 0) return '$0.00';
    if (abs >= 0.01) return `${sign}$${abs.toFixed(2)}`;
    return `${sign}$${abs.toExponential(1)}`;
}

export function exchangeName(exchange: string) {
    switch (exchange) {
        case "NEW YORK STOCK EXCHANGE, INC.":
            return "NYSE"
        case "NASDAQ NMS - GLOBAL MARKET":
            return "NASDAQ"
        case "NYSE MKT LLC":
            return "AMEX"
        case "TORONTO STOCK EXCHANGE":
            return "AMEX"
        case "TEL AVIV STOCK EXCHANGE":
            return "TASE"
        case "TSX VENTURE EXCHANGE - NEX":
            return "AMEX"
        case "OTC MARKETS":
            return "OTC"
        case "AEQUITAS NEO EXCHANGE":
            return "NEO"
        default:
            return exchange
    }
}