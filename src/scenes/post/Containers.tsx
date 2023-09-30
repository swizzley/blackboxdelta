import {useEffect, useState} from "react";
import {BlogPostSection, PostType} from "../../context/Types";
import {AdvancedChart, CompanyProfile, FundamentalData, TechnicalAnalysis, Timeline} from "react-tradingview-embed";
import Disclaimer from "../common/Disclaimer";
import axios from 'axios'
import {useTheme} from "../../context/Theme";
import {exchangeName} from "../common/Util";

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

    // Function to handle image load failure
    const handleImageLoadError = (ex) => {
        console.log("ERROR LOADING EXCHANGE", ex)
    };
    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2">
                        <section aria-labelledby="section-1-title">
                            <div
                                className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 shadow`}>
                                <div className="">
                                    <div className={"container mx-auto left-0"}>
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
                                                       onLoad={() => handleImageLoadError("loaded")}
                                                       onError={() => handleImageLoadError(post.company.exchange)}
                                        />
                                    </div>
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
                    <div className="grid grid-cols-1 gap-4">
                        <section aria-labelledby="section-2-title">
                            <h2 className="sr-only" id="section-2-title">
                                Data
                            </h2>
                            <div
                                className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 shadow rounded-lg bg-white shadow`}>
                                <div className="">
                                    <div className={"container mx-auto left-0"}>
                                        <TechnicalAnalysis widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
                                                interval: "1D"
                                            }
                                        }/>
                                    </div>
                                    {
                                        post.news ?
                                            <div
                                                className={`${innerWidth < 800 ? `w-[${innerWidth - 48}px]` : 'w-[385px]'} border-[1px] border-gray-600 bg-[#1e222d] relative -mt-24 `}>
                                                <div className={`text-3xl pb-2 pt-4 font-light  `}>
                                                    <span
                                                        className={`pl-4 pr-2 text-[#2862FF]`}>{post.company.symbol}</span>
                                                    <span>Timeline</span>
                                                </div>
                                                <ul role="list"
                                                    className={` divide-y h-[777px] overflow-y-auto`}>
                                                    {post.news.map((news) => (
                                                        <li key={news.id}
                                                            className={`${isDarkMode ? 'bg-[#1e222d]' : 'bg-light'} flex gap-x-4 py-5`}>
                                                            <img className="h-12 w-12 flex-none rounded-full ml-2"
                                                                 src={news.image ? news.image : '/img/bbd-logo.svg'}
                                                                 alt=""/>
                                                            <div className="flex-auto">
                                                                <div
                                                                    className={`${isDarkMode ? 'bg-[#1e222d]' : 'bg-light'} ${console.log(innerWidth) && innerWidth < 800 ? `w-full` : 'w-[300px]'} flex items-baseline justify-between gap-x-4`}>
                                                                    <a href={news.url} target={`_blank`} className="text-sm font-semibold leading-6 truncate">{news.headline}</a>
                                                                    <a href={news.url} target={`_blank`} className="flex-none text-xs mr-3">
                                                                        <time dateTime={date(news.date).toDateString()}>{date(news.date).toDateString()}</time>
                                                                    </a>
                                                                </div>
                                                                <a href={news.url} target={`_blank`} className="mt-1 line-clamp-2 text-sm leading-6 text-gray-400 ">{news.summary}</a>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            :
                                            <div className={"container mx-auto left-0 -mt-24"}>
                                                <Timeline widgetProps={
                                                    {
                                                        colorTheme: isDarkMode ? 'dark' : 'light',
                                                        width: innerWidth < 1200 ? innerWidth < 800 ? innerWidth - 48 : innerWidth / 3.35 | 0 : 384,
                                                        height: 777,
                                                        // @ts-ignore
                                                        feedMode: "symbol",
                                                        symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                    }
                                                }/>
                                            </div>
                                    }
                                    <div className={" container mx-auto left-0"}>
                                        <CompanyProfile widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                height: 777
                                            }
                                        }/>
                                    </div>

                                    <div className={"container mx-auto left-0"}>
                                        <FundamentalData widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
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