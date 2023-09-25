import React from "react";
import {BlogPostSection, PostType} from "../../Types";
import {AdvancedChart, FundamentalData, TechnicalAnalysis} from "react-tradingview-embed";
import section from "../common/Section";
import Disclaimer from "../common/Disclaimer";


interface PostProps {
    post: PostType;
}

const Containers: React.FC<PostProps> = ({post}) => {

    const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    console.log(screenWidth)

    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2">
                        <section aria-labelledby="section-1-title">
                            <div className="rounded-lg bg-white shadow">
                                <div className="">
                                    <div className={"container mx-auto left-0"}>
                                        <AdvancedChart widgetProps={
                                            {
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                theme: "light",
                                                hide_top_toolbar: true,
                                                height: 450,
                                                interval: "D",
                                                range: "6M",
                                                hide_side_toolbar: true,
                                                withdateranges: true,
                                                allow_symbol_change: false,
                                                enable_publishing: false,
                                                container_id: "tradingview_a8429",
                                                style: 1,
                                                timezone: "Etc/UTC"
                                            }
                                        }/>
                                    </div>
                                    <div className={"container px-8 pt-8 font-serif"}>
                                        {post.content.map((section:BlogPostSection, index) => (
                                            <div key={index}>
                                                <span className="text-lg">{section.section}:</span>
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
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                colorTheme: "light",
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
                                                interval: "1D"
                                            }
                                        }/>
                                    </div>
                                    <div className={"container mx-auto left-0 -mt-24"}>
                                        <FundamentalData widgetProps={
                                            {
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                width: innerWidth < 800 ? innerWidth - 48 : 385,
                                                colorTheme: 'light',
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
export default Containers