import * as React from 'react';
import {Site as SiteMap, Tag} from "../../context/Types";
import {useTheme} from "../../context/Theme";

interface TagsProps {
    Site: SiteMap[];
}

export default function Tags(props: TagsProps) {
    const {isDarkMode} = useTheme();
    const {Site} = props;
    // Remove duplicates from allTags to get uniqueTags
    const excludedTags = ["Long", "Short"];
    const uniqueTags = Array.from(
        new Set(Site.flatMap((site) => site.tags))
    ).filter((tag) => !excludedTags.includes(tag));

    const tags: Tag[] = uniqueTags.map((tag, index) => ({
        key: index,
        label: tag,
        href: `/${tag}`,
        current: location.pathname.includes(`/${tag}`)
    }));

    const [tagData] = React.useState<Tag[]>(tags);
    tagData.sort((a, b) => a.label.localeCompare(b.label));

    console.log(tagData)

    return (
        <div className={`flex flex-wrap justify-center p-2 list-none rounded-lg gap-x-2 gap-y-2 overflow-x-auto`}>
            {tagData.map((data) => {
                return (
                    <div key={data.key}
                         className={`${data.current ? 'bg-cyan-300' : isDarkMode ? 'bg-gray-500' : 'bg-gray-300'} px-3 py-1 rounded-full`}>
                        <a href={data.href}>
                            <span className={`${isDarkMode ? '' : ''}`}>{data.label}</span>
                        </a>
                    </div>
                );
            })}
        </div>
    );

}