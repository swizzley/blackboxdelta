import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {Main as Home} from './scenes/home/Main';
import {Main as Post} from './scenes/post/Main';

import {Site} from "./context/Types";
import {useEffect, useState} from "react";
import axios from 'axios'
import Error404 from "./scenes/common/404";

export default function App() {
    const [siteMap, setSiteMap] = useState<Site[]>([]);

    const homepage = true
    useEffect(() => {
        const jsonFilePath = `/sitemap.json`;
        axios.get(jsonFilePath)
            .then((response) => {
                console.log("SITEMAP", response.data)
                setSiteMap(response.data);
                console.log(siteMap)
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, [homepage]);

    if (siteMap.length < 1) {
        return null;
    }

    const uniqueTags = Array.from(
        new Set(siteMap.flatMap((site) => site.tags))
    );

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home Site={siteMap} Mode="All"/>}/>
                {siteMap.length > 0 && siteMap.map((site) => (
                    <Route
                        key={site.id}
                        path={site.url}
                        element={<Post Site={siteMap}/>}
                    />
                ))}
                {uniqueTags.length > 0 && uniqueTags.map((tag) => (
                    <Route
                        key={tag}
                        path={`/${tag}`}
                        element={<Home Site={siteMap} Mode={tag}/>}
                    />
                ))
                }
                <Route path="*" element={<Error404/>}/>
            </Routes>
        </Router>
    );
}
