"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Book } from "@/lib/types";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadBooks();
    } else {
      setBooks([]);
    }
  }, [user]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginLoading(true);
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError(error.message);
    }

    setLoginLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function loadBooks() {
    setBooksLoading(true);
    setBooksError("");

    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      setBooksError(error.message);
      setBooks([]);
    } else {
      setBooks((data ?? []) as Book[]);
    }

    setBooksLoading(false);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f3] text-[#181818]">
        <p className="text-sm text-neutral-500">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-6 py-12 text-[#181818]">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
          <div className="w-full">
            <div className="mb-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                LingoLearn
              </p>

              <h1 className="text-4xl font-semibold tracking-tight">
                Admin
              </h1>

              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Sign in to manage stories and learning content.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
                  placeholder="you@example.com"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <p className="mt-5 text-sm text-red-600">{loginError}</p>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="mt-7 w-full rounded-xl bg-[#181818] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loginLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-[#181818]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              LingoLearn
            </p>
            <p className="mt-1 font-semibold">Admin</p>
          </div>

          <button
            onClick={handleSignOut}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Stories
            </h1>

            <p className="mt-3 text-sm text-neutral-500">
              Manage the stories available in LingoLearn.
            </p>
          </div>

          <Link
  href="/stories/new"
  className="rounded-xl bg-[#181818] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
>
  + New Story
</Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          {booksLoading ? (
            <div className="p-8 text-sm text-neutral-500">
              Loading stories...
            </div>
          ) : booksError ? (
            <div className="p-8">
              <p className="font-medium text-red-600">
                Could not load stories.
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {booksError}
              </p>
            </div>
          ) : books.length === 0 ? (
            <div className="p-8 text-sm text-neutral-500">
              No stories found.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center gap-5 px-6 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">
                      {book.title}
                    </h2>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                      <span>{book.level}</span>

                      {book.estimated_minutes && (
                        <>
                          <span>·</span>
                          <span>{book.estimated_minutes} min</span>
                        </>
                      )}

                      {book.subtitle && (
                        <>
                          <span>·</span>
                          <span className="truncate">
                            {book.subtitle}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      book.status === "published"
                        ? "bg-green-50 text-green-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {book.status === "published"
                      ? "Published"
                      : "Draft"}
                  </span>

                  <Link
  href={`/stories/${book.id}`}
  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
>
  Edit
</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {!booksLoading && !booksError && books.length > 0 && (
          <p className="mt-4 text-sm text-neutral-400">
            {books.length} {books.length === 1 ? "story" : "stories"}
          </p>
        )}
      </div>
    </main>
  );
}