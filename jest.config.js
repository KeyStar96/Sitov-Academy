module.exports = {
    preset: 'ts-jest',
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    testEnvironment: 'jsdom', // Changed from node to jsdom for React tests
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Add setup file
    moduleNameMapper: {
        // Handle CSS imports (common in Next.js)
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/$1'
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
            // Enable jsx support in ts-jest
            jsx: 'react-jsx'
        }],
        // Process js/mjs files with ts-jest as well (needed for ESM modules in node_modules)
        '^.+\\.(js|jsx|mjs)$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
            useESM: true,
            isolatedModules: true
        }],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(uncrypto|@upstash)/)'
    ],
    testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/node_modules/'],
};
