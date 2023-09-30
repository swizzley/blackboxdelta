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