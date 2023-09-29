import {useEffect, useState} from "react";
import {BlogPostSection, PostType} from "../../context/Types";
import {AdvancedChart, FundamentalData, TechnicalAnalysis} from "react-tradingview-embed";
import Disclaimer from "../common/Disclaimer";
import axios from 'axios'
import {useTheme} from "../../context/Theme";

export default function Containers() {
    const {isDarkMode} = useTheme();

    const pathname = window.location.pathname
    const path = pathname.split("/")
    const year = path[1]
    const month = path[2]
    const day = path[3]
    const symbol = path[4]

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
                                                symbol: `${post.company.exchange}:${post.company.symbol}`,
                                                theme: isDarkMode ? "dark" : "light",
                                                hide_top_toolbar: true,
                                                height: 450,
                                                interval: "D",
                                                range: "6M",
                                                hide_side_toolbar: true,
                                                withdateranges: true,
                                                allow_symbol_change: false,
                                                enable_publishing: false,
                                                container_id: "tradingview_a8429"
                                            }
                                        }/>
                                    </div>
                                    <div className={"container px-8 pt-8 font-serif"}>
                                        {post.content.map((section: BlogPostSection, index) => (
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
                            <div className="rounded-lg bg-white shadow">
                                <div className="">
                                    <div className={"container mx-auto left-0"}>
                                        <TechnicalAnalysis widgetProps={
                                            {
                                                symbol: `${post.company.exchange}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
                                                interval: "1D"
                                            }
                                        }/>
                                    </div>
                                    <div className={"container mx-auto left-0 -mt-24"}>
                                        <FundamentalData widgetProps={
                                            {
                                                symbol: `${post.company.exchange}:${post.company.symbol}`,
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