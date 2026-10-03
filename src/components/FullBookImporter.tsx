"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ParsedChapter = {
  title: string;
  text: string;
  sentences: string[];
};

type FullBookImporterProps = {
  bookId: string;
  existingChapterCount: number;
  existingSentenceCount: number;
  onImported: () => Promise<void> | void;
};

function normalizeText(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripProjectGutenbergWrapper(rawText: string) {
  let text = normalizeText(rawText);

  const startPatterns = [
    /\*\*\*\s*START OF THE PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
    /\*\*\*\s*START OF THIS PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
  ];

  const endPatterns = [
    /\*\*\*\s*END OF THE PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
    /\*\*\*\s*END OF THIS PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i,
  ];

  for (const pattern of startPatterns) {
    const match = text.match(pattern);

    if (match && match.index !== undefined) {
      text = text.slice(match.index + match[0].length);
      break;
    }
  }

  for (const pattern of endPatterns) {
    const match = text.match(pattern);

    if (match && match.index !== undefined) {
      text = text.slice(0, match.index);
      break;
    }
  }

  return normalizeText(text);
}

function looksLikeChapterHeading(line: string) {
  const value = line.trim();

  if (!value) return false;

  if (value.length > 120) return false;

  const patterns = [
    /^chapter\s+(?:\d+|[ivxlcdm]+)\b.*$/i,
    /^book\s+(?:\d+|[ivxlcdm]+)\b.*$/i,
    /^part\s+(?:\d+|[ivxlcdm]+)\b.*$/i,

    // Sherlock / older collections:
    // I. A SCANDAL IN BOHEMIA
    // II. THE RED-HEADED LEAGUE
    /^(?:[ivxlcdm]+)\.\s+.+$/i,

    // Numbered headings:
    // 1. The Beginning
    /^\d+\.\s+.+$/,
  ];

  return patterns.some((pattern) => pattern.test(value));
}

function cleanChapterTitle(line: string) {
  return line
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
}

function splitIntoSentences(text: string) {
  const clean = text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  try {
    if (
      typeof Intl !== "undefined" &&
      "Segmenter" in Intl
    ) {
      const SegmenterConstructor = (
        Intl as typeof Intl & {
          Segmenter?: new (
            locale?: string,
            options?: {
              granularity: "sentence";
            }
          ) => {
            segment: (
              input: string
            ) => Iterable<{ segment: string }>;
          };
        }
      ).Segmenter;

      if (SegmenterConstructor) {
        const segmenter = new SegmenterConstructor(
          "en",
          {
            granularity: "sentence",
          }
        );

        const sentences = Array.from(
          segmenter.segment(clean)
        )
          .map((item) => item.segment.trim())
          .filter(Boolean);

        if (sentences.length > 0) {
          return sentences;
        }
      }
    }
  } catch {
    // Fall through to regex splitter.
  }

  return clean
    .split(/(?<=[.!?])\s+(?=["“‘'A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function parseBook(rawText: string): ParsedChapter[] {
  const cleaned = stripProjectGutenbergWrapper(rawText);

  if (!cleaned) return [];

  const lines = cleaned.split("\n");

  type CandidateChapter = {
    title: string;
    bodyLines: string[];
  };

  const candidates: CandidateChapter[] = [];

  let currentTitle = "";
  let currentBody: string[] = [];

  function finishCurrentChapter() {
    if (!currentTitle) return;

    const body = normalizeText(
      currentBody.join("\n")
    );

    candidates.push({
      title: currentTitle,
      bodyLines: body ? [body] : [],
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (looksLikeChapterHeading(line)) {
      finishCurrentChapter();

      currentTitle = cleanChapterTitle(line);
      currentBody = [];

      continue;
    }

    if (currentTitle) {
      currentBody.push(rawLine);
    }
  }

  finishCurrentChapter();

  /*
   * Gutenberg books often contain a contents page where the
   * chapter headings appear once, followed later by the same
   * headings in the actual book.
   *
   * We group duplicate headings and keep the version with the
   * largest amount of body text. This normally discards TOC
   * entries while preserving the real chapter.
   */
  const bestByTitle = new Map<
    string,
    CandidateChapter
  >();

  for (const candidate of candidates) {
    const key = candidate.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const existing = bestByTitle.get(key);

    const candidateLength =
      candidate.bodyLines.join("\n").length;

    const existingLength =
      existing?.bodyLines.join("\n").length ?? -1;

    if (
      !existing ||
      candidateLength > existingLength
    ) {
      bestByTitle.set(key, candidate);
    }
  }

  const deduplicated: CandidateChapter[] = [];

  const usedKeys = new Set<string>();

  /*
   * Preserve the original order of the real chapter candidates.
   */
  for (const candidate of candidates) {
    const key = candidate.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (usedKeys.has(key)) continue;

    const best = bestByTitle.get(key);

    if (best !== candidate) continue;

    usedKeys.add(key);
    deduplicated.push(candidate);
  }

  const parsed = deduplicated
    .map((chapter) => {
      const text = normalizeText(
        chapter.bodyLines.join("\n")
      );

      return {
        title: chapter.title,
        text,
        sentences: splitIntoSentences(text),
      };
    })
    .filter(
      (chapter) =>
        chapter.text.length >= 100 &&
        chapter.sentences.length > 0
    );

  /*
   * If no chapter headings were detected, treat the entire
   * supplied text as one chapter instead of silently failing.
   */
  if (parsed.length === 0 && cleaned.length > 0) {
    const sentences = splitIntoSentences(cleaned);

    if (sentences.length > 0) {
      return [
        {
          title: "Chapter 1",
          text: cleaned,
          sentences,
        },
      ];
    }
  }

  return parsed;
}

function chunkArray<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(index, index + size)
    );
  }

  return chunks;
}

export default function FullBookImporter({
  bookId,
  existingChapterCount,
  existingSentenceCount,
  onImported,
}: FullBookImporterProps) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsedChapters, setParsedChapters] =
    useState<ParsedChapter[]>([]);
  const [message, setMessage] = useState("");
  const [importing, setImporting] =
    useState(false);

  const totalSentences = useMemo(
    () =>
      parsedChapters.reduce(
        (total, chapter) =>
          total + chapter.sentences.length,
        0
      ),
    [parsedChapters]
  );

  const hasExistingContent =
    existingChapterCount > 0 ||
    existingSentenceCount > 0;

  function resetImporter() {
    if (importing) return;

    setRawText("");
    setParsedChapters([]);
    setMessage("");
    setOpen(false);
  }

  function previewBook() {
    setMessage("");

    const clean = rawText.trim();

    if (!clean) {
      setMessage(
        "Paste the book text before creating a preview."
      );
      return;
    }

    const chapters = parseBook(clean);

    if (chapters.length === 0) {
      setMessage(
        "No usable book content could be detected."
      );
      return;
    }

    setParsedChapters(chapters);

    setMessage(
      `Preview ready: ${chapters.length} ${
        chapters.length === 1
          ? "chapter"
          : "chapters"
      } and ${chapters.reduce(
        (total, chapter) =>
          total + chapter.sentences.length,
        0
      )} sentences detected.`
    );
  }

  async function importBook() {
    if (importing) return;

    if (hasExistingContent) {
      setMessage(
        "Full Book Import is only available for an empty book. This protects existing content from accidental duplication."
      );
      return;
    }

    if (parsedChapters.length === 0) {
      setMessage(
        "Create a preview before importing the book."
      );
      return;
    }

    const confirmed = window.confirm(
      `Import ${parsedChapters.length} chapters and ${totalSentences} English sentences into this book?\n\nThe learning-language translations will remain blank for now. We will generate and review those in the next stage.\n\nOnly continue if the chapter preview looks correct.`
    );

    if (!confirmed) return;

    setImporting(true);
    setMessage("Importing chapters...");

    const createdChapterIds: string[] = [];

    try {
      /*
       * We create chapters individually because we need the
       * returned chapter ID before its sentences can be linked.
       */
      for (
        let chapterIndex = 0;
        chapterIndex < parsedChapters.length;
        chapterIndex += 1
      ) {
        const parsedChapter =
          parsedChapters[chapterIndex];

        setMessage(
          `Importing chapter ${
            chapterIndex + 1
          } of ${parsedChapters.length}: ${
            parsedChapter.title
          }`
        );

        const { data: createdChapter, error } =
          await supabase
            .from("chapters")
            .insert({
              book_id: bookId,
              chapter_number:
                chapterIndex + 1,
              title: parsedChapter.title,
              sort_order: chapterIndex + 1,
            })
            .select("id")
            .single();

        if (error) {
          throw new Error(
            `Could not create "${parsedChapter.title}": ${error.message}`
          );
        }

        if (!createdChapter?.id) {
          throw new Error(
            `Could not get the ID for "${parsedChapter.title}".`
          );
        }

        createdChapterIds.push(
          createdChapter.id
        );

        const sentenceRows =
          parsedChapter.sentences.map(
            (sentence, sentenceIndex) => ({
              book_id: bookId,
              chapter_id: createdChapter.id,

              /*
               * Temporary position.
               * reorder_book_sentences will create the final
               * whole-book numbering after import.
               */
              position:
                chapterIndex * 100000 +
                sentenceIndex +
                1,

              source_text: sentence,

              /*
               * Intentionally blank.
               * This is a raw-source draft, not a completed
               * bilingual chapter.
               */
              translated_text: "",

              pronunciation: "",
            })
          );

        /*
         * Insert in manageable batches rather than sending an
         * entire novel to Supabase in one request.
         */
        const batches = chunkArray(
          sentenceRows,
          250
        );

        for (
          let batchIndex = 0;
          batchIndex < batches.length;
          batchIndex += 1
        ) {
          const { error: sentenceError } =
            await supabase
              .from("sentences")
              .insert(batches[batchIndex]);

          if (sentenceError) {
            throw new Error(
              `Chapter "${parsedChapter.title}" was created, but its sentences could not be imported: ${sentenceError.message}`
            );
          }
        }
      }

      setMessage(
        "Renumbering imported sentences..."
      );

      const { error: reorderError } =
        await supabase.rpc(
          "reorder_book_sentences",
          {
            p_book_id: bookId,
          }
        );

      if (reorderError) {
        throw new Error(
          `The book was imported, but sentence positions could not be reordered: ${reorderError.message}`
        );
      }

      await onImported();

      setRawText("");
      setParsedChapters([]);

      setMessage(
        `Import complete. ${createdChapterIds.length} chapters and ${totalSentences} English sentences were added.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown import error.";

      setMessage(
        `Import stopped: ${errorMessage}`
      );
    } finally {
      setImporting(false);
    }
  }

  async function loadTextFile(
    file: File | undefined
  ) {
    if (!file) return;

    setMessage("");
    setParsedChapters([]);

    try {
      const text = await file.text();

      setRawText(text);

      setMessage(
        `${file.name} loaded. Press Preview Book to inspect the detected chapters.`
      );
    } catch {
      setMessage(
        "The text file could not be read."
      );
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9]">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">
              Full Book Import
            </h3>

            <span className="rounded-full bg-neutral-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Classic Books
            </span>
          </div>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Import a complete public-domain book
            from plain text. Chapters and English
            sentences will be detected
            automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessage("");
            setOpen((value) => !value);
          }}
          disabled={importing}
          className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
        >
          {open
            ? "Close Importer"
            : "Import Full Book"}
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-200 p-5">
          {hasExistingContent ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                This book already contains
                content.
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Full Book Import is disabled for
                books that already contain
                chapters or sentences. Create a
                new empty Classic Book before
                importing a complete source text.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Phase 1 — source import
                </p>

                <p className="mt-1 text-sm leading-6 text-blue-800">
                  This imports the English source
                  structure only. Translation,
                  learner adaptation,
                  pronunciation and contextual
                  vocabulary will be added in the
                  next processing stage.
                </p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Plain-text file
                </label>

                <input
                  type="file"
                  accept=".txt,text/plain"
                  disabled={importing}
                  onChange={(event) => {
                    void loadTextFile(
                      event.target.files?.[0]
                    );
                  }}
                  className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                />

                <p className="mt-2 text-xs leading-5 text-neutral-400">
                  A Project Gutenberg plain-text
                  file works well. The importer
                  will attempt to remove the
                  Gutenberg start/end wrapper.
                </p>
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />

                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  or paste text
                </span>

                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Full book text
                </label>

                <textarea
                  value={rawText}
                  onChange={(event) => {
                    setRawText(
                      event.target.value
                    );
                    setParsedChapters([]);
                    setMessage("");
                  }}
                  rows={14}
                  disabled={importing}
                  placeholder={`Paste the complete plain-text book here...

For Sherlock Holmes, headings such as:

I. A SCANDAL IN BOHEMIA

II. THE RED-HEADED LEAGUE

III. A CASE OF IDENTITY

will be detected automatically.`}
                  className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-neutral-400 disabled:opacity-50"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-neutral-400">
                  {rawText.length.toLocaleString()}{" "}
                  characters loaded
                </p>

                <button
                  type="button"
                  onClick={previewBook}
                  disabled={
                    importing ||
                    !rawText.trim()
                  }
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-40"
                >
                  Preview Book
                </button>
              </div>

              {message && (
                <div
                  className={`mt-5 rounded-xl px-4 py-3 text-sm font-medium ${
                    message.startsWith(
                      "Import stopped"
                    ) ||
                    message.startsWith(
                      "No usable"
                    ) ||
                    message.startsWith(
                      "Paste"
                    ) ||
                    message.includes(
                      "could not"
                    )
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {message}
                </div>
              )}

              {parsedChapters.length > 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">
                        Import preview
                      </h4>

                      <p className="mt-1 text-sm text-neutral-500">
                        {
                          parsedChapters.length
                        }{" "}
                        {parsedChapters.length ===
                        1
                          ? "chapter"
                          : "chapters"}{" "}
                        ·{" "}
                        {totalSentences.toLocaleString()}{" "}
                        sentences
                      </p>
                    </div>

                    <p className="text-xs text-neutral-400">
                      Check these chapter titles
                      before importing.
                    </p>
                  </div>

                  <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3">
                    {parsedChapters.map(
                      (chapter, index) => (
                        <div
                          key={`${chapter.title}-${index}`}
                          className="flex items-start gap-4 rounded-lg border border-neutral-100 px-4 py-3"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-neutral-800">
                              {
                                chapter.title
                              }
                            </p>

                            <p className="mt-1 text-xs text-neutral-400">
                              {
                                chapter
                                  .sentences
                                  .length
                              }{" "}
                              sentences ·{" "}
                              {chapter.text.length.toLocaleString()}{" "}
                              characters
                            </p>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">
                              {
                                chapter
                                  .sentences[0]
                              }
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      Check the preview first
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-700">
                      Do not import if chapter
                      headings look wrong. Fix the
                      source text or parser first.
                      Importing creates real
                      Supabase records.
                    </p>
                  </div>

                  <div className="mt-5 flex justify-end gap-2 border-t border-neutral-200 pt-5">
                    <button
                      type="button"
                      onClick={resetImporter}
                      disabled={importing}
                      className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void importBook();
                      }}
                      disabled={importing}
                      className="rounded-xl bg-[#181818] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                    >
                      {importing
                        ? "Importing..."
                        : `Import ${parsedChapters.length} Chapters`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}