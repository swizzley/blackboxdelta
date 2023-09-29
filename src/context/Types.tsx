
export interface SiteMap {
    Posts: Site[];
}

export interface Site {
    id: number;
    symbol: string;
    title: string;
    date: string;
    day: string;
    url: string;
    tags: string[];
}

export interface PostType {
    id: number;
    company: Company;
    year: number;
    month: number;
    day: number;
    weekday: string;
    title: string;
    date: string;
    url: string;
    content: BlogPostSection[];
    tags: string[];
    news: News[];
}

export interface BlogPostSection {
    section: string;
    text: string;
}

export interface Company {
    country: string;
    currency: string;
    exchange: string;
    ipo: string;
    marketCap: number;
    name: string;
    phone: string;
    outstanding: string;
    symbol: string;
    website: string;
    logo: any;
    industry: string;
}

export interface News {
    category: string;
    date: number;
    headline: string;
    id: number;
    image: string;
    publisher: string;
    summary: string;
    url: string;
}