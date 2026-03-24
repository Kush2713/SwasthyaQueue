"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("../src/frontend/AppRouter"), { ssr: false });

export default function Page() {
  return <App />;
}
