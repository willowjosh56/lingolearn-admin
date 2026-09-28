"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewStoryPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [level, setLevel] = useState("A1");
  const [estimatedMinutes, setEstimatedMinutes] = useState("5");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("A story title is required.");
      return;
    }

    const minutes = Number(estimatedMinutes);

    if (!Number.isInteger(minutes) || minutes < 1) {
      setError(
        "Reading time must be a whole number greater than 0."
      );
      return;
    }

    const slug = makeSlug(cleanTitle);

    if (!slug) {
      setError(
        "Please use a title containing letters or numbers."
      );
      return;
    }

    setCreating(true);
    setError("");

    const { data: existingBook, error: slugCheckError } =
      await supabase
        .from("books")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (slugCheckError) {
      setError(slugCheckError.message);
      setCreating(false);
      return;
    }

    if (existingBook) {
      setError(
        "A story with this title already exists. Please use a different title."
      );
      setCreating(false);
      return;
    }

    const { data, error: createError } = await supabase
      .from("books")
      .insert({
        title: cleanTitle,
        subtitle: subtitle.trim(),

        slug,

        source_language: "en",
        learning_language: "ru",

        level,
        estimated_minutes: minutes,

        status: "draft",
        sort_order: 100,
        published_at: null,
      })
      .select("id")
      .single();

    if (createError) {
      setError(createError.message);
      setCreating(false);
      return;
    }

    router.push(`/stories/${data.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-[#181818]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              LingoLearn
            </p>

            <p className="mt-1 font-semibold">
              New Story
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm text-neutral-500">
            Create story
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Start a new story
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
            Your new story will be created as a draft.
            It will not appear in the LingoLearn app until
            you publish it.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-10 rounded-3xl border border-black/5 bg-white p-7 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Title
            </label>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              required
              autoFocus
              placeholder="The Weekend in Moscow"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
            />
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium">
              Subtitle
            </label>

            <input
              type="text"
              value={subtitle}
              onChange={(event) =>
                setSubtitle(event.target.value)
              }
              placeholder="Optional"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
            />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Level
              </label>

              <select
                value={level}
                onChange={(event) =>
                  setLevel(event.target.value)
                }
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Reading time
              </label>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={estimatedMinutes}
                  onChange={(event) =>
                    setEstimatedMinutes(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 pr-20 text-sm outline-none transition focus:border-neutral-400"
                />

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
                  minutes
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#f7f7f5] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  English → Russian
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Language pair
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">
                EN → RU
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-neutral-100 pt-6">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-[#181818] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}