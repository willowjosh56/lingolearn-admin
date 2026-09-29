"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ContentType = "original" | "classic";

type LearningLanguage = "ru" | "es";

type Category =
  | "everyday"
  | "travel"
  | "mystery"
  | "romance"
  | "adventure"
  | "food";

export default function NewStoryPage() {
  const router = useRouter();

  const [contentType, setContentType] =
    useState<ContentType>("original");

  const [learningLanguage, setLearningLanguage] =
    useState<LearningLanguage>("ru");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [level, setLevel] = useState("A1");

  const [category, setCategory] =
    useState<Category>("everyday");

  const [estimatedMinutes, setEstimatedMinutes] =
    useState("5");

  const [originalAuthor, setOriginalAuthor] =
    useState("");

  const [
    originalPublicationYear,
    setOriginalPublicationYear,
  ] = useState("");

  const [sourceTitle, setSourceTitle] =
    useState("");

  const [sourceURL, setSourceURL] =
    useState("");

  const [adaptationNote, setAdaptationNote] =
    useState(
      "Adapted for language learners by LingoLearn"
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    const cleanTitle =
      title.trim();

    if (!cleanTitle) {
      setError(
        "A title is required."
      );
      return;
    }

    if (
      contentType === "classic" &&
      !originalAuthor.trim()
    ) {
      setError(
        "An original author is required for a classic."
      );
      return;
    }

    const minutes =
      Number(estimatedMinutes);

    if (
      !Number.isInteger(minutes) ||
      minutes < 1
    ) {
      setError(
        "Reading time must be a whole number of at least 1."
      );
      return;
    }

    let publicationYear:
      number | null = null;

    if (
      contentType === "classic" &&
      originalPublicationYear.trim()
    ) {
      publicationYear =
        Number(
          originalPublicationYear
        );

      if (
        !Number.isInteger(
          publicationYear
        ) ||
        publicationYear < 1
      ) {
        setError(
          "Publication year must be a valid whole number."
        );
        return;
      }
    }

    setSaving(true);
    setError("");

    const baseSlug =
      makeSlug(cleanTitle);

    if (!baseSlug) {
      setError(
        "Could not create a valid slug from that title."
      );
      setSaving(false);
      return;
    }

    let slug = baseSlug;

    const {
      data: existingBook,
    } = await supabase
      .from("books")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingBook) {
      slug =
        `${baseSlug}-${Date.now()}`;
    }

    const {
      data,
      error: insertError,
    } = await supabase
      .from("books")
      .insert({
        title: cleanTitle,

        // subtitle is NOT NULL
        // in our database.
        subtitle:
          subtitle.trim(),

        slug,

        source_language: "en",
        learning_language:
          learningLanguage,

        level,
        category,

        estimated_minutes:
          minutes,

        status: "draft",
        sort_order: 100,
        published_at: null,

        content_type:
          contentType,

        original_author:
          contentType === "classic"
            ? originalAuthor.trim() ||
              null
            : null,

        original_publication_year:
          contentType === "classic"
            ? publicationYear
            : null,

        source_title:
          contentType === "classic"
            ? sourceTitle.trim() ||
              null
            : null,

        source_url:
          contentType === "classic"
            ? sourceURL.trim() ||
              null
            : null,

        adaptation_note:
          contentType === "classic"
            ? adaptationNote.trim() ||
              null
            : null,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(
        `Could not create book: ${insertError.message}`
      );
      setSaving(false);
      return;
    }

    router.push(
      `/stories/${data.id}`
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f6f3] px-6 py-10">
      <div className="mx-auto max-w-3xl">

        {/* HEADER */}

        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
          >
            ← Back to library
          </Link>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
            LingoLearn Admin
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            New Book
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Create a draft, then add its
            cover, chapters, sentences and
            vocabulary.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* CONTENT TYPE */}

          <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
            <h2 className="font-semibold">
              Book type
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Choose where this book
              belongs in LingoLearn.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setContentType(
                    "original"
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  contentType ===
                  "original"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <p className="font-semibold">
                  LingoLearn Original
                </p>

                <p
                  className={`mt-1 text-sm ${
                    contentType ===
                    "original"
                      ? "text-neutral-300"
                      : "text-neutral-500"
                  }`}
                >
                  Stories created
                  specifically for
                  LingoLearn.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setContentType(
                    "classic"
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  contentType ===
                  "classic"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <p className="font-semibold">
                  Classic / Public Domain
                </p>

                <p
                  className={`mt-1 text-sm ${
                    contentType ===
                    "classic"
                      ? "text-neutral-300"
                      : "text-neutral-500"
                  }`}
                >
                  Real literature adapted
                  for language learners.
                </p>
              </button>
            </div>
          </section>

          {/* BASIC INFORMATION */}

          <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
            <h2 className="font-semibold">
              Book details
            </h2>

            <div className="mt-6 space-y-5">

              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Book title"
                required
              />

              <Field
                label="Subtitle"
                value={subtitle}
                onChange={setSubtitle}
                placeholder={
                  contentType ===
                  "classic"
                    ? "Optional learning-edition subtitle"
                    : "Optional subtitle"
                }
              />

              {/* LEARNING LANGUAGE */}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Learning language
                </label>

                <select
                  value={
                    learningLanguage
                  }
                  onChange={(event) =>
                    setLearningLanguage(
                      event.target
                        .value as LearningLanguage
                    )
                  }
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
                >
                  <option value="ru">
                    Russian
                  </option>

                  <option value="es">
                    Spanish
                  </option>
                </select>

                <p className="mt-2 text-xs text-neutral-400">
                  Determines which
                  language library this
                  book appears in.
                </p>
              </div>

              {/* LEVEL + READING TIME */}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Level
                  </label>

                  <select
                    value={level}
                    onChange={(event) =>
                      setLevel(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"
                  >
                    <option value="A1">
                      A1
                    </option>

                    <option value="A2">
                      A2
                    </option>

                    <option value="B1">
                      B1
                    </option>

                    <option value="B2">
                      B2
                    </option>

                    <option value="C1">
                      C1
                    </option>

                    <option value="C2">
                      C2
                    </option>
                  </select>
                </div>

                <Field
                  label="Reading time"
                  value={
                    estimatedMinutes
                  }
                  onChange={
                    setEstimatedMinutes
                  }
                  type="number"
                  min="1"
                  placeholder="5"
                />
              </div>

              {/* CATEGORY */}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target
                        .value as Category
                    )
                  }
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
                >
                  <option value="everyday">
                    Everyday
                  </option>

                  <option value="travel">
                    Travel
                  </option>

                  <option value="mystery">
                    Mystery
                  </option>

                  <option value="romance">
                    Romance
                  </option>

                  <option value="adventure">
                    Adventure
                  </option>

                  <option value="food">
                    Food
                  </option>
                </select>

                <p className="mt-2 text-xs text-neutral-400">
                  Used to organize and
                  filter stories in the
                  app.
                </p>
              </div>
            </div>
          </section>

          {/* CLASSIC METADATA */}

          {contentType ===
            "classic" && (
            <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
              <div>
                <h2 className="font-semibold">
                  Original work
                </h2>

                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Credit the original
                  work and keep a record
                  of where our source
                  text came from.
                </p>
              </div>

              <div className="mt-6 space-y-5">
                <Field
                  label="Original author"
                  value={
                    originalAuthor
                  }
                  onChange={
                    setOriginalAuthor
                  }
                  placeholder="Lewis Carroll"
                  required
                />

                <Field
                  label="Original publication year"
                  value={
                    originalPublicationYear
                  }
                  onChange={
                    setOriginalPublicationYear
                  }
                  type="number"
                  min="1"
                  placeholder="1865"
                />

                <Field
                  label="Source edition / website"
                  value={sourceTitle}
                  onChange={
                    setSourceTitle
                  }
                  placeholder="Project Gutenberg"
                />

                <Field
                  label="Source URL"
                  value={sourceURL}
                  onChange={
                    setSourceURL
                  }
                  type="url"
                  placeholder="https://..."
                />

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Adaptation note
                  </label>

                  <textarea
                    value={
                      adaptationNote
                    }
                    onChange={(event) =>
                      setAdaptationNote(
                        event.target
                          .value
                      )
                    }
                    rows={3}
                    className="w-full resize-y rounded-xl border border-neutral-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-400"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ERROR */}

          {error && (
            <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* ACTIONS */}

          <div className="flex justify-end gap-3">
            <Link
              href="/"
              className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold transition hover:bg-neutral-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#181818] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Creating..."
                : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}


// MARK: - Field

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        required={required}
        min={min}
        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
      />
    </div>
  );
}