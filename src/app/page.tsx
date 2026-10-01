"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Book } from "@/lib/types";
import Link from "next/link";


type LearningLanguage = "ru" | "es" | "fr" | "de";

type LanguageFilter =
  | "all"
  | LearningLanguage;


function languageName(
  language: string | null | undefined
): string {

  switch (language) {

    case "ru":
      return "Russian";

    case "es":
      return "Spanish";

    case "fr":
      return "French";

      case "de":
  return "German";

    default:
      return "Unknown";
  }
}


function languageShortName(
  language: string | null | undefined
): string {

  switch (language) {

    case "ru":
      return "RU";

    case "es":
      return "ES";

    case "fr":
      return "FR";

      case "de":
  return "DE";

    default:
      return "--";
  }
}


export default function Home() {

  const [user, setUser] =
    useState<User | null>(null);

  const [checkingSession, setCheckingSession] =
    useState(true);


  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState("");


  const [books, setBooks] =
    useState<Book[]>([]);

  const [booksLoading, setBooksLoading] =
    useState(false);

  const [booksError, setBooksError] =
    useState("");


  // MARK: - Language Filter

  const [languageFilter, setLanguageFilter] =
    useState<LanguageFilter>("all");


  // MARK: - Session

  useEffect(() => {

    async function checkSession() {

      const {
        data: {
          session
        }
      } =
        await supabase.auth.getSession();


      setUser(
        session?.user ?? null
      );


      setCheckingSession(false);
    }


    checkSession();


    const {
      data: {
        subscription
      }
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {

          setUser(
            session?.user ?? null
          );
        }
      );


    return () => {

      subscription.unsubscribe();
    };

  }, []);


  // MARK: - Load Books

  useEffect(() => {

    if (user) {

      loadBooks();

    } else {

      setBooks([]);
    }

  }, [user]);


  async function loadBooks() {

    setBooksLoading(true);
    setBooksError("");


    const {
      data,
      error
    } =
      await supabase
        .from("books")
        .select("*")
        .order(
          "sort_order",
          {
            ascending: true
          }
        );


    if (error) {

      setBooksError(
        error.message
      );

      setBooks([]);

    } else {

      setBooks(
        (data ?? []) as Book[]
      );
    }


    setBooksLoading(false);
  }


  // MARK: - Filtered Books

  const filteredBooks =
    useMemo(() => {

      if (
        languageFilter === "all"
      ) {

        return books;
      }


      return books.filter(
        (book) =>
          book.learning_language ===
          languageFilter
      );

    }, [
      books,
      languageFilter
    ]);


  // MARK: - Language Counts

  const languageCounts =
    useMemo(() => {

      return {

        ru:
          books.filter(
            book =>
              book.learning_language ===
              "ru"
          ).length,

        es:
          books.filter(
            book =>
              book.learning_language ===
              "es"
          ).length,

        fr:
  books.filter(
    book =>
      book.learning_language ===
      "fr"
  ).length,

de:
  books.filter(
    book =>
      book.learning_language ===
      "de"
  ).length
};

    }, [books]);


  // MARK: - Login

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setLoginLoading(true);
    setLoginError("");


    const {
      error
    } =
      await supabase.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {

      setLoginError(
        error.message
      );
    }


    setLoginLoading(false);
  }


  // MARK: - Sign Out

  async function handleSignOut() {

    await supabase.auth.signOut();
  }


  // MARK: - Loading

  if (checkingSession) {

    return (

      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-[#f5f5f3]
          text-[#181818]
        "
      >

        <p
          className="
            text-sm
            text-neutral-500
          "
        >
          Loading...
        </p>

      </main>
    );
  }


  // MARK: - Login

  if (!user) {

    return (

      <main
        className="
          min-h-screen
          bg-[#f5f5f3]
          px-6
          py-12
          text-[#181818]
        "
      >

        <div
          className="
            mx-auto
            flex
            min-h-[80vh]
            max-w-md
            items-center
          "
        >

          <div
            className="w-full"
          >

            <div
              className="mb-10"
            >

              <p
                className="
                  mb-3
                  text-xs
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-neutral-500
                "
              >
                Dual Language Library
              </p>


              <h1
                className="
                  text-4xl
                  font-semibold
                  tracking-tight
                "
              >
                Admin
              </h1>


              <p
                className="
                  mt-3
                  text-sm
                  leading-6
                  text-neutral-500
                "
              >
                Sign in to manage
                stories and learning
                content.
              </p>

            </div>


            <form
              onSubmit={handleLogin}
              className="
                rounded-3xl
                border
                border-black/5
                bg-white
                p-7
                shadow-sm
              "
            >

              <div>

                <label
                  htmlFor="email"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                  "
                >
                  Email
                </label>


                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  required
                  autoComplete="email"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-neutral-200
                    bg-white
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-neutral-400
                  "
                  placeholder="you@example.com"
                />

              </div>


              <div
                className="mt-5"
              >

                <label
                  htmlFor="password"
                  className="
                    mb-2
                    block
                    text-sm
                    font-medium
                  "
                >
                  Password
                </label>


                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  required
                  autoComplete="current-password"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-neutral-200
                    bg-white
                    px-4
                    py-3
                    text-sm
                    outline-none
                    transition
                    focus:border-neutral-400
                  "
                  placeholder="••••••••"
                />

              </div>


              {loginError && (

                <p
                  className="
                    mt-5
                    text-sm
                    text-red-600
                  "
                >
                  {loginError}
                </p>

              )}


              <button
                type="submit"
                disabled={loginLoading}
                className="
                  mt-7
                  w-full
                  rounded-xl
                  bg-[#181818]
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-black
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                {
                  loginLoading
                    ? "Signing in..."
                    : "Sign in"
                }

              </button>

            </form>

          </div>

        </div>

      </main>
    );
  }


  // MARK: - Main Admin

  return (

    <main
      className="
        min-h-screen
        bg-[#f5f5f3]
        text-[#181818]
      "
    >

      {/* Header */}

      <header
        className="
          border-b
          border-black/5
          bg-white
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-6xl
            items-center
            justify-between
            px-6
            py-5
          "
        >

          <div>

            <p
              className="
                text-xs
                font-semibold
                uppercase
                tracking-[0.18em]
                text-neutral-400
              "
            >
              Dual Language Library
            </p>


            <p
              className="
                mt-1
                font-semibold
              "
            >
              Admin
            </p>

          </div>


          <button
            onClick={handleSignOut}
            className="
              rounded-xl
              border
              border-neutral-200
              px-4
              py-2
              text-sm
              font-medium
              transition
              hover:bg-neutral-50
            "
          >
            Sign out
          </button>

        </div>

      </header>


      <div
        className="
          mx-auto
          max-w-6xl
          px-6
          py-12
        "
      >

        {/* Page Header */}

        <div
          className="
            flex
            items-end
            justify-between
            gap-6
          "
        >

          <div>

            <h1
              className="
                text-4xl
                font-semibold
                tracking-tight
              "
            >
              Stories
            </h1>


            <p
              className="
                mt-3
                text-sm
                text-neutral-500
              "
            >
              Manage the stories
              available in Dual
              Language Library.
            </p>

          </div>


          <Link
            href="/stories/new"
            className="
              rounded-xl
              bg-[#181818]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-black
            "
          >
            + New Story
          </Link>

        </div>


        {/* Language Filter */}

        <div
          className="
            mt-8
            rounded-2xl
            border
            border-black/5
            bg-white
            p-5
            shadow-sm
          "
        >

          <div
            className="
              flex
              flex-col
              gap-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                "
              >
                Filter by language
              </p>


              <p
                className="
                  mt-1
                  text-xs
                  text-neutral-500
                "
              >
                Organise your growing
                library by learning
                language.
              </p>

            </div>


            <select
              value={languageFilter}
              onChange={(event) =>
                setLanguageFilter(
                  event.target.value as
                    LanguageFilter
                )
              }
              className="
                rounded-xl
                border
                border-neutral-200
                bg-white
                px-4
                py-3
                text-sm
                font-medium
                outline-none
                transition
                focus:border-neutral-400
              "
            >

              <option value="all">
                All Languages ({books.length})
              </option>

              <option value="ru">
                Russian ({languageCounts.ru})
              </option>

              <option value="es">
                Spanish ({languageCounts.es})
              </option>

              <option value="fr">
                French ({languageCounts.fr})
              </option>

              <option value="de">
  German ({languageCounts.de})
</option>

            </select>

          </div>

        </div>


        {/* Stories */}

        <div
          className="
            mt-6
            overflow-hidden
            rounded-2xl
            border
            border-black/5
            bg-white
            shadow-sm
          "
        >

          {booksLoading ? (

            <div
              className="
                p-8
                text-sm
                text-neutral-500
              "
            >
              Loading stories...
            </div>

          ) : booksError ? (

            <div
              className="p-8"
            >

              <p
                className="
                  font-medium
                  text-red-600
                "
              >
                Could not load stories.
              </p>


              <p
                className="
                  mt-2
                  text-sm
                  text-neutral-500
                "
              >
                {booksError}
              </p>

            </div>

          ) : filteredBooks.length === 0 ? (

            <div
              className="
                p-8
                text-sm
                text-neutral-500
              "
            >

              {languageFilter === "all"
                ? "No stories found."
                : `No ${languageName(
                    languageFilter
                  )} stories found.`}

            </div>

          ) : (

            <div
              className="
                divide-y
                divide-neutral-100
              "
            >

              {filteredBooks.map(
                (book) => (

                  <div
                    key={book.id}
                    className="
                      flex
                      flex-col
                      gap-4
                      px-6
                      py-5
                      sm:flex-row
                      sm:items-center
                    "
                  >

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >

                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >

                        <h2
                          className="
                            truncate
                            font-semibold
                          "
                        >
                          {book.title}
                        </h2>


                        {/* Language Badge */}

                        <span
                          className="
                            rounded-full
                            bg-neutral-100
                            px-2.5
                            py-1
                            text-[11px]
                            font-semibold
                            uppercase
                            tracking-wide
                            text-neutral-600
                          "
                          title={languageName(
                            book.learning_language
                          )}
                        >
                          {languageShortName(
                            book.learning_language
                          )}
                        </span>

                      </div>


                      <div
                        className="
                          mt-1
                          flex
                          flex-wrap
                          items-center
                          gap-2
                          text-sm
                          text-neutral-500
                        "
                      >

                        <span>
                          {languageName(
                            book.learning_language
                          )}
                        </span>


                        <span>
                          ·
                        </span>


                        <span>
                          {book.level}
                        </span>


                        {book.estimated_minutes && (

                          <>

                            <span>
                              ·
                            </span>

                            <span>
                              {
                                book
                                  .estimated_minutes
                              }{" "}
                              min
                            </span>

                          </>

                        )}


                        {book.subtitle && (

                          <>

                            <span>
                              ·
                            </span>

                            <span
                              className="
                                truncate
                              "
                            >
                              {book.subtitle}
                            </span>

                          </>

                        )}

                      </div>

                    </div>


                    {/* Status */}

                    <span
                      className={`
                        rounded-full
                        px-3
                        py-1
                        text-xs
                        font-semibold
                        ${
                          book.status ===
                          "published"
                            ? "bg-green-50 text-green-700"
                            : "bg-neutral-100 text-neutral-600"
                        }
                      `}
                    >

                      {book.status ===
                      "published"
                        ? "Published"
                        : "Draft"}

                    </span>


                    {/* Edit */}

                    <Link
                      href={`/stories/${book.id}`}
                      className="
                        rounded-xl
                        border
                        border-neutral-200
                        px-4
                        py-2
                        text-sm
                        font-medium
                        transition
                        hover:bg-neutral-50
                      "
                    >
                      Edit
                    </Link>

                  </div>

                )
              )}

            </div>

          )}

        </div>


        {/* Count */}

        {!booksLoading &&
          !booksError &&
          books.length > 0 && (

            <p
              className="
                mt-4
                text-sm
                text-neutral-400
              "
            >

              Showing{" "}

              {filteredBooks.length}{" "}

              of{" "}

              {books.length}{" "}

              {books.length === 1
                ? "story"
                : "stories"}

              {languageFilter !==
                "all" && (
                <>
                  {" "}
                  ·{" "}
                  {
                    languageName(
                      languageFilter
                    )
                  }
                </>
              )}

            </p>

          )}

      </div>

    </main>
  );
}