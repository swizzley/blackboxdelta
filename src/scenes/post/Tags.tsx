import * as React from 'react';
import {PostType, Site as SiteMap, Tag} from "../../context/Types";
import {useTheme} from "../../context/Theme";

interface TagsProps {
    Post: PostType;
}

export default function Tags(props: TagsProps) {
    const {isDarkMode} = useTheme();
    const {Post} = props;

    const excludedTags = ["Long", "Short", "stock"];
    const tgs = Post.tags.filter((tag) => !excludedTags.includes(tag));

    const tags: Tag[] = tgs.map((tag, index) => ({
        key: index,
        label: tag,
        href: `/${tag}`,
        current: location.pathname.includes(`/${tag}`)
    }));

    const [tagNames] = React.useState<Tag[]>(tags);
    tagNames.sort((a, b) => a.label.localeCompare(b.label));

    return (
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-400'} mx-2 flex flex-wrap justify-center p-2 list-none rounded-lg gap-x-1 gap-y-2`}>
            {tagNames.map((data) => {
                return (
                    <div key={data.key}
                         className={`${data.current ? 'bg-cyan-300' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} text-sm px-2 py-1 rounded-full font-light`}>
                        <a href={data.href}>
                            <span className={`${isDarkMode ? '' : ''}`}>
                                {data.label}
                            </span>
                        </a>
                    </div>
                );
            })}
        </div>
    );

}