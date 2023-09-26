import React from "react";
import {PostType} from '../../context/Types';
import {SymbolInfo} from "react-tradingview-embed";
import {useTheme} from "../../context/Theme";

interface PostProps {
    posts: PostType[];
}


const Section: React.FC<PostProps> = ({posts}) => {
    const { isDarkMode } = useTheme();

    return (
        <div  className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 sm:py-32`}>
            <div className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 -mt-48 mx-auto max-w-7xl px-6 lg:px-8`}>
                <div className="mx-auto max-w-2xl lg:max-w-4xl">
                    <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-20">
                        {posts.map((post) => (
                            <article key={post.id} className="relative isolate flex flex-col gap-4 lg:flex-row">
                                <div>
                                    <div className={"container mx-auto left-0 -ml-6"}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                colorTheme: isDarkMode ? "dark": "light",
                                                width: innerWidth < 800 ? innerWidth - 48 : 310,
                                            }
                                        }/>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-x-4 text-xs">
                                        <time dateTime={post.date} className="text-gray-400">
                                            {post.date}
                                        </time>
                                        <a
                                            href={post.url}
                                            className={`${isDarkMode ? 'bg-gray-700 hover:bg-gray-900' : 'bg-gray-200 text-gray-500 hover:bg-gray-800'} relative z-10 rounded-full px-3 py-1.5 font-medium `}
                                        >
                                            {post.title}
                                        </a>
                                    </div>
                                    <div className="group relative max-w-xl">
                                        <h3 className="mt-3 text-2xl font-medium leading-6 group-hover:text-gray-600">
                                            <a href={post.url}>
                                                <span className="absolute inset-0"/>
                                                {post.title}
                                            </a>
                                        </h3>
                                        <p className="mt-5 text-xl font-light leading-6 ">{post.summary}</p>
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