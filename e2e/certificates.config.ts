import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
const fixture='http://127.0.0.1:54330'
const root=resolve(__dirname,'..')
export default defineConfig({
 testDir:'.',testMatch:'certificates.spec.ts',timeout:90000,workers:1,retries:0,reporter:'list',outputDir:'/tmp/sitov-certificates-browser-results',
 use:{baseURL:'http://127.0.0.1:3101',actionTimeout:15000,screenshot:'only-on-failure',trace:'off',contextOptions:{reducedMotion:'reduce'},channel:process.env.E2E_BROWSER_CHANNEL??'chrome'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
 webServer:[
  {command:'node e2e/helpers/certificates-fixture.mjs',cwd:root,url:`${fixture}/__certificates/health`,reuseExistingServer:false,timeout:30000},
  {command:'npx next dev -p 3101 -H 127.0.0.1',cwd:root,url:'http://127.0.0.1:3101/de',reuseExistingServer:false,timeout:180000,env:{NEXT_PUBLIC_SUPABASE_URL:fixture,NEXT_PUBLIC_SUPABASE_ANON_KEY:'certificate-local-placeholder',SUPABASE_INTERNAL_URL:fixture,SUPABASE_SERVICE_ROLE_KEY:'certificate-local-placeholder',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3101',SITE_URL:'http://127.0.0.1:3101',NEXT_TELEMETRY_DISABLED:'1'}},
 ],
})
