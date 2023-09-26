import React from "react";
import {PostType} from "../../Types";
import {SymbolInfo} from "react-tradingview-embed";

interface PostProps {
    posts: PostType[];
}


const Section: React.FC<PostProps> = ({posts}) => {
    return (
        <div className="bg-white sm:py-32">
            <div className="-mt-48 mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl lg:max-w-4xl">
                    <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-20">
                        {posts.map((post) => (
                            <article key={post.id} className="relative isolate flex flex-col gap-4 lg:flex-row">
                                <div>
                                    <div className={"container mx-auto left-0 -ml-6"}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                colorTheme: "light",
                                                width: innerWidth < 800 ? innerWidth - 48 : 310,
                                            }
                                        }/>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-x-4 text-xs">
                                        <time dateTime={post.date} className="text-gray-500">
                                            {post.date}
                                        </time>
                                        <a
                                            href={post.url}
                                            className="relative z-10 rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
                                        >
                                            {post.title}
                                        </a>
                                    </div>
                                    <div className="group relative max-w-xl">
                                        <h3 className="mt-3 text-2xl font-medium leading-6 text-gray-900 group-hover:text-gray-600">
                                            <a href={post.url}>
                                                <span className="absolute inset-0"/>
                                                {post.title}
                                            </a>
                                        </h3>
                                        <p className="mt-5 text-xl font-light leading-6 text-gray-600">{post.summary}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Section;