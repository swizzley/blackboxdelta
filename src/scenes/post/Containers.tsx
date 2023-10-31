import {useEffect, useState} from "react";
import {BlogPostSection, PostType} from "../../context/Types";
import {
    AdvancedChart,
    CompanyProfile,
    FundamentalData,
    SymbolInfo,
    TechnicalAnalysis,
    Timeline
} from "react-tradingview-embed";
import Disclaimer from "../common/Disclaimer";
import axios from 'axios'
import {useTheme} from "../../context/Theme";
import {exchangeName} from "../common/Util";
import Tags from "./Tags";

export default function Containers() {
    const {isDarkMode} = useTheme();

    const pathname = window.location.pathname
    const path = pathname.split("/")
    const year = path[2]
    const month = path[3]
    const day = path[4]
    const symbol = path[5]

    const [post, setPost] = useState<PostType>({
        company: {
            country: "",
            symbol: "",
            currency: "",
            exchange: "",
            ipo: "",
            name: "",
            marketCap: 0,
            phone: "",
            outstanding: "",
            website: "",
            logo: "",
            industry: "",
        },
        content: [],
        date: "",
        day: 0,
        id: 0,
        month: 0,
        news: [],
        tags: [],
        title: "",
        url: "",
        weekday: "",
        year: 0
    });

    useEffect(() => {
        const jsonFilePath = `/posts/${year}/${month}/${day}/${symbol}.json`;
        axios.get(jsonFilePath)
            .then((response) => {
                setPost(response.data);
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, []);

    if (post.id <= 0) {
        return <div/>
    }

    function date(d: number) {
        return new Date(d * 1000)
    }

    function widthString() {
        switch (true) {
            case innerWidth <= 768:
                return `w-[92vw]`

            case innerWidth < 1024:
                return `w-[74vw]`

            default:
                return `w-[29vw]`
        }
    }

    function width() {
        switch (true) {
            case innerWidth <= 768:
                return  (92 / 100) * window.innerWidth | 0;

            case innerWidth < 1024:
                return (74 / 100) * window.innerWidth | 0;

            default:
                return  (29 / 100) * window.innerWidth | 0;
        }
    }

    return (
        <main className="-mt-24 pb-8 rounded-lg">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8 rounded-lg">
                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8 rounded-lg">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2 rounded-lg">
                        <section aria-labelledby="article">
                            <h2 className="sr-only" id="article">
                                Article
                            </h2>
                            <div
                                className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 shadow rounded-lg`}>
                                <div className="rounded-lg">
                                    <div className={"container mx-auto left-0 rounded-lg p-1"}>
                                        <AdvancedChart widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                theme: isDarkMode ? "dark" : "light",
                                                hide_top_toolbar: true,
                                                height: 450,
                                                interval: "D",
                                                range: "6M",
                                                hide_side_toolbar: true,
                                                withdateranges: true,
                                                allow_symbol_change: false,
                                                enable_publishing: false,
                                            }
                                        }
                                        />
                                    </div>
                                    <Tags Post={post}/>
                                    <div className={"container px-8 pt-8 font-serif"}>
                                        <a className={`text-2xl hover:underline`}
                                           href={post.company.website} target={`_blank`}>{post.company.name}</a>
                                        {post.content && post.content.map((section: BlogPostSection, index) => (
                                            <div key={index}>
                                                <span className="text-lg">{section.section}</span>
                                                <p className="text-sm pb-4">{section.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <Disclaimer/>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right column */}
                    <div className={`grid grid-cols-1 gap-4 w-[30vw]`}>
                        <section aria-labelledby="data">
                            <h2 className="sr-only" id="data">
                                Data
                            </h2>
                            <div
                                className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 shadow rounded-lg bg-white shadow`}>
                                <div className={`p-1`}>
                                    <div
                                        className={`container mx-auto mr-5 ${widthString()}`}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: width(),
                                            }
                                        }
                                        />
                                    </div>
                                    <div className={"container mx-auto left-0 -ml-[0.5px]"}>
                                        <TechnicalAnalysis widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: width(),
                                                interval: "1D"
                                            }
                                        }/>
                                    </div>
                                    {
                                        post.news ?
                                            <div
                                                className={`${widthString()} box-border border-[1px] ${isDarkMode ? 'bg-[#1e222d] border-gray-600' : 'bg-light border-gray-200'} relative -mt-24`}>
                                                <div className={`text-3xl pb-2 pt-4 font-light  `}>
                                                    <span
                                                        className={`pl-4 pr-2 text-[#2862FF]`}>{post.company.symbol}</span>
                                                    <span>Timeline</span>
                                                </div>
                                                <ul role="list"
                                                    className={`${widthString()} divide-y h-[777px] overflow-y-auto`}>
                                                    {post.news.map((news) => (
                                                        <li key={news.id}
                                                            className={`${widthString()} ${isDarkMode ? 'bg-[#1e222d] border-gray-600' : 'bg-light border-gray-200'} box-border border-r-[1px] flex gap-x-4 py-4 overflow-x-hidden`}>
                                                            <img
                                                                className="h-12 w-12 flex-none rounded-full ml-2 bg-gray-300"
                                                                src={news.image ? news.image : '/img/bbd-logo.svg'}
                                                                alt=""/>
                                                            <div className={`${widthString()}`}>
                                                                <div className={`${isDarkMode ? 'bg-[#1e222d]' : 'bg-light'} `}>
                                                                    <a href={news.url} target="_blank" className="text-xs text-gray-500">
                                                                        <time dateTime={date(news.date).toDateString()}>{date(news.date).toDateString()}</time>
                                                                    </a>
                                                                </div>

                                                                <div className={`${isDarkMode ? 'bg-[#1e222d]' : 'bg-light'} py-2`}>
                                                                    <a href={news.url} target="_blank" className="text-sm font-semibold leading-6 flex-wrap">
                                                                        {news.headline}
                                                                    </a>
                                                                </div>

                                                                <a href={news.url} target="_blank" className="mt-1 text-sm leading-6 text-gray-400">
                                                                    {news.summary}
                                                                </a>
                                                            </div>

                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            :
                                            <div className={"container mx-auto left-0 -mt-24 -ml-[0.5px]"}>
                                                <Timeline widgetProps={
                                                    {
                                                        colorTheme: isDarkMode ? 'dark' : 'light',
                                                        width: width(),
                                                        height: 777,
                                                        // @ts-ignore
                                                        feedMode: "symbol",
                                                        symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                    }
                                                }/>
                                            </div>
                                    }
                                    <div className={" container mx-auto left-0 -ml-[0.5px]"}>
                                        <CompanyProfile widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                width: width(),
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                height: 777
                                            }
                                        }/>
                                    </div>

                                    <div className={"container mx-auto left-0 -ml-[0.5px]"}>
                                        <FundamentalData widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                width: width(),
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                height: 777
                                            }
                                        }/>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}