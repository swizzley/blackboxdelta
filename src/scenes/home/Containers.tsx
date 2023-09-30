import {Site as SiteMap} from '../../context/Types';
import Section from "./Section";
import {useTheme} from "../../context/Theme";
import Tags from "../common/Tags";
import Cal from "./Cal";

interface ContainersProps {
    Site: SiteMap[];
    Mode: string
}

export function Containers(props: ContainersProps) {
    const {Site, Mode} = props;
    const {isDarkMode} = useTheme();

    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">

                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start lg:grid-cols-3 lg:gap-8">
                    {/* Right column */}
                    <div className={`grid grid-cols-1 gap-4 w-[${innerWidth / 4 | 0}px] h-screen`}>
                        <section aria-labelledby="bbd-filters">
                            <h2 className="sr-only" id="tags">
                                Tags
                            </h2>
                            <div
                                className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg mb-4`}>
                                <Tags Site={Site}/>
                            </div>
                            <h2 className="sr-only" id="section-2-title">
                                Dates
                            </h2>
                            <div
                                className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} transition-colors duration-500 shadow rounded-lg`}>
                                <Cal/>
                            </div>
                        </section>
                    </div>
                    {/* Left column */}
                    <div className={`grid grid-cols-1 gap-4 lg:col-span-2 ${innerWidth < 1024 ? '-mt-[210px]' : ''}`}>
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