"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MasterVocabulary = {
  word: string;
  tap_text: string;
  translation: string;
  pronunciation?: string;
};

type MasterSentence = {
  number: number;
  source_text: string;
  adapted_text: string;
  translated_text: string;
  pronunciation: string;
  vocabulary: MasterVocabulary[];
};

type MasterChapter = {
  number: number;
  title: string;
  sentences: MasterSentence[];
};

type MasterBook = {
  title: string;
  author?: string;
  source_language: string;
  learning_language: string;
  level: string;
  chapters: MasterChapter[];
};

type ProcessedBookImporterProps = {
  bookId: string;
  expectedLearningLanguage?: string;
  existingChapterCount: number;
  existingSentenceCount: number;
  onImported: () => Promise<void> | void;
};

type ValidationResult = {
  errors: string[];
  warnings: string[];
  chapterCount: number;
  sentenceCount: number;
  vocabularyCount: number;
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function validateMasterBook(
  book: MasterBook,
  expectedLearningLanguage?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let sentenceCount = 0;
  let vocabularyCount = 0;

  if (!book || typeof book !== "object") {
    return {
      errors: [
        "The JSON does not contain a valid book object.",
      ],
      warnings,
      chapterCount: 0,
      sentenceCount: 0,
      vocabularyCount: 0,
    };
  }

  if (!book.title?.trim()) {
    errors.push("Book title is missing.");
  }

  if (!book.source_language?.trim()) {
    errors.push("source_language is missing.");
  }

  if (!book.learning_language?.trim()) {
    errors.push("learning_language is missing.");
  }

  if (!book.level?.trim()) {
    errors.push("level is missing.");
  }

  if (
    expectedLearningLanguage &&
    book.learning_language &&
    expectedLearningLanguage.toLowerCase() !==
      book.learning_language.toLowerCase()
  ) {
    errors.push(
      `Language mismatch: this book expects "${expectedLearningLanguage}" but the master file contains "${book.learning_language}".`
    );
  }

  if (
    !Array.isArray(book.chapters) ||
    book.chapters.length === 0
  ) {
    errors.push(
      "The master file contains no chapters."
    );

    return {
      errors,
      warnings,
      chapterCount: 0,
      sentenceCount: 0,
      vocabularyCount: 0,
    };
  }

  const seenChapterNumbers = new Set<number>();
  const seenSentenceNumbers = new Set<number>();

  let previousChapterNumber = 0;
  let previousSentenceNumber = 0;

  for (const chapter of book.chapters) {
    if (
      !Number.isInteger(chapter.number) ||
      chapter.number < 1
    ) {
      errors.push(
        `A chapter has an invalid chapter number: ${String(
          chapter.number
        )}.`
      );
      continue;
    }

    if (seenChapterNumbers.has(chapter.number)) {
      errors.push(
        `Duplicate chapter number ${chapter.number}.`
      );
    }

    seenChapterNumbers.add(chapter.number);

    if (chapter.number <= previousChapterNumber) {
      errors.push(
        `Chapter ${chapter.number} is out of order.`
      );
    }

    previousChapterNumber = chapter.number;

    if (!chapter.title?.trim()) {
      errors.push(
        `Chapter ${chapter.number} has no title.`
      );
    }

    if (
      !Array.isArray(chapter.sentences) ||
      chapter.sentences.length === 0
    ) {
      errors.push(
        `Chapter ${chapter.number} contains no sentences.`
      );
      continue;
    }

    for (const sentence of chapter.sentences) {
      sentenceCount += 1;

      const label = `Sentence ${sentence.number}`;

      if (
        !Number.isInteger(sentence.number) ||
        sentence.number < 1
      ) {
        errors.push(
          `${label} has an invalid sentence number.`
        );
        continue;
      }

      if (
        seenSentenceNumbers.has(sentence.number)
      ) {
        errors.push(
          `Duplicate sentence number ${sentence.number}.`
        );
      }

      seenSentenceNumbers.add(sentence.number);

      if (
        sentence.number <= previousSentenceNumber
      ) {
        errors.push(
          `${label} is out of whole-book order.`
        );
      }

      previousSentenceNumber = sentence.number;

      if (!sentence.source_text?.trim()) {
        errors.push(
          `${label} is missing source_text.`
        );
      }

      if (!sentence.adapted_text?.trim()) {
        errors.push(
          `${label} is missing adapted_text.`
        );
      }

      if (!sentence.translated_text?.trim()) {
        errors.push(
          `${label} is missing translated_text.`
        );
      }

      if (!sentence.pronunciation?.trim()) {
        errors.push(
          `${label} is missing pronunciation.`
        );
      }

      if (!Array.isArray(sentence.vocabulary)) {
        errors.push(
          `${label} vocabulary must be an array. Use [] when there are no vocabulary items.`
        );
        continue;
      }

      const translatedNormalized =
        normalizeForMatch(
          sentence.translated_text || ""
        );

      const seenTapTexts = new Set<string>();

      for (
        let vocabularyIndex = 0;
        vocabularyIndex <
        sentence.vocabulary.length;
        vocabularyIndex += 1
      ) {
        const vocabulary =
          sentence.vocabulary[vocabularyIndex];

        vocabularyCount += 1;

        const vocabLabel =
          `${label}, vocabulary ${
            vocabularyIndex + 1
          }`;

        if (!vocabulary.word?.trim()) {
          errors.push(
            `${vocabLabel} is missing word.`
          );
        }

        if (!vocabulary.tap_text?.trim()) {
          errors.push(
            `${vocabLabel} is missing tap_text.`
          );
          continue;
        }

        if (!vocabulary.translation?.trim()) {
          errors.push(
            `${vocabLabel} "${vocabulary.tap_text}" is missing its English translation.`
          );
        }

        const tapNormalized =
          normalizeForMatch(
            vocabulary.tap_text
          );

        if (
          !translatedNormalized.includes(
            tapNormalized
          )
        ) {
          errors.push(
            `${label}: vocabulary tap_text "${vocabulary.tap_text}" does not occur in translated_text.`
          );
        }

        if (
          seenTapTexts.has(tapNormalized)
        ) {
          warnings.push(
            `${label}: duplicate vocabulary tap_text "${vocabulary.tap_text}".`
          );
        }

        seenTapTexts.add(tapNormalized);

        if (
          !vocabulary.pronunciation?.trim()
        ) {
          warnings.push(
            `${label}: vocabulary "${vocabulary.tap_text}" has no pronunciation.`
          );
        }
      }
    }
  }

  if (sentenceCount > 0) {
    const numbers = Array.from(
      seenSentenceNumbers
    ).sort((a, b) => a - b);

    for (
      let expected = 1;
      expected <= numbers.length;
      expected += 1
    ) {
      if (
        numbers[expected - 1] !== expected
      ) {
        errors.push(
          `Whole-book sentence numbering is not continuous. Expected sentence ${expected}.`
        );
        break;
      }
    }
  }

  return {
    errors,
    warnings,
    chapterCount: book.chapters.length,
    sentenceCount,
    vocabularyCount,
  };
}

export default function ProcessedBookImporter({
  bookId,
  expectedLearningLanguage,
  existingChapterCount,
  existingSentenceCount,
  onImported,
}: ProcessedBookImporterProps) {
  const [open, setOpen] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [masterBook, setMasterBook] =
    useState<MasterBook | null>(null);
  const [validation, setValidation] =
    useState<ValidationResult | null>(null);
  const [message, setMessage] =
    useState("");
  const [importing, setImporting] =
    useState(false);

  const hasExistingContent =
    existingChapterCount > 0 ||
    existingSentenceCount > 0;

  const canImport = useMemo(() => {
    return (
      masterBook !== null &&
      validation !== null &&
      validation.errors.length === 0 &&
      !hasExistingContent &&
      !importing
    );
  }, [
    masterBook,
    validation,
    hasExistingContent,
    importing,
  ]);

  function clearValidation() {
    setMasterBook(null);
    setValidation(null);
    setMessage("");
  }

  function validateJson() {
    setMessage("");
    setMasterBook(null);
    setValidation(null);

    if (!rawJson.trim()) {
      setMessage(
        "Paste or load a master-book JSON file first."
      );
      return;
    }

    try {
      const parsed =
        JSON.parse(rawJson) as MasterBook;

      const result =
        validateMasterBook(
          parsed,
          expectedLearningLanguage
        );

      setMasterBook(parsed);
      setValidation(result);

      if (result.errors.length === 0) {
        setMessage(
          `Validation passed: ${result.chapterCount} chapters, ${result.sentenceCount} sentences and ${result.vocabularyCount} vocabulary entries.`
        );
      } else {
        setMessage(
          `Validation found ${
            result.errors.length
          } error${
            result.errors.length === 1
              ? ""
              : "s"
          }. Nothing has been imported.`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Invalid JSON.";

      setMessage(
        `JSON could not be parsed: ${errorMessage}`
      );
    }
  }

  async function loadJsonFile(
    file: File | undefined
  ) {
    if (!file) return;

    clearValidation();

    try {
      const text = await file.text();

      setRawJson(text);

      setMessage(
        `${file.name} loaded. Press Validate Master Book before importing.`
      );
    } catch {
      setMessage(
        "The selected JSON file could not be read."
      );
    }
  }

  async function importMasterBook() {
    if (
      !masterBook ||
      !validation ||
      !canImport
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Import the complete processed book?\n\n${validation.chapterCount} chapters\n${validation.sentenceCount} sentences\n${validation.vocabularyCount} vocabulary entries\n\nOriginal English, learner adaptation, translation, pronunciation and contextual vocabulary will all be imported.\n\nThis action is only allowed for an empty book.`
    );

    if (!confirmed) return;

    setImporting(true);

    setMessage(
      "Importing processed book..."
    );

    const createdChapterIds: string[] = [];

    try {
      for (
        let chapterIndex = 0;
        chapterIndex <
        masterBook.chapters.length;
        chapterIndex += 1
      ) {
        const chapter =
          masterBook.chapters[
            chapterIndex
          ];

        setMessage(
          `Importing chapter ${
            chapterIndex + 1
          } of ${
            masterBook.chapters.length
          }: ${chapter.title}`
        );

        const {
          data: createdChapter,
          error: chapterError,
        } = await supabase
          .from("chapters")
          .insert({
            book_id: bookId,
            chapter_number:
              chapter.number,
            title: chapter.title,
            sort_order: chapter.number,
          })
          .select("id")
          .single();

        if (chapterError) {
          throw new Error(
            `Could not create chapter ${chapter.number} "${chapter.title}": ${chapterError.message}`
          );
        }

        if (!createdChapter?.id) {
          throw new Error(
            `No chapter ID was returned for chapter ${chapter.number}.`
          );
        }

        createdChapterIds.push(
          createdChapter.id
        );

        /*
         * Insert each chapter in manageable
         * sentence batches.
         *
         * We select id + position back from
         * Supabase so vocabulary can be linked
         * to the exact newly-created sentence.
         */
        const sentenceBatches =
          chunkArray(
            chapter.sentences,
            200
          );

        for (
          let batchIndex = 0;
          batchIndex <
          sentenceBatches.length;
          batchIndex += 1
        ) {
          const sourceBatch =
            sentenceBatches[
              batchIndex
            ];

          const sentenceRows =
            sourceBatch.map(
              (sentence) => ({
                book_id: bookId,
                chapter_id:
                  createdChapter.id,
                position:
                  sentence.number,
                source_text:
                  sentence.source_text,
                adapted_text:
                  sentence.adapted_text,
                translated_text:
                  sentence.translated_text,
                pronunciation:
                  sentence.pronunciation,
              })
            );

          const {
            data: insertedSentences,
            error: sentenceError,
          } = await supabase
            .from("sentences")
            .insert(sentenceRows)
            .select("id, position");

          if (sentenceError) {
            throw new Error(
              `Could not import sentences for chapter ${chapter.number}: ${sentenceError.message}`
            );
          }

          if (
            !insertedSentences ||
            insertedSentences.length !==
              sourceBatch.length
          ) {
            throw new Error(
              `Supabase did not return all inserted sentences for chapter ${chapter.number}.`
            );
          }

          const sentenceIdByPosition =
            new Map<number, string>();

          for (
            const inserted of
              insertedSentences
          ) {
            sentenceIdByPosition.set(
              inserted.position,
              inserted.id
            );
          }

          const vocabularyRows =
            sourceBatch.flatMap(
              (sentence) => {
                const sentenceId =
                  sentenceIdByPosition.get(
                    sentence.number
                  );

                if (!sentenceId) {
                  throw new Error(
                    `Could not match sentence ${sentence.number} to its new Supabase ID.`
                  );
                }

                return sentence.vocabulary.map(
                  (
                    vocabulary,
                    vocabularyIndex
                  ) => ({
                    sentence_id:
                      sentenceId,

                    /*
                     * word:
                     * dictionary/base form
                     *
                     * tap_text:
                     * exact visible form that
                     * occurs in translated_text
                     */
                    word:
                      vocabulary.word,
                    tap_text:
                      vocabulary.tap_text,
                    translation:
                      vocabulary.translation,
                    pronunciation:
                      vocabulary.pronunciation ??
                      "",
                    sort_order:
                      vocabularyIndex + 1,
                  })
                );
              }
            );

          if (
            vocabularyRows.length > 0
          ) {
            const vocabularyBatches =
              chunkArray(
                vocabularyRows,
                250
              );

            for (
              let vocabularyBatchIndex = 0;
              vocabularyBatchIndex <
              vocabularyBatches.length;
              vocabularyBatchIndex += 1
            ) {
              const {
                error:
                  vocabularyError,
              } = await supabase
                .from(
                  "vocabulary_items"
                )
                .insert(
                  vocabularyBatches[
                    vocabularyBatchIndex
                  ]
                );

              if (vocabularyError) {
                throw new Error(
                  `Could not import vocabulary for chapter ${chapter.number}: ${vocabularyError.message}`
                );
              }
            }
          }
        }
      }

      /*
       * Keep the same final reorder operation
       * used by the existing working full-book
       * importer.
       */
      const { error: reorderError } =
        await supabase.rpc(
          "reorder_book_sentences",
          {
            p_book_id: bookId,
          }
        );

      if (reorderError) {
        throw new Error(
          `Content was imported, but sentence positions could not be reordered: ${reorderError.message}`
        );
      }

      await onImported();

      setRawJson("");
      setMasterBook(null);
      setValidation(null);

      setMessage(
        `Import complete: ${createdChapterIds.length} chapters, ${validation.sentenceCount} sentences and ${validation.vocabularyCount} vocabulary entries were added.`
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

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9]">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">
              Processed Book Import
            </h3>

            <span className="rounded-full bg-neutral-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Master JSON
            </span>
          </div>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Import a completed multilingual
            book containing original text,
            learner adaptation, translation,
            pronunciation and contextual
            vocabulary.
          </p>
        </div>

        <button
          type="button"
          disabled={importing}
          onClick={() => {
            setOpen(
              (value) => !value
            );
          }}
          className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
        >
          {open
            ? "Close Importer"
            : "Import Processed Book"}
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
                Processed Book Import is
                only available for an empty
                book. This prevents an
                existing book from being
                overwritten or duplicated
                accidentally.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  Complete book import
                </p>

                <p className="mt-1 text-sm leading-6 text-blue-800">
                  Nothing is written to
                  Supabase until the complete
                  master file passes
                  validation and you confirm
                  the import.
                </p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Master JSON file
                </label>

                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={importing}
                  onChange={(event) => {
                    void loadJsonFile(
                      event.target
                        .files?.[0]
                    );
                  }}
                  className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                />
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />

                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  or paste JSON
                </span>

                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              <textarea
                value={rawJson}
                disabled={importing}
                rows={14}
                onChange={(event) => {
                  setRawJson(
                    event.target.value
                  );
                  clearValidation();
                }}
                placeholder="Paste the complete master-book JSON here..."
                className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-neutral-400 disabled:opacity-50"
              />

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={
                    importing ||
                    !rawJson.trim()
                  }
                  onClick={
                    validateJson
                  }
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-40"
                >
                  Validate Master Book
                </button>
              </div>

              {message && (
                <div className="mt-5 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700">
                  {message}
                </div>
              )}

              {validation && (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                      <p className="text-2xl font-bold">
                        {
                          validation.chapterCount
                        }
                      </p>
                      <p className="text-xs text-neutral-500">
                        Chapters
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                      <p className="text-2xl font-bold">
                        {validation.sentenceCount.toLocaleString()}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Sentences
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-4">
                      <p className="text-2xl font-bold">
                        {validation.vocabularyCount.toLocaleString()}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Vocabulary entries
                      </p>
                    </div>
                  </div>

                  {validation.errors
                    .length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="font-semibold text-red-800">
                        Validation errors
                      </p>

                      <div className="mt-3 max-h-72 overflow-y-auto">
                        <ul className="space-y-1 text-sm text-red-700">
                          {validation.errors.map(
                            (
                              error,
                              index
                            ) => (
                              <li
                                key={`${error}-${index}`}
                              >
                                • {error}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {validation.warnings
                    .length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-semibold text-amber-900">
                        Warnings
                      </p>

                      <div className="mt-3 max-h-72 overflow-y-auto">
                        <ul className="space-y-1 text-sm text-amber-800">
                          {validation.warnings.map(
                            (
                              warning,
                              index
                            ) => (
                              <li
                                key={`${warning}-${index}`}
                              >
                                •{" "}
                                {
                                  warning
                                }
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {validation.errors
                    .length === 0 && (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold text-green-800">
                        Ready to import
                      </p>

                      <p className="mt-1 text-sm text-green-700">
                        The master book
                        passed structural
                        validation,
                        including exact
                        contextual
                        vocabulary tap-text
                        matching.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end border-t border-neutral-200 pt-5">
                    <button
                      type="button"
                      disabled={
                        !canImport
                      }
                      onClick={() => {
                        void importMasterBook();
                      }}
                      className="rounded-xl bg-[#181818] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
                    >
                      {importing
                        ? "Importing..."
                        : "Import Complete Book"}
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