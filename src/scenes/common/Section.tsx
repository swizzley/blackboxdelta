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
        <div  className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} transition-colors duration-500 sm:py-32 rounded-lg`}>
            <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} transition-colors duration-500 -mt-48 mx-auto max-w-7xl px-6 lg:px-8`}>
                <div className="mx-auto max-w-2xl lg:max-w-4xl">
                    <div className="mt-16 lg:mt-20 space-y-4">
                        {posts.map((post) => (
                            <article key={post.id} className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} relative isolate flex flex-col lg:flex-row p-4 rounded-lg`}>
                                <div>
                                    <div className={"container mx-auto left-0 p-4"}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${post.exchange}:${post.symbol}`,
                                                colorTheme: isDarkMode ? "dark": "light",
                                                width: innerWidth < 1000 ? innerWidth < 800 ? innerWidth - 150: innerWidth / 1.6 | 0 : 310,
                                            }
                                        }/>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-x-4 text-xs">
                                        <time dateTime={post.date} className="text-gray-400">
                                            {post.date}
                                        </time>
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