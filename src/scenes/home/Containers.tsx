import {Site as SiteMap} from '../../context/Types';
import Section from "./Section";
import {useTheme} from "../../context/Theme";
import Tags from "../common/Tags";
import Cal from "./Cal";
import {useEffect, useState} from "react";
import {ChevronDoubleDownIcon} from "@heroicons/react/20/solid";

interface ContainersProps {
    Site: SiteMap[];
    Mode: string
}

export function Containers(props: ContainersProps) {
    const {Site, Mode} = props;
    const {isDarkMode} = useTheme();
    const [isTagsDrawerOpen, setIsTagsDrawerOpen] = useState(false); // State to manage drawer open/close

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
                    <div className={`grid grid-cols-1 gap-4 w-[${innerWidth / 4 | 0}px] h-screen`}>
                        <section aria-labelledby="bbd-filters">
                            <div
                                className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg mb-4`}>
                                {innerWidth < 1024 ? (
                                    <button
                                        onClick={toggleTagsDrawer}
                                        className={`shadow-lg font-light flex items-center justify-between ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 rounded-lg mb-4 w-full`}
                                    >
                                        <span className={`ml-4 text-lg`}>Filter Signals</span>
                                        <ChevronDoubleDownIcon className="w-6 h-6"/>
                                    </button>
                                ) : (
                                    <button
                                        onClick={toggleTagsDrawer}
                                        className={`hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 rounded-lg mb-4 w-full`}
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
                        className={`grid grid-cols-1 gap-4 lg:col-span-2 ${innerWidth < 1024 ? isTagsDrawerOpen ? '-mt-[200px]' : '-mt-[720px]' : ''}`}>
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