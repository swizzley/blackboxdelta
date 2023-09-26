import React from "react";
import {PostType} from '../../context/Types';
import Section from "../common/Section";
import {Timeline} from "react-tradingview-embed";
import {useTheme} from "../../context/Theme";

interface PostProps {
    posts: PostType[];
}

const Containers: React.FC<PostProps> = ({posts}) => {

    const { isDarkMode } = useTheme();

    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">

                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2">
                        <section aria-labelledby="section-1-title">
                            <div className="">
                                <div className="w-full">
                                    <Section posts={posts}/>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right column */}
                    <div className="grid grid-cols-1 gap-4">
                        <section aria-labelledby="section-2-title">
                            <h2 className="sr-only" id="section-2-title">
                                News
                            </h2>
                            <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg`}>
                                <div className="">
                                    <div className="container left-0 pb-0 rounded-lg">
                                        <Timeline widgetProps={
                                            {
                                                colorTheme: isDarkMode ? 'dark' : 'light',
                                                width: innerWidth < 800 ? innerWidth - 48 : 384,
                                                height: 800
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