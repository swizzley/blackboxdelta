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
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2">
                        <section aria-labelledby="section-1-title">
                            <div className="">
                                <div className="w-full">
                                    <Section Site={Site} Mode={Mode}/>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right column */}
                    <div className={`grid grid-cols-1 gap-4 w-[${innerWidth / 4 | 0}px] h-screen`}>
                        <section aria-labelledby="section-2-title">
                            <h2 className="sr-only" id="section-2-title">
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
                </div>
            </div>
        </main>
    )
}

export default Containers