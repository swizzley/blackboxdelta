import {Site as SiteMap} from '../../context/Types';
import Section from "./Section";
import {useTheme} from "../../context/Theme";
import Tags from "../common/Tags";
import Cal from "./Cal";
import {useEffect, useState} from "react";
import {ChevronDoubleDownIcon} from "@heroicons/react/20/solid";
import '../../assets/global.css'

interface ContainersProps {
    Site: SiteMap[];
    Mode: string
}

export function Containers(props: ContainersProps) {
    const {Site, Mode} = props;
    const {isDarkMode} = useTheme();
    const [isTagsDrawerOpen, setIsTagsDrawerOpen] = useState(false);

    // Function to handle toggling the drawer
    const toggleTagsDrawer = () => {
        setIsTagsDrawerOpen(!isTagsDrawerOpen);
    };
    useEffect(() => {
        if (innerWidth >= 1024) {
            setIsTagsDrawerOpen(true)
        }
    }, [innerWidth]);


    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div  className={`${isTagsDrawerOpen ? 'slide-down' : 'slide-up'} grid grid-cols-1 gap-4 h-screen rounded-lg`}>
                        <section aria-labelledby="bbd-filters">
                            <div
                                className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg `}>
                                {innerWidth < 1024 ? (
                                    <button
                                        onClick={toggleTagsDrawer}
                                        className={`shadow-lg font-light flex items-center justify-between ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 rounded-lg w-full`}
                                    >
                                        <span className={`ml-4 text-lg`}>Filter Signals</span>
                                        <ChevronDoubleDownIcon className="w-6 h-6"/>
                                    </button>
                                ) : (
                                    <button
                                        onClick={toggleTagsDrawer}
                                        className={`hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 rounded-lg  w-full`}
                                    >
                                        <span className={`ml-4`}>Filters</span>
                                        <ChevronDoubleDownIcon className="w-6 h-6"/>
                                    </button>
                                )}
                                {isTagsDrawerOpen && (
                                    <div>
                                        <h2 className="sr-only" id="tags">
                                            Tags
                                        </h2>
                                        <Tags Site={Site}/>
                                        <h2 className="sr-only" id="section-2-title">
                                            Dates
                                        </h2>
                                        <div
                                            className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg`}
                                        >
                                            <Cal/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Main column */}
                    <div
                        className={`grid grid-cols-1 gap-4 lg:col-span-2`}>
                        <section aria-labelledby="bbd-signals">
                            <div className="">
                                <div className="w-full">
                                    <Section Site={Site} Mode={Mode}/>
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