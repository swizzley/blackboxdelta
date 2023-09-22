import Foot from "../common/Foot";
import Nav from "../common/Nav";
import Main from "./Main";


export default function Home() {
    return (
        <div className="min-h-full">
            <Nav/>
            <Main/>
            <Foot/>
        </div>
    )
}
