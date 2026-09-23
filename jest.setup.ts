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
        refresh: jest.fn(),
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
// Props werden durchgereicht (className, aria-*, data-*): Ein Mock, der sie
// verschluckt, laesst jede Zusicherung ueber das Aussehen oder den Zustand
// eines Links stillschweigend ins Leere laufen. Nur die Next-eigenen
// Steuer-Props werden entfernt, sonst warnt React ueber unbekannte Attribute.
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, prefetch, replace, scroll, shallow, locale, passHref, legacyBehavior, ...rest }: any) => (
        React.createElement('a', { href, ...rest }, children)
    ),
}));

// Framer Motion Mock (comprehensive, animation-free)
// Renders any motion.<tag> and motion.create(Component) as the plain element, strips
// animation-only props, and stubs the motion-value hooks so components that use
// useScroll / useMotionValue / useMotionTemplate / useMotionValueEvent render in JSDOM.
jest.mock('framer-motion', () => {
    const ANIM_PROPS = new Set([
        'initial', 'animate', 'exit', 'whileHover', 'whileTap', 'whileInView', 'whileFocus',
        'whileDrag', 'transition', 'variants', 'viewport', 'drag', 'layout', 'layoutId',
        'dragControls', 'dragListener', 'dragConstraints', 'dragElastic', 'onDragEnd',
    ]);
    const strip = (props: any) => {
        const out: any = {};
        for (const key in props) if (!ANIM_PROPS.has(key)) out[key] = props[key];
        return out;
    };
    // One stable component per tag: a fresh function per access would remount
    // the subtree on every render and wipe the state of everything inside.
    const components = new Map<any, any>();
    const make = (tag: any) => {
        if (!components.has(tag)) components.set(tag, ({ children, ...props }: any) => React.createElement(tag, strip(props), children));
        return components.get(tag);
    };
    const motion: any = new Proxy(
        { create: (Component: any) => make(Component) },
        { get: (target, key: string) => (key in target ? (target as any)[key] : make(key)) },
    );
    const value = (init: any) => ({ get: () => init, set: () => {}, on: () => () => {}, destroy: () => {} });
    return {
        __esModule: true,
        motion,
        AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, {}, children),
        MotionConfig: ({ children }: any) => React.createElement(React.Fragment, {}, children),
        useReducedMotion: () => true,
        useScroll: () => ({ scrollY: value(0), scrollX: value(0), scrollYProgress: value(0), scrollXProgress: value(0) }),
        useMotionValueEvent: () => {},
        useMotionValue: (init: any) => value(init),
        useMotionTemplate: () => '',
        useTransform: () => value(0),
        useDragControls: () => ({ start: () => {} }),
    };
});

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
