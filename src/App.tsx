import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Main from './scenes/home/Main';
import Post from './scenes/home/Post';

import postData from './posts.json'

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Main posts={postData}/>} />


                {postData.map((post) => (
                    <Route
                        key={post.id}
                        path={`/post/${post.year}/${post.month}/${post.day}/${post.id}`}
                        element={<Post post={post} />}
                    />
                ))}
            </Routes>
        </Router>
    );
}
