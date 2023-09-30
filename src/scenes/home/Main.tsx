import Nav from "../common/Nav";
import Foot from "../common/Foot";
import Containers from "./Containers";
import {Site as SiteMap} from "../../context/Types";

interface MainProps {
    Site: SiteMap[];
    Mode: string;
}

export function Main(props: MainProps) {
    const {Site, Mode} = props;
    return (
        <div>
            <Nav Site={Site}/>
            <Containers Site={Site} Mode={Mode}/>
            <Foot/>
        </div>
    )
}

export default Main