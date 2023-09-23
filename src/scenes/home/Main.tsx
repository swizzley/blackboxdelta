import Nav from "../common/Nav";
import Foot from "../common/Foot";
import Containers from "./Containers";
import {PostType} from "../../Types";
import React, {useEffect, useState} from "react";
import axios from 'axios'


export function Main() {
    const [recent, setRecent] = useState<PostType[]>([]);

    useEffect(() => {
        const jsonFilePath = `/posts/recent.json`;
        axios.get(jsonFilePath)
            .then((response) => {
                console.log("RESP", response.data)
                setRecent(response.data);
            })
            .catch((error) => {
                console.error('Error loading JSON data:', error);
            });
    }, []);

    return (
        <div>
            <Nav/>
            <Containers posts={recent}/>
            <Foot/>
        </div>
    )
}
export default Main