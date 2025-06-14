"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import Chat from "../components/Chat";

export default function Home() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() => signIn("google")}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex justify-end">
        <button
          onClick={() => signOut()}
          className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg mb-4"
        >
          Sign Out
        </button>
      </div>
      <h1 className="text-2xl font-bold text-center mb-6">AI Finance Assistant</h1>
      <Chat />
    </div>
  );
}
