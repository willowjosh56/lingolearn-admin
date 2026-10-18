
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Book } from "@/lib/types";

type SortOption =
  | "library"
  | "title"
  | "level"
  | "newest";

const PAGE_SIZE = 20;

const fieldClass =
  "w-full rounded-xl border border-[#e1e5ec] bg-white px-4 py-3 text-sm text-[#26365e] outline-none transition focus:border-[#7995c1] focus:ring-2 focus:ring-[#dce9ff]";

function languageName(code: string | null | undefined) {
  const names: Record<string, string> = {
    en: "English",
    ru: "Russian",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ar: "Arabic",
    hi: "Hindi",
  };

  if (!code) return "Unknown";
  return names[code.toLowerCase()] ?? code.toUpperCase();
}

function compareLevels(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function SummaryCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7e9f0] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-[#8390a6]">
        {label}
      </p>
      <p className={`mt-3 text-3xl font-black ${colour}`}>
        {value}
      </p>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState("");

  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] =
    useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortOption, setSortOption] =
    useState<SortOption>("library");

  const [page, setPage] = useState(1);

  // Authentication: same Supabase login as before.
  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      setUser(data.session?.user ?? null);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;

        setUser(session?.user ?? null);
        setCheckingSession(false);
      }
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Load every book, including libraries that grow
  // beyond Supabase's default 1,000-row response limit.
  useEffect(() => {
    let active = true;

    async function loadBooks() {
      if (!user) {
        setBooks([]);
        setBooksError("");
        setBooksLoading(false);
        return;
      }

      setBooksLoading(true);
      setBooksError("");

      try {
        const results: Book[] = [];
        const batchSize = 500;

        for (let offset = 0; ; offset += batchSize) {
          const { data, error } = await supabase
            .from("books")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;
          if (!active) return;

          const batch = (data ?? []) as Book[];
          results.push(...batch);

          if (batch.length < batchSize) break;
        }

        if (active) setBooks(results);
      } catch (cause) {
        if (!active) return;

        setBooksError(
          cause instanceof Error
            ? cause.message
            : "Unable to load stories."
        );
      } finally {
        if (active) setBooksLoading(false);
      }
    }

    void loadBooks();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const languageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => book.learning_language)
            .filter(Boolean)
        )
      ).sort((a, b) =>
        languageName(a).localeCompare(languageName(b))
      ),
    [books]
  );

  const levelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => book.level?.trim())
            .filter((level): level is string =>
              Boolean(level)
            )
        )
      ).sort(compareLevels),
    [books]
  );

  const counts = useMemo(
    () => ({
      total: books.length,
      published: books.filter(
        (book) => book.status === "published"
      ).length,
      drafts: books.filter(
        (book) => book.status !== "published"
      ).length,
      free: books.filter(
        (book) => book.access_tier === "free"
      ).length,
      plus: books.filter(
        (book) => book.access_tier === "plus"
      ).length,
    }),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const result = books.filter((book) => {
      if (query) {
        const searchable = [
          book.title,
          book.subtitle ?? "",
          book.slug,
          book.level,
          languageName(book.learning_language),
        ]
          .join(" ")
          .toLocaleLowerCase();

        if (!searchable.includes(query)) return false;
      }

      if (
        languageFilter !== "all" &&
        book.learning_language !== languageFilter
      ) {
        return false;
      }

      if (
        levelFilter !== "all" &&
        book.level !== levelFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        book.status !== statusFilter
      ) {
        return false;
      }

      if (
        tierFilter !== "all" &&
        book.access_tier !== tierFilter
      ) {
        return false;
      }

      return true;
    });

    if (sortOption === "title") {
      result.sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    } else if (sortOption === "level") {
      result.sort(
        (a, b) =>
          compareLevels(a.level, b.level) ||
          a.title.localeCompare(b.title)
      );
    } else if (sortOption === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime() ||
          a.title.localeCompare(b.title)
      );
    }

    // "library" retains the original Supabase sort order.
    return result;
  }, [
    books,
    search,
    languageFilter,
    levelFilter,
    statusFilter,
    tierFilter,
    sortOption,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBooks.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const visibleBooks = filteredBooks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const hasFilters =
    search !== "" ||
    languageFilter !== "all" ||
    levelFilter !== "all" ||
    statusFilter !== "all" ||
    tierFilter !== "all" ||
    sortOption !== "library";

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setLanguageFilter("all");
    setLevelFilter("all");
    setStatusFilter("all");
    setTierFilter("all");
    setSortOption("library");
    setPage(1);
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) setLoginError(error.message);
    setLoginLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-sm text-[#71809a]">
        Loading admin...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-16 text-[#26365e]">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#26365e] text-2xl font-black text-white">
              D
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#91a0b7]">
              Dual Language Library
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Admin Sign In
            </h1>

            <p className="mt-3 text-sm text-[#7a879f]">
              Manage your DULALI story collection.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-3xl border border-[#e4e8f0] bg-white p-8 shadow-sm"
          >
            <label
              htmlFor="admin-email"
              className="mb-2 block text-sm font-semibold"
            >
              Email
            </label>

            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className={fieldClass}
            />

            <label
              htmlFor="admin-password"
              className="mb-2 mt-5 block text-sm font-semibold"
            >
              Password
            </label>

            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className={fieldClass}
            />

            {loginError && (
              <p
                role="alert"
                className="mt-5 text-sm text-red-600"
              >
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="mt-7 w-full rounded-xl bg-[#26365e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#364b81] disabled:opacity-50"
            >
              {loginLoading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#26365e]">
      {/* ADMIN HEADER */}
      <header className="border-b border-[#e5e8f0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#26365e] font-black text-white">
              D
            </span>
            <div>
              <span className="block font-serif text-lg font-bold">
                DULALI
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#91a0b7]">
                Story Administration
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-[#e2e6ed] px-4 py-2 text-sm font-semibold text-[#52617d] hover:bg-[#f5f7fb]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        {/* PAGE TITLE */}
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#91a0b7]">
              Library Management
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              Story Manager
            </h1>
            <p className="mt-3 text-sm text-[#74829b]">
              Find, organise and edit stories in your
              growing DULALI library.
            </p>
          </div>

          <Link
            href="/stories/new"
            className="rounded-full bg-[#ff766b] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#ed655a]"
          >
            + New Story
          </Link>
        </div>

        {/* SUMMARY */}
        <div className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SummaryCard
            label="Total Books"
            value={counts.total}
            colour="text-[#26365e]"
          />
          <SummaryCard
            label="Published"
            value={counts.published}
            colour="text-[#25805a]"
          />
          <SummaryCard
            label="Drafts"
            value={counts.drafts}
            colour="text-[#a97530]"
          />
          <SummaryCard
            label="FREE"
            value={counts.free}
            colour="text-[#5076ba]"
          />
          <SummaryCard
            label="PLUS+"
            value={counts.plus}
            colour="text-[#e46f62]"
          />
        </div>

        {/* FILTER PANEL */}
        <section className="mt-8 rounded-3xl border border-[#e4e8f0] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">
                Find a Story
              </h2>
              <p className="mt-1 text-xs text-[#91a0b7]">
                Combine filters to narrow down your books.
              </p>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-bold text-[#d8665b] hover:underline"
              >
                Clear all filters ×
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="story-search"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Search by title, subtitle or slug
              </label>

              <input
                id="story-search"
                type="search"
                placeholder="Search your library..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="language-filter"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Language
              </label>

              <select
                id="language-filter"
                value={languageFilter}
                onChange={(event) => {
                  setLanguageFilter(event.target.value);
                  resetPage();
                }}
                className={fieldClass}
              >
                <option value="all">All languages</option>
                {languageOptions.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="level-filter"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Reading Level
              </label>

              <select
                id="level-filter"
                value={levelFilter}
                onChange={(event) => {
                  setLevelFilter(event.target.value);
                  resetPage();
                }}
                className={fieldClass}
              >
                <option value="all">All levels</option>
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Publication Status
              </label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  resetPage();
                }}
                className={fieldClass}
              >
                <option value="all">All statuses</option>
                <option value="published">
                  Published
                </option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="tier-filter"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Collection
              </label>

              <select
                id="tier-filter"
                value={tierFilter}
                onChange={(event) => {
                  setTierFilter(event.target.value);
                  resetPage();
                }}
                className={fieldClass}
              >
                <option value="all">All collections</option>
                <option value="free">FREE</option>
                <option value="plus">PLUS+</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sort-option"
                className="mb-2 block text-xs font-bold text-[#71809a]"
              >
                Sort Books
              </label>

              <select
                id="sort-option"
                value={sortOption}
                onChange={(event) => {
                  setSortOption(
                    event.target.value as SortOption
                  );
                  resetPage();
                }}
                className={fieldClass}
              >
                <option value="library">
                  Library order
                </option>
                <option value="title">
                  Title A–Z
                </option>
                <option value="level">
                  Level A1–C2
                </option>
                <option value="newest">
                  Newest first
                </option>
              </select>
            </div>
          </div>
        </section>

        {/* BOOK RESULTS */}
        <section className="mt-7 overflow-hidden rounded-3xl border border-[#e4e8f0] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f5] px-5 py-5 sm:px-7">
            <div>
              <h2 className="text-lg font-black">
                Your Stories
              </h2>
              <p className="mt-1 text-xs text-[#91a0b7]">
                {booksLoading
                  ? "Loading..."
                  : `${filteredBooks.length} of ${books.length} stories`}
              </p>
            </div>

            {!booksLoading &&
              !booksError &&
              filteredBooks.length > 0 && (
                <p className="text-xs font-semibold text-[#91a0b7]">
                  Page {currentPage} of {totalPages}
                </p>
              )}
          </div>

          {booksLoading ? (
            <div className="px-7 py-16 text-center text-sm text-[#8592aa]">
              Loading your library...
            </div>
          ) : booksError ? (
            <div
              role="alert"
              className="px-7 py-12 text-sm text-red-600"
            >
              Could not load stories: {booksError}
            </div>
          ) : visibleBooks.length === 0 ? (
            <div className="px-7 py-16 text-center">
              <p className="text-xl font-bold">
                No stories found
              </p>
              <p className="mt-3 text-sm text-[#8592aa]">
                Try a different level, language or search.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 text-sm font-bold text-[#d8665b] underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#eef0f5]">
              {visibleBooks.map((book) => (
                <article
                  key={book.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-[#fafbff] sm:px-7"
                >
                  {/* MAIN BOOK DETAILS */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="max-w-full break-words font-bold text-[#26365e]">
                        {book.title}
                      </h3>

                      <span className="rounded-md bg-[#eaf2ff] px-2 py-1 text-[10px] font-black text-[#5575aa]">
                        {book.level}
                      </span>

                      <span className="rounded-md bg-[#f2f4f8] px-2 py-1 text-[10px] font-bold uppercase text-[#72829d]">
                        {book.learning_language}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-[#8290a6]">
                      {languageName(book.learning_language)}
                      {" · "}
                      {book.content_type === "classic"
                        ? "Classic"
                        : "Original"}
                      {book.estimated_minutes
                        ? ` · ${book.estimated_minutes} min`
                        : ""}
                    </p>

                    {book.subtitle && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#9aa5b6]">
                        {book.subtitle}
                      </p>
                    )}
                  </div>

                  {/* STATUS AND ACCESS */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        book.status === "published"
                          ? "bg-[#e7f7ed] text-[#28825a]"
                          : "bg-[#fff4dd] text-[#a87529]"
                      }`}
                    >
                      {book.status === "published"
                        ? "Published"
                        : "Draft"}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        book.access_tier === "plus"
                          ? "bg-[#fff0ed] text-[#db675c]"
                          : "bg-[#eaf2ff] text-[#5075ae]"
                      }`}
                    >
                      {book.access_tier === "plus"
                        ? "PLUS+"
                        : "FREE"}
                    </span>
                  </div>

                  {/* EDIT ACTION */}
                  <Link
                    href={`/stories/${book.id}`}
                    className="ml-auto rounded-xl border border-[#dfe5ee] bg-white px-5 py-2.5 text-xs font-bold text-[#38517e] transition hover:border-[#aac0e0] hover:bg-[#f0f5ff]"
                  >
                    Edit →
                  </Link>
                </article>
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {!booksLoading &&
            !booksError &&
            filteredBooks.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#edf0f5] px-5 py-5 sm:px-7">
                <p className="text-xs text-[#8290a6]">
                  Showing{" "}
                  {(currentPage - 1) * PAGE_SIZE + 1}
                  –
                  {Math.min(
                    currentPage * PAGE_SIZE,
                    filteredBooks.length
                  )}{" "}
                  of {filteredBooks.length}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setPage((value) =>
                        Math.max(1, value - 1)
                      )
                    }
                    className="rounded-xl border border-[#e1e5ec] px-4 py-2 text-xs font-bold text-[#52617d] transition hover:bg-[#f5f7fb] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <span className="text-xs font-bold text-[#63718c]">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((value) =>
                        Math.min(totalPages, value + 1)
                      )
                    }
                    className="rounded-xl border border-[#e1e5ec] px-4 py-2 text-xs font-bold text-[#52617d] transition hover:bg-[#f5f7fb] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
