import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {Main as Home} from './scenes/home/Main';
import {Main as Post} from './scenes/post/Main';

import {Site} from "./Types";
import {useEffect, useState} from "react";
import axios from 'axios'

export default function App() {
    const [siteMap, setSiteMap] = useState<Site[]>([]);

    useEffect(() => {
        const jsonFilePath = `/sitemap.json`;
        axios.get(jsonFilePath)
            .then((response) => {
                console.log("RESP", response.data)
                setSiteMap(response.data);
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, []);
    
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home/>}/>
                {siteMap.map((site) => (
                    <Route
                        key={site.id}
                        path={site.url}
                        element={<Post/>}
                    />
                ))}
            </Routes>
        </Router>
    );
}
