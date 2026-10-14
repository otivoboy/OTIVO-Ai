import { ProjectFile } from '../types';

export const REACT_VITE_TEMPLATE: ProjectFile[] = [
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
    content: `{
  "name": "otivo-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.344.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.2.2"
  }
}`
  },
  {
    name: 'index.html',
    path: 'index.html',
    type: 'file',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTIVO App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
  },
  {
    name: 'vite.config.js',
    path: 'vite.config.js',
    type: 'file',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`
  },
  {
    name: 'postcss.config.js',
    path: 'postcss.config.js',
    type: 'file',
    content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
  },
  {
    name: 'tailwind.config.js',
    path: 'tailwind.config.js',
    type: 'file',
    content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
  },
  {
    name: 'main.jsx',
    path: 'src/main.jsx',
    type: 'file',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
  },
  {
    name: 'index.css',
    path: 'src/index.css',
    type: 'file',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
}
`
  },
  {
    name: 'App.jsx',
    path: 'src/App.jsx',
    type: 'file',
    content: `import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold tracking-tighter mb-4">OTIVO React App</h1>
      <p className="text-zinc-400">Start building your amazing project with OTIVO AI.</p>
    </div>
  )
}

export default App`
  }
];

export const NODE_TEMPLATE: ProjectFile[] = [
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
    content: `{
  "name": "otivo-node-app",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.3"
  }
}`
  },
  {
    name: 'index.js',
    path: 'index.js',
    type: 'file',
    content: `import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from OTIVO Node Server!');
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});`
  }
];

export const HTML_TEMPLATE: ProjectFile[] = [
  {
    name: 'index.html',
    path: 'index.html',
    type: 'file',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTIVO Static Site</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center p-4">
    <h1 class="text-4xl font-bold tracking-tighter mb-4">OTIVO Static Site</h1>
    <p class="text-zinc-400">A simple static site built with OTIVO AI.</p>
</body>
</html>`
  }
];

export const NEXTJS_TEMPLATE: ProjectFile[] = [
  {
    name: 'package.json',
    path: 'package.json',
    type: 'file',
    content: `{
  "name": "otivo-next-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "next": "14.1.0",
    "lucide-react": "^0.344.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "eslint": "^8",
    "eslint-config-next": "14.1.0"
  }
}`
  },
  {
    name: 'next.config.mjs',
    path: 'next.config.mjs',
    type: 'file',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;`
  },
  {
    name: 'layout.tsx',
    path: 'app/layout.tsx',
    type: 'file',
    content: `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OTIVO Next App",
  description: "Generated by OTIVO AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`
  },
  {
    name: 'page.tsx',
    path: 'app/page.tsx',
    type: 'file',
    content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white">
      <h1 className="text-6xl font-bold tracking-tighter">OTIVO Next.js</h1>
      <p className="mt-4 text-zinc-400">The power of Next.js meets OTIVO AI.</p>
    </main>
  );
}`
  },
  {
    name: 'globals.css',
    path: 'app/globals.css',
    type: 'file',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
  }
];
