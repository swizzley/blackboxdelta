import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Main from './scenes/home/Main';
import {Post} from './scenes/home/Post';
import posts from './posts/recent.json'
import site from './posts/sitemap.json'
import {PostType, Site} from "./Types";
export default function App() {
    const siteMap: Site[] = site;
    const recent: PostType[] = posts;
    console.log("SITEMAP", siteMap)
    console.log("POSTS", recent)
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Main posts={recent}/>} />
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
