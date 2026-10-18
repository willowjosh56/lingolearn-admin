
"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import type { Book } from "@/lib/types";

type CoverKind = "desktop" | "mobile";

type CoverBook = Book & {
  mobile_cover_image_path?: string | null;
};

type Props = {
  book: CoverBook;
  onUpdated: (book: Book) => void;
};

function getCoverUrl(
  path: string | null | undefined
) {
  if (!path) return null;

  if (
    path.startsWith("https://") ||
    path.startsWith("http://")
  ) {
    return path;
  }

  return supabase.storage
    .from("book-covers")
    .getPublicUrl(path).data.publicUrl;
}

function CoverUploader({
  book,
  kind,
  onUpdated,
}: Props & {
  kind: CoverKind;
}) {
  const isMobile = kind === "mobile";

  // Keep database destinations unchanged.
  const column = isMobile
    ? "mobile_cover_image_path"
    : "cover_image_path";

  const storedPath = isMobile
    ? book.mobile_cover_image_path
    : book.cover_image_path;

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<string | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageError, setMessageError] =
    useState(false);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function selectFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      event.target.files?.[0];

    event.target.value = "";

    if (!selected) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        selected.type
      )
    ) {
      setMessage(
        "Please select a PNG, JPG or WebP image."
      );
      setMessageError(true);
      return;
    }

    const maximumSize =
      10 * 1024 * 1024;

    if (
      selected.size > maximumSize
    ) {
      setMessage(
        "The image must be smaller than 10 MB."
      );
      setMessageError(true);
      return;
    }

    setFile(selected);

    setPreview(
      URL.createObjectURL(selected)
    );

    setMessage("");
    setMessageError(false);
  }

  function cancelSelection() {
    if (uploading) return;

    setFile(null);
    setPreview(null);
    setMessage("");
    setMessageError(false);
  }

  async function uploadCover() {
    if (
      !file ||
      uploading
    ) {
      return;
    }

    setUploading(true);
    setMessage("");
    setMessageError(false);

    try {
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";

      const newPath =
        `${book.id}/${kind}-${crypto.randomUUID()}.${extension}`;

      // Upload the image first.
      const {
        error: uploadError,
      } = await supabase.storage
        .from("book-covers")
        .upload(
          newPath,
          file,
          {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      // Save the correct path in the book record.
      const {
        data,
        error: updateError,
      } = await supabase
        .from("books")
        .update({
          [column]: newPath,
        })
        .eq("id", book.id)
        .select("*")
        .single();

      if (
        updateError ||
        !data
      ) {
        // Only remove the newly uploaded file.
        await supabase.storage
          .from("book-covers")
          .remove([newPath]);

        throw (
          updateError ??
          new Error(
            "The cover could not be saved."
          )
        );
      }

      onUpdated(data as Book);

      setFile(null);
      setPreview(null);

      setMessage(
        isMobile
          ? "Mobile cover uploaded successfully."
          : "Desktop cover uploaded successfully."
      );

      // Previous covers are intentionally retained
      // to avoid breaking any existing references.
    } catch (cause) {
      setMessageError(true);

      setMessage(
        cause instanceof Error
          ? cause.message
          : "Unable to upload cover."
      );
    } finally {
      setUploading(false);
    }
  }

  const image =
    preview ??
    getCoverUrl(storedPath);

  return (
    <div className="rounded-2xl border border-[#e3e7f0] bg-[#f8faff] p-4">
      {/* TITLE */}
      <div>
        <h3 className="text-sm font-bold text-[#26365e]">
          {isMobile
            ? "Mobile Cover"
            : "Desktop Cover"}
        </h3>

        <p className="mt-2 text-xs leading-5 text-[#7d899d]">
          {isMobile
            ? "Smaller, wide artwork for the mobile version of the website."
            : "Large portrait-style artwork for the desktop version of the website."}
        </p>
      </div>

      {/* IMAGE PREVIEW */}
      <div
        className={`relative mt-4 overflow-hidden rounded-xl border border-[#e2e6ef] bg-[#edf1f8] ${
          isMobile
            ? "aspect-[4/3]"
            : "aspect-[3/4]"
        }`}
      >
        {image ? (
          <img
            src={image}
            alt={
              isMobile
                ? "Mobile cover preview"
                : "Desktop cover preview"
            }
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-5 text-center">
            <p className="text-xs leading-5 text-[#8c98ab]">
              {isMobile
                ? "No mobile cover uploaded yet."
                : "No desktop cover uploaded yet."}
            </p>
          </div>
        )}
      </div>

      {/* EXISTING FILE */}
      {storedPath && !file && (
        <p className="mt-3 truncate text-[10px] text-[#9aa5b6]">
          {storedPath}
        </p>
      )}

      {/* CHOOSE IMAGE */}
      <label className="mt-4 block cursor-pointer rounded-xl border border-[#dce2ed] bg-white px-4 py-3 text-center text-xs font-bold text-[#334875] transition hover:bg-[#f2f5fc]">
        {storedPath
          ? `Replace ${isMobile ? "Mobile" : "Desktop"} Cover`
          : `Choose ${isMobile ? "Mobile" : "Desktop"} Cover`}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={selectFile}
          disabled={uploading}
          className="sr-only"
        />
      </label>

      {/* SELECTED FILE */}
      {file && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-white p-3">
            <p className="truncate text-xs font-semibold text-[#26365e]">
              {file.name}
            </p>

            <p className="mt-1 text-[11px] text-[#8290a6]">
              {(
                file.size /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancelSelection}
              disabled={uploading}
              className="rounded-xl border border-[#dce2ed] bg-white px-3 py-3 text-xs font-bold text-[#52627e] transition hover:bg-[#f2f5fc] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                void uploadCover()
              }
              disabled={uploading}
              className="rounded-xl bg-[#26365e] px-3 py-3 text-xs font-bold text-white transition hover:bg-[#354a7e] disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : "Upload Cover"}
            </button>
          </div>
        </div>
      )}

      {/* STATUS */}
      {message && (
        <p
          role="status"
          className={`mt-4 break-words text-xs leading-5 ${
            messageError
              ? "text-red-600"
              : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default function StoryCoverManager({
  book,
  onUpdated,
}: Props) {
  return (
    <section className="rounded-3xl border border-[#e3e7f0] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#26365e]">
        Book Cover Artwork
      </h2>

      <p className="mt-2 text-sm leading-6 text-[#7d899d]">
        Manage the desktop and mobile images for
        this story independently.
      </p>

      <div className="mt-6 grid gap-5">
        {/* LARGE DESKTOP IMAGE */}
        <CoverUploader
          key={`desktop-${book.id}`}
          book={book}
          kind="desktop"
          onUpdated={onUpdated}
        />

        {/* SMALLER MOBILE IMAGE */}
        <CoverUploader
          key={`mobile-${book.id}`}
          book={book}
          kind="mobile"
          onUpdated={onUpdated}
        />
      </div>
    </section>
  );
}
