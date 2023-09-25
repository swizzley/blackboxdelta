import {Bars3Icon, XMarkIcon} from "@heroicons/react/24/outline";
import {Popover, Transition} from "@headlessui/react";
import {Fragment} from "react";
import {MagnifyingGlassIcon} from "@heroicons/react/20/solid";

const user = {
    name: 'Swizzley',
    email: 'contact@blackboxdelta.com',
    imageUrl: '/img/bbd-logo-main.svg',
}
const navigation = [
    {name: 'Latest Signals', href: '/', current: true},
    {name: 'Stocks', href: '/stocks', current: false},
    {name: 'Forex', href: 'forex', current: false},
    {name: 'Crypto', href: 'crypto', current: false},
    {name: 'Performance', href: 'perf', current: false},
]
const userNavigation = [
    {name: 'Your Profile', href: '#'},
]

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ')
}

export default function Nav() {
    return (
        <Popover as="header" className="bg-gray-600 pb-24">
            {({open}) => (
                <>
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                        <div className="relative flex items-center justify-center py-5 lg:justify-between">
                            {/* Logo */}
                            <div className="absolute left-0 flex-shrink-0 lg:static">
                                <a href="/">
                                    <span className="sr-only">Black Box Delta</span>
                                    <img
                                        className="h-12 w-auto"
                                        src="/img/bbd-logo.svg"
                                        alt="Black Box Delat"
                                    />
                                </a>
                            </div>

                            {/* Right section on desktop */}
                            <div className="hidden lg:ml-4 lg:flex lg:items-center lg:pr-0.5">

                                {/* Profile dropdown */}
                                {/*<Menu as="div" className="relative ml-4 flex-shrink-0">*/}
                                {/*    <div>*/}
                                {/*        <Menu.Button*/}
                                {/*            className="relative flex rounded-full bg-gray-600 text-sm ring-2 ring-white ring-opacity-20 focus:outline-none focus:ring-opacity-100">*/}
                                {/*            <span className="absolute -inset-1.5"/>*/}
                                {/*            <span className="sr-only">Open user menu</span>*/}
                                {/*            <img className="h-8 w-8 rounded-full" src="/img/bbd-logo-main.svg"*/}
                                {/*                 alt=""/>*/}
                                {/*        </Menu.Button>*/}
                                {/*    </div>*/}
                                {/*    <Transition*/}
                                {/*        as={Fragment}*/}
                                {/*        leave="transition ease-in duration-75"*/}
                                {/*        leaveFrom="transform opacity-100 scale-100"*/}
                                {/*        leaveTo="transform opacity-0 scale-95"*/}
                                {/*    >*/}
                                {/*        <Menu.Items*/}
                                {/*            className="absolute -right-2 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">*/}
                                {/*            {userNavigation.map((item) => (*/}
                                {/*                <Menu.Item key={item.name}>*/}
                                {/*                    {({active}) => (*/}
                                {/*                        <a*/}
                                {/*                            href={item.href}*/}
                                {/*                            className={classNames(*/}
                                {/*                                active ? 'bg-gray-100' : '',*/}
                                {/*                                'block px-4 py-2 text-sm text-gray-700'*/}
                                {/*                            )}*/}
                                {/*                        >*/}
                                {/*                            {item.name}*/}
                                {/*                        </a>*/}
                                {/*                    )}*/}
                                {/*                </Menu.Item>*/}
                                {/*            ))}*/}
                                {/*        </Menu.Items>*/}
                                {/*    </Transition>*/}
                                {/*</Menu>*/}
                            </div>

                            {/* Search */}
                            <div className="min-w-0 flex-1 px-12 lg:hidden">
                                <div className="mx-auto w-full max-w-xs">
                                    <label htmlFor="desktop-search" className="sr-only">
                                        Search
                                    </label>
                                    <div className="relative text-white focus-within:text-gray-600">
                                        <div
                                            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true"/>
                                        </div>
                                        <input
                                            id="desktop-search"
                                            className="block w-full rounded-md border-0 bg-white/20 py-1.5 pl-10 pr-3 text-white placeholder:text-white focus:bg-white focus:text-gray-900 focus:ring-0 focus:placeholder:text-gray-500 sm:text-sm sm:leading-6"
                                            placeholder="Search"
                                            type="search"
                                            name="search"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Menu button */}
                            <div className="absolute right-0 flex-shrink-0 lg:hidden">
                                {/* Mobile menu button */}
                                <Popover.Button
                                    className="relative inline-flex items-center justify-center rounded-md bg-transparent p-2 text-cyan-800 hover:bg-white hover:bg-opacity-10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white">
                                    <span className="absolute -inset-0.5"/>
                                    <span className="sr-only">Open main menu</span>
                                    {open ? (
                                        <XMarkIcon className="block h-6 w-6" aria-hidden="true"/>
                                    ) : (
                                        <Bars3Icon className="block h-6 w-6" aria-hidden="true"/>
                                    )}
                                </Popover.Button>
                            </div>
                        </div>
                        <div className="hidden border-t border-gray-300  py-5 lg:block">
                            <div className="grid grid-cols-3 items-center gap-8">
                                <div className="col-span-2">
                                    <nav className="flex space-x-4">
                                        {navigation.map((item) => (
                                            <a
                                                key={item.name}
                                                href={item.href}
                                                className={classNames(
                                                    item.current ? 'text-white' : 'text-cyan-500',
                                                    'rounded-md bg-white bg-opacity-0 px-3 py-2 text-sm font-medium hover:bg-opacity-10'
                                                )}
                                                aria-current={item.current ? 'page' : undefined}
                                            >
                                                {item.name}
                                            </a>
                                        ))}
                                    </nav>
                                </div>
                                <div>
                                    <div className="mx-auto w-full max-w-md">
                                        <label htmlFor="mobile-search" className="sr-only">
                                            Search
                                        </label>
                                        <div className="relative text-white focus-within:text-gray-600">
                                            <div
                                                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true"/>
                                            </div>
                                            <input
                                                id="mobile-search"
                                                className="block w-full rounded-md border-0 bg-white/20 py-1.5 pl-10 pr-3 text-white placeholder:text-white focus:bg-white focus:text-gray-900 focus:ring-0 focus:placeholder:text-gray-500 sm:text-sm sm:leading-6"
                                                placeholder="Search"
                                                type="search"
                                                name="search"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Transition.Root as={Fragment}>
                        <div className="lg:hidden">
                            <Transition.Child
                                as={Fragment}
                                enter="duration-150 ease-out"
                                enterFrom="opacity-0"
                                enterTo="opacity-100"
                                leave="duration-150 ease-in"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                            >
                                <Popover.Overlay className="fixed inset-0 z-20 bg-black bg-opacity-25"/>
                            </Transition.Child>

                            <Transition.Child
                                as={Fragment}
                                enter="duration-150 ease-out"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="duration-150 ease-in"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Popover.Panel
                                    focus
                                    className="absolute inset-x-0 top-0 z-30 mx-auto w-full max-w-3xl origin-top transform p-2 transition"
                                >
                                    <div
                                        className="divide-y divide-gray-200 rounded-lg bg-gray-600 shadow-lg ring-1 ring-black ring-opacity-5">
                                        <div className="pb-2 pt-3">
                                            <div className="flex items-center justify-between px-4">
                                                <div>
                                                    <img
                                                        className="h-8 w-auto"
                                                        src="/img/bbd-logo-main.svg"
                                                        alt="Black Box Delta"
                                                    />
                                                </div>
                                                <div className="-mr-2">
                                                    <Popover.Button
                                                        className="relative inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500">
                                                        <span className="absolute -inset-0.5"/>
                                                        <span className="sr-only">Close menu</span>
                                                        <XMarkIcon className="h-6 w-6" aria-hidden="true"/>
                                                    </Popover.Button>
                                                </div>
                                            </div>

                                            <div className="mt-3 space-y-1 px-2">
                                                {navigation.map((item) => (
                                                    <a
                                                        key={item.name}
                                                        href={item.href}
                                                        className={classNames(
                                                            item.current ? 'text-white' : 'text-cyan-500',
                                                            "block rounded-md px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 hover:text-gray-800"
                                                        )}
                                                        aria-current={item.current ? 'page' : undefined}
                                                    >
                                                        {item.name}
                                                    </a>
                                                ))}
                                            </div>

                                        </div>
                                        <div className="pb-2 pt-4">
                                            <div className="flex items-center px-5">
                                                <div className="flex-shrink-0">
                                                    <img className="h-10 w-10 rounded-full"
                                                         src="/img/bbd-logo-main.svg"
                                                         alt=""/>
                                                </div>
                                                <div className="ml-3 min-w-0 flex-1">
                                                    <div
                                                        className="truncate text-base font-medium text-gray-800">{user.name}</div>
                                                    <div
                                                        className="truncate text-sm font-medium text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 space-y-1 px-2">
                                                {userNavigation.map((item) => (
                                                    <a
                                                        key={item.name}
                                                        href={item.href}
                                                        className="block rounded-md px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 hover:text-gray-800"
                                                    >
                                                        {item.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Popover.Panel>
                            </Transition.Child>
                        </div>
                    </Transition.Root>
                </>
            )}
        </Popover>
    )
}