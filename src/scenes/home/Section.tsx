import {useEffect, useState} from "react";
import {PostType, Site as SiteMap} from '../../context/Types';
import {useTheme} from "../../context/Theme";
import axios from 'axios'
import {SymbolInfo} from "react-tradingview-embed";
import {exchangeName} from "../common/Util";

interface SectionProps {
    Site: SiteMap[];
    Mode: string
}

export function Section(props: SectionProps) {
    const {isDarkMode} = useTheme();
    const {Site, Mode} = props;

    let sortedSite = [...Site];
    sortedSite.sort((a, b) => b.id - a.id);

    switch (Mode.toLowerCase()) {
        case "all":
            // No filtering needed for "All"
            break;
        case "date":
            const path = window.location.pathname
            const trimPath = path.replace(/\/posts\//g, '');
            const formattedDate = trimPath.replace(/\//g, '-');
            sortedSite = sortedSite.filter((siteMap) =>
                siteMap.date === formattedDate
            );
            break;
        default:
            // Filter the sortedSite based on Mode
            sortedSite = sortedSite.filter((siteMap) =>
                siteMap.tags.some((tag) => tag.toLowerCase() === Mode.toLowerCase())
            );
            break;
    }

    const [itemsPerPage, setItemsPerPage] = useState<number>(10);
    const [lastFetchedItem, setLastFetchedItem] = useState<number>(0);

    function initPosts() {
        const fetchPromises = sortedSite
            .slice(0, itemsPerPage)
            .map((siteMap: SiteMap) =>
                axios
                    .get(siteMap.url + '.json')
                    .then((response) => {
                        if (response.status === 200) {
                            const data: PostType = response.data;
                            setLastFetchedItem(itemsPerPage - 1);
                            return data;
                        } else {
                            throw new Error(`Failed to fetch data from ${siteMap.url}.json`);
                        }
                    })
                    .catch((error) => {
                        console.error('Error loading JSON data:', error);
                        return
                    })
            );

        return Promise.all(fetchPromises)
            .then((results) => results.filter((result) => result !== null)) as Promise<PostType[]>;
    }

    const [posts, setPosts] = useState<PostType[]>([]);
    useEffect(() => {
        initPosts()
            .then((sectionPosts: PostType[]) => {
                setPosts(sectionPosts);
            });
    }, []); // Ensure this effect runs only once on component mount

    const [hasMoreItems, setHasMoreItems] = useState<boolean>(true);
    const [isFetching, setIsFetching] = useState<boolean>(false);

    // Inside your component
    const [scrollPosition, setScrollPosition] = useState(0);

    // Create a function to handle the scroll event
    const handleScroll = () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        // console.log("Scroll Position", scrollTop + clientHeight, scrollHeight-3500)

        if (!hasMoreItems || isFetching) {
            return;
        }

        if (scrollTop + clientHeight >= scrollHeight - 3500) {
            setScrollPosition(scrollTop); // Update the scroll position
        }
    };

    // Attach the debounced scroll event listener
    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [hasMoreItems, isFetching]);

    // Use another useEffect to fetch data when the scroll position changes
    useEffect(() => {
        if (lastFetchedItem > 0) {
            setItemsPerPage(1)
        }

        if (scrollPosition > 0) {
            setIsFetching(true);

            // Ensure nextItemIndex is within bounds
            if (lastFetchedItem + 1 < sortedSite.length) {
                const nextItemIndex = lastFetchedItem + itemsPerPage;
                for (let i = lastFetchedItem; i < nextItemIndex; i++) {
                    const site = sortedSite[i];
                    if (!site) {
                        break
                    }
                    axios
                        .get(site.url + '.json')
                        .then((response) => {
                            if (response.status === 200) {
                                const data: PostType = response.data;
                                setLastFetchedItem(nextItemIndex);
                                setPosts((prevPosts) => [...prevPosts, data]);
                            } else {
                                throw new Error(`Failed to fetch data from ${site.url}.json`);
                            }
                        })
                        .catch((error) => {
                            console.error('Error loading JSON data:', error);
                            setIsFetching(false);
                            return
                        }).finally(() => {
                        setIsFetching(false);
                    })
                }
            } else {
                setHasMoreItems(false)
            }
        }
    }, [scrollPosition]);

    // Create a Set to store unique post IDs
    const uniquePostIds = new Set();
    // Filter posts to remove duplicates based on post ID
    const deduplicatedPosts = posts.filter((post) => {
        if (!uniquePostIds.has(post.id)) {
            uniquePostIds.add(post.id);
            return true;
        }
        return false;
    });


    function date(d: string) {
        const dateComponents = d.split("-");
        const year = parseInt(dateComponents[0]);
        const month = parseInt(dateComponents[1]) - 1;
        const day = parseInt(dateComponents[2]);
        return new Date(year, month, day);
    }

    function widthString() {
        switch (true) {
            case innerWidth <= 768:
                return `w-[${innerWidth - 128}px]`

            case innerWidth < 1024:
                return `w-[${innerWidth / 1.6 | 0}px]`

            default:
                return `w-[310px]`
        }
    }
    function width() {
        switch (true) {
            case innerWidth <= 768:
                return innerWidth - 105

            case innerWidth < 1024:
                return innerWidth / 1.6 | 0

            default:
                return 310
        }
    }

    return (
        <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} rounded-lg transition-colors duration-500 sm:py-32`}>
            <div
                className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} rounded-lg shadow-lg transition-colors duration-500 -mt-48 mx-auto max-w-7xl px-6 lg:px-8`}>
                <div className="mx-auto max-w-2xl lg:max-w-4xl">
                    <div className="mt-16 lg:mt-20 space-y-4">
                        {deduplicatedPosts.map((post: PostType, index: number) => (
                            <article key={index}
                                     className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} relative isolate flex flex-col lg:flex-row p-4 rounded-lg`}>
                                <div>
                                    <div
                                        className={`container mx-auto left-0 mr-5 ${widthString()}`}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${exchangeName(post.company.exchange)}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: width(),
                                            }
                                        }
                                        />
                                    </div>
                                </div>

                                <div>
                                    <a className="flex items-center gap-x-4 text-xs"
                                       href={`/posts/${post.date.replace(/-/g, '\/')}`}>
                                        <time dateTime={date(post.date).toDateString()} className="text-gray-400">
                                            {date(post.date).toDateString()}
                                        </time>
                                    </a>
                                    <div className="group relative max-w-xl">
                                        <h3 className="mt-3 text-2xl font-medium leading-6 group-hover:text-gray-600">
                                            <a href={post.url}>
                                                <span className="absolute inset-0"/>
                                                {post.title}
                                            </a>
                                        </h3>
                                        <p className="mt-5 text-xl font-light leading-6 ">{post.content[0].text}</p>
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