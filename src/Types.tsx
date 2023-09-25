
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
    symbol: string;
    exchange: string;
    logo: boolean;
    year: number;
    month: number;
    day: number;
    title: string;
    summary: string;
    author: string;
    date: string;
    url: string;
    content: BlogPostSection[];
}

export interface BlogPostSection {
    section: string;
    text: string;
}