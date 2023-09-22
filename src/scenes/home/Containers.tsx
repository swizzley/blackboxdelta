import PostCard from "./PostCard";
import React from "react";

import {PostType} from "./Types";

interface PostProps {
    posts: PostType[];
}

const Containers: React.FC<PostProps> = ({posts}) => {
    return (
        <main className="-mt-24 pb-8">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                {/* Main 3 column grid */}
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-8">
                    {/* Left column */}
                    <div className="grid grid-cols-1 gap-4 lg:col-span-2">
                        <section aria-labelledby="section-1-title">
                            <h2 className="sr-only" id="section-1-title">
                                Section title
                            </h2>
                            <div className="rounded-lg bg-white shadow">
                                <div className="p-6 h-screen">
                                    {posts.map((post) => (
                                        <PostCard key={post.id} post={post}/>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right column */}
                    <div className="grid grid-cols-1 gap-4">
                        <section aria-labelledby="section-2-title">
                            <h2 className="sr-only" id="section-2-title">
                                Section title
                            </h2>
                            <div className="rounded-lg bg-white shadow">
                                <div className="p-6 h-screen">Tags & Categories</div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    )
}
export default Containers