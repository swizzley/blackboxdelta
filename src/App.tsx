import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {Main as Home} from './scenes/home/Main';
import {Main as Post} from './scenes/post/Main';

import {Site} from "./Types";
import {useEffect, useState} from "react";
import axios from 'axios'
import Error404 from "./scenes/common/404";

export default function App() {
    const [siteMap, setSiteMap] = useState<Site[]>([]);

    useEffect(() => {
        const jsonFilePath = `/sitemap.json`;
        axios.get(jsonFilePath,{})
            .then((response) => {
                console.log("RESP", response.data)
                setSiteMap(JSON.parse(response.data));
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, []);

    if (siteMap === null) {
        return null;
    }

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home/>}/>
                {siteMap.map((site: Site, index: number) => (
                    <Route
                        key={site.id}
                        path={site.url}
                        element={<Post/>}
                    />
                ))}
                <Route path="*" element={<Error404/>}/>
            </Routes>
        </Router>
    );
}
