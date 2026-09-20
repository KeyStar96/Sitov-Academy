import '@testing-library/jest-dom';
import React from 'react';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Next.js Navigation Mock
jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: jest.fn(),
    }),
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
    usePathname: () => '',
}));

// Mock Fonts
jest.mock('next/font/google', () => ({
    __esModule: true,
    JetBrains_Mono: () => ({
        className: 'mocked-font-class',
        style: { fontFamily: 'mocked-font' },
    }),
}));

// Next.js Image Mock
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        // eslint-disable-next-line @next/next/no-img-element
        return React.createElement('img', { ...props, alt: props.alt });
    },
}));

// Next.js Link Mock
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
        React.createElement('a', { href }, children)
    ),
}));

// Framer Motion Mock (Simplified)
// This avoids complex animation timers in tests
jest.mock('framer-motion', () => ({
    __esModule: true,
    motion: {
        div: ({ children, ...props }: any) => React.createElement('div', props, children),
        h2: ({ children, ...props }: any) => React.createElement('h2', props, children),
        p: ({ children, ...props }: any) => React.createElement('p', props, children),
        section: ({ children, ...props }: any) => React.createElement('section', props, children),
        span: ({ children, ...props }: any) => React.createElement('span', props, children), // Added span
        // Add other HTML elements as needed
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, {}, children),
}));

// ResizeObserver Mock (often missing in JSDOM)
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// IntersectionObserver Mock
global.IntersectionObserver = class IntersectionObserver {
    constructor(callback: any, options: any) { }
    observe() { }
    unobserve() { }
    disconnect() { }
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
};

// Mock Lenis
jest.mock('lenis', () => ({
    __esModule: true,
    default: class MockLenis {
        on() { }
        destroy() { }
        raf() { }
    }
}));

// Mock GSAP
const gsapMock = {
    registerPlugin: jest.fn(),
    to: jest.fn(),
    from: jest.fn(),
};

jest.mock('gsap', () => ({
    __esModule: true,
    default: gsapMock,
    ...gsapMock
}));

jest.mock('gsap/ScrollTrigger', () => ({
    __esModule: true,
    ScrollTrigger: {
        create: jest.fn(),
        refresh: jest.fn(),
    },
}));

// Mock MutationObserver (if missing)
global.MutationObserver = class {
    constructor(callback: any) { }
    disconnect() { }
    observe(element: any, initObject: any) { }
    takeRecords() { return []; }
};

// Mock Lucide Icons
jest.mock('lucide-react', () => ({
    __esModule: true,
    // Proxy to return a dummy component for any icon import
    default: new Proxy({}, {
        get: (target, prop) => {
            // eslint-disable-next-line react/display-name
            return (props: any) => React.createElement('svg', { ...props, 'data-testid': `icon-${String(prop)}` });
        }
    }),
    // Explicit named exports used in component if simpler
    ChevronLeft: (props: any) => React.createElement('svg', props),
    Check: (props: any) => React.createElement('svg', props),
    X: (props: any) => React.createElement('svg', props),
    ArrowRight: (props: any) => React.createElement('svg', props),
    Loader2: (props: any) => React.createElement('svg', props),
    Info: (props: any) => React.createElement('svg', props),
    MapPin: (props: any) => React.createElement('svg', props),
    Monitor: (props: any) => React.createElement('svg', props),
    User: (props: any) => React.createElement('svg', props),
    ChevronDown: (props: any) => React.createElement('svg', props),
}));

// Browser-specific mocks (only for jsdom environment)
if (typeof window !== 'undefined') {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // deprecated
            removeListener: jest.fn(), // deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });

    // ScrollTo Mock
    window.scrollTo = jest.fn();
    HTMLElement.prototype.scrollTo = jest.fn();
}
