import type { NextConfig } from "next";

// Every page here depends on who is looking (signed in? subscribed? free videos left?),
// so pages are rendered fresh on each request. The newer "cache components" mode is
// left off on purpose: a cached or pre-fetched watch page could leak a paid video
// or use up a free view by accident.
const nextConfig: NextConfig = {};

export default nextConfig;
