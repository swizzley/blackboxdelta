import {Bars3Icon, XMarkIcon} from "@heroicons/react/24/outline";
import {Popover, Transition} from "@headlessui/react";
import {Fragment, useEffect, useState} from "react";
import {MagnifyingGlassIcon} from "@heroicons/react/20/solid";
import {useTheme} from '../../context/Theme';
import {Switch} from "@mui/material";
import {styled} from '@mui/material/styles';
import {Site as SiteMap} from "../../context/Types";

const user = {
    name: 'Swizzley',
    email: 'contact@blackboxdelta.com',
    imageUrl: '/img/bbd-logo-main.svg',
}

interface NavigationItem {
    name: string;
    href: string;
    current: boolean;
}


function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ')
}

interface NavProps {
    Site: SiteMap[];
}

export default function Nav(props: NavProps) {
    const {Site} = props;
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filteredResults, setFilteredResults] = useState<SiteMap[]>([]);

    const [navigation, setNavigation] = useState<NavigationItem[]>([
        {name: 'All', href: '/', current: location.pathname === '/'},
        {name: 'Long', href: '/Long', current: location.pathname === '/Long'},
        {name: 'Short', href: '/Short', current: location.pathname === '/Short'},
    ]);

    // Update filteredResults whenever searchQuery or Site changes
    useEffect(() => {
        const lowercaseQuery = searchQuery.toLowerCase();
        const filtered = Site.filter((item) => {
            // Check if any field in the item matches the search query (case-insensitive)
            return (
                Object.values(item).some((value) =>
                    typeof value === 'string' &&
                    value.toLowerCase().includes(lowercaseQuery)
                ) ||
                item.tags.some((tag) =>
                    tag.toLowerCase().includes(lowercaseQuery)
                )
            );
        });
        setFilteredResults(filtered);
    }, [searchQuery, Site]);

    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const {isDarkMode, toggleDarkMode} = useTheme();

    const MaterialUISwitch = styled(Switch)(({}) => ({
        width: 62,
        height: 34,
        padding: 7,
        '& .MuiSwitch-switchBase': {
            margin: 1,
            padding: 0,
            transform: 'translateX(6px)',
            '&.Mui-checked': {
                color: '#fff',
                transform: 'translateX(22px)',
                '& .MuiSwitch-thumb:before': {
                    backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                        '#fff',
                    )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`,
                },
                '& + .MuiSwitch-track': {
                    opacity: 1,
                    backgroundColor: isDarkMode ? '#8796A5' : '#aab4be',
                },
            },
        },
        '& .MuiSwitch-thumb': {
            backgroundColor: isDarkMode ? '#003892' : '#001e3c',
            width: 32,
            height: 32,
            '&:before': {
                content: "''",
                position: 'absolute',
                width: '100%',
                height: '100%',
                left: 0,
                top: 0,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                    '#fff',
                )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
            },
        },
        '& .MuiSwitch-track': {
            opacity: 1,
            backgroundColor: isDarkMode ? '#8796A5' : '#aab4be',
            borderRadius: 20 / 2,
        },
    }));

    return (
        <Popover as="header"
                 className={`${isDarkMode ? 'bg-slate-900' : 'bg-gray-500'} transition-colors duration-500 pb-24`}>
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
                                        src={innerWidth < 1024 ? `/img/bbd-logo.svg` : `/img/bbd-logo-nav.svg`}
                                        alt="Black Box Delta"
                                    />
                                </a>
                            </div>

                            {/* Right section on desktop */}
                            <div className="hidden lg:ml-4 lg:flex lg:items-center lg:pr-0.5">
                                <div
                                    className={`${isDarkMode ? 'text-white' : 'text-black'} transition-colors duration-500 bg-transparent`}>

                                    <MaterialUISwitch onChange={toggleDarkMode}
                                                      checked={isDarkMode}

                                    />

                                </div>
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
                                {/*            className={`${isDarkMode ? 'bg-dark' : 'bg-light'} transition-colors duration-500 absolute -right-2 z-10 mt-2 w-48 origin-top-right rounded-md py-2 ring-1 ring-black ring-opacity-5 focus:outline-none`}>*/}
                                {/*        </Menu.Items>*/}
                                {/*    </Transition>*/}
                                {/*</Menu>*/}
                            </div>

                            {/* Search */}
                            <div className="min-w-0 flex-1 px-12 lg:hidden rounded-lg">
                                <div className="mx-auto w-full max-w-xs rounded-lg">
                                    <label htmlFor="mobile-search" className="sr-only">
                                        Search
                                    </label>
                                    <div className="rounded-lg relative text-white focus-within:text-gray-600">
                                        <div
                                            className="rounded-lg pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true"/>
                                        </div>
                                        <div>
                                            <input
                                                id="mobile-search"
                                                className="rounded-lg block w-full border-0 bg-white/20 py-1.5 pl-10 pr-3 text-white placeholder:text-white focus:bg-white focus:text-gray-900 focus:ring-0 focus:placeholder:text-gray-500 sm:text-sm sm:leading-6"
                                                placeholder="Search"
                                                type="search"
                                                name="search"
                                                value={searchQuery}
                                                onChange={handleSearchInputChange}
                                            />
                                            <div>
                                                {searchQuery &&
                                                    <ul role="list"
                                                        className={`${isDarkMode ? 'bg-dark' : 'bg-light'} z-10 w-full absolute transition-colors duration-500 pb-24 divide-y divide-gray-100 rounded-lg`}>
                                                        {searchQuery && filteredResults.map((result) => (
                                                            <li key={result.id} className="flex gap-x-4 p-5">
                                                                <a className="min-w-0" href={result.url}>
                                                                    <div
                                                                        className={`max-w-xs truncate text-sm font-semibold leading-6 ${isDarkMode ? 'bg-dark' : 'bg-light'}`}>({result.symbol}) {result.title}</div>
                                                                    <div
                                                                        className={`mt-1 text-xs leading-5 ${isDarkMode ? 'bg-dark' : 'bg-light'}`}>{result.date}</div>
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Menu button */}
                            <div className="absolute right-0 flex-shrink-0 lg:hidden">
                                {/* Mobile menu button */}
                                <Popover.Button
                                    className="relative inline-flex items-center justify-center bg-transparent p-2 text-white hover:bg-white hover:bg-opacity-10 hover:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-white">
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
                                                    'bg-white bg-opacity-0 px-3 py-2 text-sm font-medium hover:bg-opacity-10 rounded-lg'
                                                )}
                                                aria-current={item.current ? 'page' : false }
                                                onClick={() => {
                                                    // Create a new array with updated current property
                                                    const updatedNavigation = navigation.map((navItem) => ({
                                                        ...navItem,
                                                        current: navItem.name === item.name ? !navItem.current : false,
                                                    }));

                                                    // Update the state with the new array
                                                    setNavigation(updatedNavigation);
                                                }}
                                            >
                                                {item.name}
                                            </a>
                                        ))}

                                    </nav>
                                </div>
                                <div>
                                    <div className="mx-auto w-full max-w-md rounded-lg">
                                        <label htmlFor="desktop-search" className="sr-only">
                                            Search
                                        </label>
                                        <div className="relative text-white focus-within:text-gray-600 rounded-lg">
                                            {!searchQuery &&
                                                <div
                                                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 rounded-lg">
                                                    <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true"/>
                                                </div>
                                            }
                                            <input
                                                id="desktop-search"
                                                className="rounded-lg block w-full border-0 bg-white/20 py-1.5 pl-10 pr-3 text-white placeholder:text-white focus:bg-white focus:text-gray-900 focus:ring-0 focus:placeholder:text-gray-500 sm:text-sm sm:leading-6"
                                                placeholder="Search"
                                                type="search"
                                                name="search"
                                                value={searchQuery}
                                                onChange={handleSearchInputChange}
                                            />
                                            <div>
                                                {searchQuery &&
                                                    <ul role="list"
                                                        className={`${isDarkMode ? 'bg-dark' : 'bg-light'} z-10 absolute transition-colors duration-500  divide-y divide-gray-100 rounded-lg`}>
                                                        {searchQuery && filteredResults.map((result) => (
                                                            <li key={result.id} className="flex gap-x-4 p-5">
                                                                <img
                                                                    className={`h-12 w-12 flex-none rounded-full ${isDarkMode ? 'bg-dark' : 'bg-light'}`}
                                                                    src='/img/bbd-logo.svg' alt=""/>
                                                                <a className="min-w-0" href={result.url}>
                                                                    <div
                                                                        className={`max-w-xs truncate text-sm font-semibold leading-6 ${isDarkMode ? 'bg-dark' : 'bg-light'}`}>{result.title}</div>
                                                                    <div
                                                                        className={`mt-1 text-xs leading-5 ${isDarkMode ? 'bg-dark' : 'bg-light'}`}>{result.date}</div>
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                }
                                            </div>
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
                                            <div
                                                className={`${isDarkMode ? 'text-white' : 'text-black'} transition-colors duration-500 bg-transparent`}>

                                                <MaterialUISwitch onChange={toggleDarkMode}
                                                                  checked={isDarkMode}/>

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