"use client";



import {

  ChangeEvent,

  FormEvent,

  useEffect,

  useState,

} from "react";

import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import type { Book } from "@/lib/types";

import StoryContentEditor from "@/components/StoryContentEditor";

type Category =

  | "everyday"

  | "travel"

  | "mystery"

  | "romance"

  | "adventure"

  | "food";

type LearningLanguage = "ru" | "es" | "fr";

export default function StoryEditorPage() {

  const params = useParams();

  const router = useRouter();



  const bookId = String(params.id);



  const [book, setBook] = useState<Book | null>(null);



  const [title, setTitle] = useState("");

  const [subtitle, setSubtitle] = useState("");

  const [level, setLevel] = useState("A1");
  const [learningLanguage, setLearningLanguage] =
    useState<LearningLanguage>("ru");

  const [category, setCategory] =

  useState<Category>("everyday");

  const [estimatedMinutes, setEstimatedMinutes] =

    useState("");

  const [sortOrder, setSortOrder] = useState("");



  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [publishing, setPublishing] = useState(false);

  const [deleting, setDeleting] = useState(false);



  const [coverFile, setCoverFile] =

    useState<File | null>(null);

  const [coverPreview, setCoverPreview] =

    useState<string | null>(null);

  const [uploadingCover, setUploadingCover] =

    useState(false);

  const [coverMessage, setCoverMessage] = useState("");



  const [error, setError] = useState("");

  const [saveMessage, setSaveMessage] = useState("");

  const [publishMessage, setPublishMessage] =

    useState("");



  useEffect(() => {

    async function loadBook() {

      setLoading(true);

      setError("");



      const { data, error } = await supabase

        .from("books")

        .select("*")

        .eq("id", bookId)

        .single();



      if (error) {

        setError(error.message);

        setBook(null);

      } else {

        applyBook(data as Book);

      }



      setLoading(false);

    }



    loadBook();

  }, [bookId]);



  useEffect(() => {

    return () => {

      if (coverPreview) {

        URL.revokeObjectURL(coverPreview);

      }

    };

  }, [coverPreview]);



  function applyBook(updatedBook: Book) {

    setBook(updatedBook);

    setTitle(updatedBook.title);

    setSubtitle(updatedBook.subtitle ?? "");

    setLevel(updatedBook.level);
  setLearningLanguage(
    (updatedBook.learning_language ?? "ru") as LearningLanguage
  );

    setCategory(

  (updatedBook.category ?? "everyday") as Category

);



    setEstimatedMinutes(

      updatedBook.estimated_minutes?.toString() ?? ""

    );



    setSortOrder(updatedBook.sort_order.toString());

  }



  function getCoverURL(path: string | null) {

    if (!path) return null;



    const { data } = supabase.storage

      .from("book-covers")

      .getPublicUrl(path);



    return data.publicUrl;

  }



  function handleCoverSelection(

    event: ChangeEvent<HTMLInputElement>

  ) {

    const file = event.target.files?.[0];



    if (!file) return;



    setCoverMessage("");



    const allowedTypes = [

      "image/png",

      "image/jpeg",

      "image/webp",

    ];



    if (!allowedTypes.includes(file.type)) {

      setCoverMessage(

        "Please choose a PNG, JPG, JPEG or WebP image."

      );

      event.target.value = "";

      return;

    }



    const maximumSize = 10 * 1024 * 1024;



    if (file.size > maximumSize) {

      setCoverMessage(

        "The image must be smaller than 10 MB."

      );

      event.target.value = "";

      return;

    }



    if (coverPreview) {

      URL.revokeObjectURL(coverPreview);

    }



    setCoverFile(file);

    setCoverPreview(URL.createObjectURL(file));

  }



  async function handleCoverUpload() {

    if (!book || !coverFile || uploadingCover) return;



    setUploadingCover(true);

    setCoverMessage("");



    const extension =

      coverFile.name

        .split(".")

        .pop()

        ?.toLowerCase() || "jpg";



    const safeExtension =

      extension === "jpeg" ? "jpg" : extension;



    const fileName =

      `${book.slug}-${Date.now()}.${safeExtension}`;



    const { error: uploadError } =

      await supabase.storage

        .from("book-covers")

        .upload(fileName, coverFile, {

          cacheControl: "3600",

          upsert: false,

          contentType: coverFile.type,

        });



    if (uploadError) {

      setCoverMessage(

        `Could not upload cover: ${uploadError.message}`

      );

      setUploadingCover(false);

      return;

    }



    const oldCoverPath = book.cover_image_path;



    const { data, error: updateError } = await supabase

      .from("books")

      .update({

        cover_image_path: fileName,

      })

      .eq("id", book.id)

      .select("*")

      .single();



    if (updateError) {

      await supabase.storage

        .from("book-covers")

        .remove([fileName]);



      setCoverMessage(

        `Could not update story: ${updateError.message}`

      );

      setUploadingCover(false);

      return;

    }



    const updatedBook = data as Book;



    applyBook(updatedBook);



    if (

      oldCoverPath &&

      oldCoverPath !== fileName

    ) {

      await supabase.storage

        .from("book-covers")

        .remove([oldCoverPath]);

    }



    if (coverPreview) {

      URL.revokeObjectURL(coverPreview);

    }



    setCoverFile(null);

    setCoverPreview(null);

    setCoverMessage("Cover uploaded.");

    setUploadingCover(false);

  }



  async function handleSave(

    event: FormEvent<HTMLFormElement>

  ) {

    event.preventDefault();



    if (!book) return;



    const cleanTitle = title.trim();



    if (!cleanTitle) {

      setSaveMessage("A story title is required.");

      return;

    }



    const minutes =

      estimatedMinutes.trim() === ""

        ? null

        : Number(estimatedMinutes);



    const order =

      sortOrder.trim() === ""

        ? 0

        : Number(sortOrder);



    if (

      minutes !== null &&

      (!Number.isInteger(minutes) || minutes < 1)

    ) {

      setSaveMessage(

        "Estimated reading time must be a whole number."

      );

      return;

    }



    if (!Number.isInteger(order) || order < 0) {

      setSaveMessage(

        "Sort order must be a whole number."

      );

      return;

    }



    setSaving(true);

    setSaveMessage("");

    setPublishMessage("");



    const { data, error } = await supabase

      .from("books")

     .update({

  title: cleanTitle,

  subtitle: subtitle.trim(),

  level,

  learning_language: learningLanguage,

  category,

  estimated_minutes: minutes,

  sort_order: order,

})

      .eq("id", book.id)

      .select("*")

      .single();



    if (error) {

      setSaveMessage(

        `Could not save: ${error.message}`

      );

      setSaving(false);

      return;

    }



    applyBook(data as Book);



    setSaveMessage("Changes saved.");

    setSaving(false);

  }



  async function handlePublish() {

    if (!book || publishing) return;



    const confirmed = window.confirm(

      `Publish "${book.title}"?\n\nOnce published, it can appear in the LingoLearn app.`

    );



    if (!confirmed) return;



    setPublishing(true);

    setPublishMessage("");

    setSaveMessage("");



    const { data, error } = await supabase

      .from("books")

      .update({

        status: "published",

        published_at: new Date().toISOString(),

      })

      .eq("id", book.id)

      .select("*")

      .single();



    if (error) {

      setPublishMessage(

        `Could not publish: ${error.message}`

      );

      setPublishing(false);

      return;

    }



    applyBook(data as Book);



    setPublishMessage("Story published.");

    setPublishing(false);

  }



  async function handleUnpublish() {

    if (!book || publishing) return;



    const confirmed = window.confirm(

      `Unpublish "${book.title}"?\n\nThe story will return to Draft and will no longer be available as published content. Nothing will be deleted.`

    );



    if (!confirmed) return;



    setPublishing(true);

    setPublishMessage("");

    setSaveMessage("");



    const { data, error } = await supabase

      .from("books")

      .update({

        status: "draft",

        published_at: null,

      })

      .eq("id", book.id)

      .select("*")

      .single();



    if (error) {

      setPublishMessage(

        `Could not unpublish: ${error.message}`

      );

      setPublishing(false);

      return;

    }



    applyBook(data as Book);



    setPublishMessage("Story moved to Draft.");

    setPublishing(false);

  }



  async function handleDelete() {

    if (!book || deleting) return;



    const confirmation = window.prompt(

      `This will permanently delete "${book.title}" and all of its chapters, sentences and vocabulary.\n\nType the story title exactly to confirm:`

    );



    if (confirmation === null) return;



    if (confirmation !== book.title) {

      window.alert(

        "The title did not match. The story was not deleted."

      );

      return;

    }



    const finalConfirmation = window.confirm(

      `Permanently delete "${book.title}"?\n\nThis cannot be undone.`

    );



    if (!finalConfirmation) return;



    setDeleting(true);

    setSaveMessage("");

    setPublishMessage("");



    const coverPath = book.cover_image_path;



    const { error } = await supabase

      .from("books")

      .delete()

      .eq("id", book.id);



    if (error) {

      window.alert(

        `Could not delete story: ${error.message}`

      );



      setDeleting(false);

      return;

    }



    if (coverPath) {

      await supabase.storage

        .from("book-covers")

        .remove([coverPath]);

    }



    router.push("/");

  }



  if (loading) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f3]">

        <p className="text-sm text-neutral-500">

          Loading story...

        </p>

      </main>

    );

  }



  if (error || !book) {

    return (

      <main className="min-h-screen bg-[#f5f5f3] p-10 text-[#181818]">

        <div className="mx-auto max-w-3xl">

          <button

            onClick={() => router.push("/")}

            className="text-sm font-medium text-neutral-500 hover:text-black"

          >

            ← Back to stories

          </button>



          <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm">

            <h1 className="text-xl font-semibold">

              Could not load story

            </h1>



            <p className="mt-2 text-sm text-red-600">

              {error || "Story not found."}

            </p>

          </div>

        </div>

      </main>

    );

  }



  const currentCoverURL =

    getCoverURL(book.cover_image_path);



  return (

    <main className="min-h-screen bg-[#f5f5f3] text-[#181818]">

      <header className="border-b border-black/5 bg-white">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <div>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">

              LingoLearn

            </p>



            <p className="mt-1 font-semibold">

              Story Editor

            </p>

          </div>



          <button

            type="button"

            onClick={() => router.push("/")}

            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50"

          >

            Back to Stories

          </button>

        </div>

      </header>



      <div className="mx-auto max-w-6xl px-6 py-12">

        <div className="flex flex-wrap items-start justify-between gap-6">

          <div>

            <p className="mb-3 text-sm text-neutral-500">

              Editing story

            </p>



            <h1 className="text-4xl font-semibold tracking-tight">

              {book.title}

            </h1>



            {book.subtitle && (

              <p className="mt-3 text-neutral-500">

                {book.subtitle}

              </p>

            )}

          </div>



          <span

            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${

              book.status === "published"

                ? "bg-green-50 text-green-700"

                : "bg-neutral-200 text-neutral-600"

            }`}

          >

            {book.status === "published"

              ? "Published"

              : "Draft"}

          </span>

        </div>



        <form

          onSubmit={handleSave}

          className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]"

        >

          {/* LEFT COLUMN */}

          <div className="space-y-6">

            {/* STORY DETAILS */}

            <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">

              <div className="border-b border-neutral-100 pb-5">

                <h2 className="text-lg font-semibold">

                  Story details

                </h2>



                <p className="mt-1 text-sm text-neutral-500">

                  Edit the basic information shown in the

                  LingoLearn library.

                </p>

              </div>



              <div className="mt-7 space-y-6">

                <InputField

                  label="Title"

                  value={title}

                  onChange={setTitle}

                  required

                />



                <InputField

                  label="Subtitle"

                  value={subtitle}

                  onChange={setSubtitle}

                  placeholder="Optional"

                />



                <div className="grid gap-6 sm:grid-cols-3">

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

                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"

                    />

                  </div>



                  <div>

                    <label className="mb-2 block text-sm font-medium">

                      Sort order

                    </label>



                    <input

                      type="number"

                      min="0"

                      step="1"

                      value={sortOrder}

                      onChange={(event) =>

                        setSortOrder(

                          event.target.value

                        )

                      }

                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"

                    />

                  </div>

                </div>



                <div>

  <label className="mb-2 block text-sm font-medium">

    Category

  </label>



  <select

    value={category}

    onChange={(event) =>

      setCategory(

        event.target.value as Category

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

    Used to organize and filter stories in the app.

  </p>

</div>



                <div className="grid gap-6 border-t border-neutral-100 pt-6 sm:grid-cols-2">

                  <ReadOnlyField

                    label="Source language"

                    value={book.source_language.toUpperCase()}

                  />

                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Learning language
                    </label>

                    <select
                      value={learningLanguage}
                      onChange={(event) =>
                        setLearningLanguage(
                          event.target.value as LearningLanguage
                        )
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-neutral-400"
                    >
                      <option value="ru">Russian</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>



                  <ReadOnlyField

                    label="Slug"

                    value={book.slug}

                  />



                  <ReadOnlyField

                    label="Story ID"

                    value={book.id}

                  />

                </div>

              </div>

            </section>



            {/* STORY CONTENT */}

            <StoryContentEditor bookId={book.id} />

          </div>



          {/* RIGHT SIDEBAR */}

          <aside className="space-y-6">

            {/* PUBLISHING */}

            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">

              <h2 className="font-semibold">

                Publishing

              </h2>



              <div className="mt-5">

                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">

                  Current status

                </p>



                <p className="mt-2 text-sm font-medium">

                  {book.status === "published"

                    ? "Published"

                    : "Draft"}

                </p>

              </div>



              {book.published_at && (

                <div className="mt-5">

                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">

                    Published

                  </p>



                  <p className="mt-2 text-sm text-neutral-600">

                    {new Date(

                      book.published_at

                    ).toLocaleString()}

                  </p>

                </div>

              )}



              <div className="mt-6 border-t border-neutral-100 pt-6">

                {book.status === "draft" ? (

                  <button

                    type="button"

                    onClick={handlePublish}

                    disabled={

                      publishing ||

                      deleting ||

                      uploadingCover

                    }

                    className="w-full rounded-xl bg-[#181818] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {publishing

                      ? "Publishing..."

                      : "Publish Story"}

                  </button>

                ) : (

                  <button

                    type="button"

                    onClick={handleUnpublish}

                    disabled={

                      publishing ||

                      deleting ||

                      uploadingCover

                    }

                    className="w-full rounded-xl border border-neutral-200 px-5 py-3 text-sm font-semibold transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {publishing

                      ? "Updating..."

                      : "Unpublish"}

                  </button>

                )}



                {publishMessage && (

                  <p

                    className={`mt-4 text-center text-sm ${

                      publishMessage ===

                        "Story published." ||

                      publishMessage ===

                        "Story moved to Draft."

                        ? "text-green-700"

                        : "text-red-600"

                    }`}

                  >

                    {publishMessage}

                  </p>

                )}

              </div>

            </div>



            {/* COVER */}

            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">

              <div>

                <h2 className="font-semibold">

                  Cover

                </h2>



                <p className="mt-1 text-sm text-neutral-500">

                  Artwork shown in the story library.

                </p>

              </div>



              <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100">

                {coverPreview ? (

                  <img

                    src={coverPreview}

                    alt="New cover preview"

                    className="aspect-[16/9] w-full object-cover"

                  />

                ) : currentCoverURL ? (

                  <img

                    src={currentCoverURL}

                    alt={`${book.title} cover`}

                    className="aspect-[16/9] w-full object-cover"

                  />

                ) : (

                  <div className="flex aspect-[16/9] items-center justify-center">

                    <p className="text-sm text-neutral-400">

                      No cover

                    </p>

                  </div>

                )}

              </div>



              {book.cover_image_path &&

                !coverFile && (

                  <p className="mt-3 truncate text-xs text-neutral-400">

                    {book.cover_image_path}

                  </p>

                )}



              {coverFile && (

                <div className="mt-4 rounded-xl bg-[#f7f7f5] p-3">

                  <p className="truncate text-sm font-medium">

                    {coverFile.name}

                  </p>



                  <p className="mt-1 text-xs text-neutral-400">

                    {(

                      coverFile.size /

                      1024 /

                      1024

                    ).toFixed(2)}{" "}

                    MB

                  </p>

                </div>

              )}



              <div className="mt-5">

                <label className="block w-full cursor-pointer rounded-xl border border-neutral-200 px-4 py-3 text-center text-sm font-semibold transition hover:bg-neutral-50">

                  {book.cover_image_path

                    ? "Choose New Cover"

                    : "Choose Cover"}



                  <input

                    type="file"

                    accept="image/png,image/jpeg,image/webp"

                    onChange={

                      handleCoverSelection

                    }

                    disabled={uploadingCover}

                    className="hidden"

                  />

                </label>

              </div>



              {coverFile && (

                <div className="mt-3 flex gap-2">

                  <button

                    type="button"

                    onClick={() => {

                      if (coverPreview) {

                        URL.revokeObjectURL(

                          coverPreview

                        );

                      }



                      setCoverFile(null);

                      setCoverPreview(null);

                      setCoverMessage("");

                    }}

                    disabled={uploadingCover}

                    className="flex-1 rounded-xl border border-neutral-200 px-3 py-3 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

                  >

                    Cancel

                  </button>



                  <button

                    type="button"

                    onClick={handleCoverUpload}

                    disabled={uploadingCover}

                    className="flex-1 rounded-xl bg-[#181818] px-3 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {uploadingCover

                      ? "Uploading..."

                      : "Upload Cover"}

                  </button>

                </div>

              )}



              {coverMessage && (

                <p

                  className={`mt-4 text-sm ${

                    coverMessage ===

                    "Cover uploaded."

                      ? "text-green-700"

                      : "text-red-600"

                  }`}

                >

                  {coverMessage}

                </p>

              )}

            </div>



            {/* SAVE */}

            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">

              <button

                type="submit"

                disabled={

                  saving ||

                  publishing ||

                  deleting ||

                  uploadingCover

                }

                className="w-full rounded-xl bg-[#181818] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"

              >

                {saving

                  ? "Saving..."

                  : "Save Changes"}

              </button>



              {saveMessage && (

                <p

                  className={`mt-4 text-center text-sm ${

                    saveMessage ===

                    "Changes saved."

                      ? "text-green-700"

                      : "text-red-600"

                  }`}

                >

                  {saveMessage}

                </p>

              )}

            </div>



            {/* DANGER ZONE */}

            <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">

              <h2 className="font-semibold text-red-700">

                Danger zone

              </h2>



              <p className="mt-2 text-sm leading-6 text-neutral-500">

                Permanently delete this story and all of

                its content. This action cannot be undone.

              </p>



              <button

                type="button"

                onClick={handleDelete}

                disabled={

                  saving ||

                  publishing ||

                  deleting ||

                  uploadingCover

                }

                className="mt-5 w-full rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"

              >

                {deleting

                  ? "Deleting..."

                  : "Delete Story"}

              </button>

            </div>

          </aside>

        </form>

      </div>

    </main>

  );

}



function InputField({

  label,

  value,

  onChange,

  placeholder,

  required = false,

}: {

  label: string;

  value: string;

  onChange: (value: string) => void;

  placeholder?: string;

  required?: boolean;

}) {

  return (

    <div>

      <label className="mb-2 block text-sm font-medium">

        {label}

      </label>



      <input

        type="text"

        value={value}

        onChange={(event) =>

          onChange(event.target.value)

        }

        placeholder={placeholder}

        required={required}

        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"

      />

    </div>

  );

}



function ReadOnlyField({

  label,

  value,

}: {

  label: string;

  value: string;

}) {

  return (

    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">

        {label}

      </p>



      <p className="mt-2 break-all text-sm font-medium">

        {value}

      </p>

    </div>

  );

}