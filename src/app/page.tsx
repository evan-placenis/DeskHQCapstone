"use client"; // This is required because your Dashboard uses React State

// Import your main component from your old App.tsx
// You might need to check if App.tsx has a "default export"
import App from "@/frontend/App"; 

export default function Home() {
  return (
    <main className="min-h-screen">
      <App />
    </main>
  );
}