import  {useEffect, useState} from "react";
import {PostType, Site as SiteMap} from '../../context/Types';
import {useTheme} from "../../context/Theme";
import axios from 'axios'
import {SymbolInfo} from "react-tradingview-embed";

interface SectionProps {
    Site: SiteMap[];
}

export function Section(props: SectionProps) {
    const {isDarkMode} = useTheme();
    const {Site} = props;

    const sortedSite = [...Site];
    sortedSite.sort((a, b) => b.id - a.id);

    let itemsPerPage = 10;

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

        if (!hasMoreItems || isFetching) {
            return;
        }

        if (scrollTop + clientHeight >= scrollHeight - 200) {
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
        if (scrollPosition > 110) {
            setIsFetching(true);

            // Ensure nextItemIndex is within bounds
            if (lastFetchedItem + 1 < sortedSite.length) {
                const nextItemIndex = lastFetchedItem + itemsPerPage;
                sortedSite.map((site: SiteMap) => {
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
                            return
                        })
                })
            } else {
                setHasMoreItems(false)
            }
        }
    }, [scrollPosition, lastFetchedItem, itemsPerPage, sortedSite]);


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

    console.log("POSTS:", deduplicatedPosts)

    return (
        <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} transition-colors duration-500 sm:py-32 rounded-lg`}>
            <div
                className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-200'} transition-colors duration-500 -mt-48 mx-auto max-w-7xl px-6 lg:px-8`}>
                <div className="mx-auto max-w-2xl lg:max-w-4xl">
                    <div className="mt-16 lg:mt-20 space-y-4">
                        {deduplicatedPosts.map((post: PostType, index: number) => (
                            <article key={index}
                                     className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} relative isolate flex flex-col lg:flex-row p-4 rounded-lg`}>
                                <div>
                                    <div className={"container mx-auto left-0 p-4"}>
                                        <SymbolInfo widgetProps={
                                            {
                                                symbol: `${post.company.exchange}:${post.company.symbol}`,
                                                colorTheme: isDarkMode ? "dark" : "light",
                                                width: innerWidth < 1000 ? innerWidth < 800 ? innerWidth - 150 : innerWidth / 1.6 | 0 : 310,
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