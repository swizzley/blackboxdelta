import Nav from "../common/Nav";
import Containers from "../post/Containers";
import Foot from "../common/Foot";
import {Site as SiteMap} from "../../context/Types";

interface PostProps {
    Site: SiteMap[];
}

export function Main(props: PostProps) {
    const {Site} = props;

    return (
        <div>
            <Nav Site={Site}/>
            <Containers/>
            <Foot/>
        </div>
    )
}

