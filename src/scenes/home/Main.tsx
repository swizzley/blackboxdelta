import Nav from "../common/Nav";
import Foot from "../common/Foot";
import Containers from "./Containers";
import {PostType} from "../../Types";
import React from "react";

interface PostProps {
    posts: PostType[]; // Use the PostType interface as the prop type
}

const Main: React.FC<PostProps> = ({posts}) => {
    return (
        <div>
            <Nav/>
            <Containers posts={posts}/>
            <Foot/>
        </div>
    )
}
export default Main