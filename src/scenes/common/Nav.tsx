import {Bars3Icon, XMarkIcon} from "@heroicons/react/24/outline";
import {Popover, Transition} from "@headlessui/react";
import {Fragment, useState} from "react";
import {useTheme} from '../../context/Theme';
import {useApi} from '../../context/Api';
import {useDeviceAuth} from '../../context/DeviceAuth';

const adminNav = [
    {name: 'Dashboard', href: '/'},
    {name: 'History', href: '/history'},
    {name: 'Profiles', href: '/profiles'},
    {name: 'Analysis', href: '/analysis'},
    {name: 'System', href: '/system'},
    {name: 'Optimizer', href: '/optimizer'},
    {name: 'Health', href: '/health'},
];

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

export default function Nav() {
    const {isDarkMode, toggleDarkMode} = useTheme();
    const {apiAvailable, checking} = useApi();
    const {isAdmin} = useDeviceAuth();
    const [currentPath] = useState(location.pathname);
    const navItems = apiAvailable && isAdmin ? adminNav : [];

    return (
        <Popover as="header"
                 className={`${isDarkMode ? 'bg-slate-800' : 'bg-gray-500'} transition-colors duration-500 pb-24`}>
            {({open}) => (
                <>
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
                        <div className="relative flex items-center justify-center pt-6 pb-5 lg:justify-between">
                            <div className="absolute left-0 flex-shrink-0 lg:static">
                                <a href="/">
                                    <span className="sr-only">Black Box Delta</span>
                                    <img
                                        className="h-10 sm:h-12 w-auto"
                                        src="/img/bbd-logo-nav.svg"
                                        alt="Black Box Delta"
                                    />
                                </a>
                            </div>

                            <div className="absolute right-0 lg:relative lg:ml-4 flex items-center gap-2">
                                <span
                                    title={checking ? 'Checking API...' : apiAvailable ? 'API connected' : 'API unavailable'}
                                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                                        checking ? 'bg-yellow-400 animate-pulse' : apiAvailable ? 'bg-emerald-400' : 'bg-gray-500'
                                    }`}
                                />
                                <button
                                    onClick={toggleDarkMode}
                                    className="rounded-full p-2 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                                >
                                    {isDarkMode ? (
                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {navItems.length > 0 && (
                            <div className="absolute right-0 flex-shrink-0 lg:hidden">
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
                            )}
                        </div>
                        {navItems.length > 0 && <div className="hidden border-t border-gray-300 py-5 lg:block">
                            <nav className="flex space-x-4">
                                {navItems.map((item) => (
                                    <a
                                        key={item.name}
                                        href={item.href}
                                        className={classNames(
                                            currentPath === item.href ? 'text-white' : 'text-cyan-500',
                                            'bg-white bg-opacity-0 px-3 py-2 text-sm font-medium hover:bg-opacity-10 rounded-lg'
                                        )}
                                    >
                                        {item.name}
                                    </a>
                                ))}
                            </nav>
                        </div>}
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
                                                    <img className="h-8 w-auto" src="/img/bbd-logo-main.svg"
                                                         alt="Black Box Delta"/>
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
                                                {navItems.map((item) => (
                                                    <a
                                                        key={item.name}
                                                        href={item.href}
                                                        className={classNames(
                                                            currentPath === item.href ? 'text-white' : 'text-cyan-500',
                                                            'block rounded-md px-3 py-2 text-base font-medium hover:bg-gray-100 hover:text-gray-800'
                                                        )}
                                                    >
                                                        {item.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="pb-2 pt-4 px-5">
                                            <button
                                                onClick={toggleDarkMode}
                                                className="rounded-full p-2 text-gray-300 hover:text-white"
                                            >
                                                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                            </button>
                                        </div>
                                    </div>
                                </Popover.Panel>
                            </Transition.Child>
                        </div>
                    </Transition.Root>
                </>
            )}
        </Popover>
    );
}
