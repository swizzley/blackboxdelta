import Nav from "../common/Nav";
import Foot from "../common/Foot";
import Containers from "./Containers";
import {Site as SiteMap} from "../../context/Types";

interface MainProps {
    Site: SiteMap[];
}

export function Main(props: MainProps) {
    const {Site} = props;
    return (
        <div>
            <Nav Site={Site}/>
            <Containers Site={Site}/>
            <Foot/>
        </div>
    )
}

export default Main