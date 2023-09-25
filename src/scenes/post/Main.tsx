import React, {useEffect, useState} from 'react';
import {PostType} from "../../Types";
import axios from 'axios'
import Nav from "../common/Nav";
import Containers from "../post/Containers";
import Foot from "../common/Foot";

export function Main() {
    const pathname = window.location.pathname
    const path = pathname.split("/")
    const year = path[1]
    const month = path[2]
    const day = path[3]
    const symbol = path[4]

    const [post, setPost] = useState<PostType>({
        author: "",
        content: [],
        date: "",
        day: 0,
        id: 0,
        logo: false,
        month: 0,
        symbol: "",
        title: "",
        url: "",
        year: 0
    });

    useEffect(() => {
        const jsonFilePath = `/posts/${year}/${month}/${day}/${symbol}.json`;
        axios.get(jsonFilePath)
            .then((response) => {
                setPost(response.data);
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, []);

    return (
        <div>
            <Nav/>
            <Containers post={post}/>
            <Foot/>
        </div>
    )
}

