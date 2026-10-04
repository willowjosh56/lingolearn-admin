"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Chapter = {
  id: string;
  chapter_number: number;
  title: string;
};

type Sentence = {
  id: string;
  chapter_id: string | null;
  position: number;
  source_text: string;
  adapted_text: string | null;
  translated_text: string;
  pronunciation: string | null;
};

type ChapterAdaptationImporterProps = {
  chapters: Chapter[];
  sentences: Sentence[];
  learningLanguageLabel: string;
  onImported: () => Promise<void> | void;
};

type ParsedRow = {
  sentenceNumber: number;
  adaptedText: string;
  translatedText: string;
  pronunciation: string;
};

const DEFAULT_BATCH_SIZE = 25;

export default function ChapterAdaptationImporter({
  chapters,
  sentences,
  learningLanguageLabel,
  onImported,
}: ChapterAdaptationImporterProps) {
  const [chapterId, setChapterId] = useState("");
  const [batchStart, setBatchStart] = useState(1);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const chapterSentences = useMemo(() => {
    if (!chapterId) {
      return [];
    }

    return sentences
      .filter((sentence) => sentence.chapter_id === chapterId)
      .sort((a, b) => a.position - b.position);
  }, [chapterId, sentences]);

  const safeBatchStart = Math.max(1, batchStart);
  const safeBatchSize = Math.max(1, Math.min(100, batchSize));

  const batchSentences = useMemo(() => {
    const startIndex = safeBatchStart - 1;

    return chapterSentences.slice(
      startIndex,
      startIndex + safeBatchSize
    );
  }, [chapterSentences, safeBatchStart, safeBatchSize]);

  const selectedChapter = chapters.find(
    (chapter) => chapter.id === chapterId
  );

  const completedCount = chapterSentences.filter(
    (sentence) =>
      sentence.adapted_text?.trim() &&
      sentence.translated_text?.trim() &&
      sentence.pronunciation?.trim()
  ).length;

  function selectChapter(nextChapterId: string) {
    setChapterId(nextChapterId);
    setBatchStart(1);
    setImportText("");
    setMessage("");
  }

  function buildExportText() {
    if (!selectedChapter) {
      return "";
    }

    if (batchSentences.length === 0) {
      return "";
    }

    const lines = batchSentences.map((sentence, index) => {
      const sentenceNumber =
        safeBatchStart + index;

      return `${sentenceNumber} | ${sentence.source_text}`;
    });

    return [
      `BOOK: The Adventures of Sherlock Holmes`,
      `CHAPTER ${selectedChapter.chapter_number}: ${selectedChapter.title}`,
      `LEVEL: B2`,
      `TARGET LANGUAGE: ${learningLanguageLabel}`,
      "",
      "INSTRUCTIONS:",
      "For every numbered sentence below:",
      "1. Preserve the meaning, facts, characters, clues, tone, and continuity.",
      "2. Rewrite archaic or unnecessarily difficult English into natural B2-level English.",
      "3. Do not make the writing childish.",
      "4. Preserve dialogue and the speaker's intent.",
      "5. Do not invent information.",
      "6. Translate the adapted English naturally into the target language.",
      "7. Provide a Latin-letter pronunciation/transliteration of the target-language sentence.",
      "8. Return exactly one output row for every input sentence.",
      "9. Keep the original sentence number unchanged.",
      "10. Do not use the | character inside any field.",
      "",
      "RETURN ONLY THIS FORMAT:",
      "Sentence # | Adapted English | Translation | Pronunciation",
      "",
      ...lines,
    ].join("\n");
  }

  async function copyExport() {
    setMessage("");

    if (!chapterId) {
      setMessage("Choose a chapter first.");
      return;
    }

    if (batchSentences.length === 0) {
      setMessage(
        "There are no sentences in this batch."
      );
      return;
    }

    const exportText = buildExportText();

    try {
      await navigator.clipboard.writeText(exportText);
      setMessage(
        `${batchSentences.length} original sentences copied. Paste them into ChatGPT.`
      );
    } catch {
      setMessage(
        "Could not copy automatically. Use the export box below and copy it manually."
      );
    }
  }

  function parseImport(): ParsedRow[] | null {
    const cleanText = importText.trim();

    if (!cleanText) {
      setMessage(
        "Paste the completed ChatGPT adaptation first."
      );
      return null;
    }

    const lines = cleanText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !line.toLowerCase().startsWith("sentence #")
      );

    if (lines.length === 0) {
      setMessage(
        "No adaptation rows were found."
      );
      return null;
    }

    const parsedRows: ParsedRow[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      const parts = line
        .split("|")
        .map((part) => part.trim());

      if (parts.length !== 4) {
        setMessage(
          `Import line ${
            index + 1
          } is invalid. Each row must contain exactly: Sentence # | Adapted English | ${learningLanguageLabel} | Pronunciation`
        );
        return null;
      }

      const sentenceNumber = Number(parts[0]);
      const adaptedText = parts[1];
      const translatedText = parts[2];
      const pronunciation = parts[3];

      if (
        !Number.isInteger(sentenceNumber) ||
        sentenceNumber < 1
      ) {
        setMessage(
          `Import line ${
            index + 1
          } has an invalid sentence number.`
        );
        return null;
      }

      if (
        !adaptedText ||
        !translatedText ||
        !pronunciation
      ) {
        setMessage(
          `Import line ${
            index + 1
          } is missing adapted English, ${learningLanguageLabel}, or pronunciation.`
        );
        return null;
      }

      parsedRows.push({
        sentenceNumber,
        adaptedText,
        translatedText,
        pronunciation,
      });
    }

    const expectedNumbers = batchSentences.map(
      (_, index) => safeBatchStart + index
    );

    const receivedNumbers = parsedRows.map(
      (row) => row.sentenceNumber
    );

    const duplicateNumbers = receivedNumbers.filter(
      (number, index) =>
        receivedNumbers.indexOf(number) !== index
    );

    if (duplicateNumbers.length > 0) {
      setMessage(
        `Duplicate sentence number found: ${duplicateNumbers[0]}. Nothing was saved.`
      );
      return null;
    }

    if (parsedRows.length !== expectedNumbers.length) {
      setMessage(
        `Expected ${expectedNumbers.length} rows, but received ${parsedRows.length}. Nothing was saved.`
      );
      return null;
    }

    for (const expectedNumber of expectedNumbers) {
      if (!receivedNumbers.includes(expectedNumber)) {
        setMessage(
          `Sentence ${expectedNumber} is missing. Nothing was saved.`
        );
        return null;
      }
    }

    for (const receivedNumber of receivedNumbers) {
      if (!expectedNumbers.includes(receivedNumber)) {
        setMessage(
          `Sentence ${receivedNumber} does not belong to the current batch. Nothing was saved.`
        );
        return null;
      }
    }

    return parsedRows.sort(
      (a, b) =>
        a.sentenceNumber - b.sentenceNumber
    );
  }

  async function saveImport() {
    if (saving) {
      return;
    }

    if (!chapterId) {
      setMessage("Choose a chapter first.");
      return;
    }

    if (batchSentences.length === 0) {
      setMessage(
        "There are no sentences in this batch."
      );
      return;
    }

    const parsedRows = parseImport();

    if (!parsedRows) {
      return;
    }

    const confirmed = window.confirm(
      `Save adapted English, ${learningLanguageLabel}, and pronunciation for ${parsedRows.length} sentences?\n\nThe original English source_text will NOT be changed.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      for (const row of parsedRows) {
        const batchIndex =
          row.sentenceNumber - safeBatchStart;

        const targetSentence =
          batchSentences[batchIndex];

        if (!targetSentence) {
          throw new Error(
            `Could not match sentence ${row.sentenceNumber}.`
          );
        }

        const { error } = await supabase
          .from("sentences")
          .update({
            adapted_text: row.adaptedText,
            translated_text: row.translatedText,
            pronunciation: row.pronunciation,
          })
          .eq("id", targetSentence.id);

        if (error) {
          throw new Error(
            `Sentence ${row.sentenceNumber}: ${error.message}`
          );
        }
      }

      await onImported();

      setImportText("");

      setMessage(
        `${parsedRows.length} sentences saved successfully. Original English was preserved.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Could not save adaptation: ${error.message}`
          : "Could not save adaptation."
      );
    } finally {
      setSaving(false);
    }
  }

  function previousBatch() {
    setMessage("");
    setImportText("");

    setBatchStart((current) =>
      Math.max(1, current - safeBatchSize)
    );
  }

  function nextBatch() {
    setMessage("");
    setImportText("");

    setBatchStart(
      (current) => current + safeBatchSize
    );
  }

  const exportText = buildExportText();

  const batchEnd =
    batchSentences.length === 0
      ? 0
      : safeBatchStart +
        batchSentences.length -
        1;

  const hasPreviousBatch = safeBatchStart > 1;

  const hasNextBatch =
    batchEnd < chapterSentences.length;

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Learner adaptation
        </p>

        <h3 className="mt-1 text-lg font-semibold text-neutral-900">
          Chapter Adaptation Importer
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Export original English in manageable batches,
          process it in ChatGPT, then import B2 English,
          {` ${learningLanguageLabel}, `}and pronunciation.
          The original public-domain text is never
          overwritten.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-neutral-700">
            Chapter
          </span>

          <select
            value={chapterId}
            onChange={(event) =>
              selectChapter(event.target.value)
            }
            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">
              Choose a chapter
            </option>

            {chapters.map((chapter) => (
              <option
                key={chapter.id}
                value={chapter.id}
              >
                Chapter {chapter.chapter_number}:{" "}
                {chapter.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-neutral-700">
            Batch size
          </span>

          <input
            type="number"
            min={1}
            max={100}
            value={batchSize}
            onChange={(event) => {
              const value = Number(
                event.target.value
              );

              setBatchSize(
                Number.isFinite(value)
                  ? value
                  : DEFAULT_BATCH_SIZE
              );

              setBatchStart(1);
              setImportText("");
              setMessage("");
            }}
            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm"
          />
        </label>
      </div>

      {chapterId && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-white px-3 py-1.5 font-medium text-neutral-700 shadow-sm">
              {chapterSentences.length} sentences
            </span>

            <span className="rounded-full bg-white px-3 py-1.5 font-medium text-neutral-700 shadow-sm">
              {completedCount} fully adapted
            </span>

            {batchSentences.length > 0 && (
              <span className="rounded-full bg-white px-3 py-1.5 font-medium text-neutral-700 shadow-sm">
                Current batch: {safeBatchStart}–
                {batchEnd}
              </span>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-neutral-900">
                  1. Export originals
                </h4>

                <p className="mt-1 text-sm text-neutral-500">
                  Copy this batch and paste it into
                  ChatGPT.
                </p>
              </div>

              <button
                type="button"
                onClick={copyExport}
                disabled={
                  batchSentences.length === 0
                }
                className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
              >
                Copy Batch for ChatGPT
              </button>
            </div>

            <textarea
              readOnly
              value={exportText}
              rows={12}
              className="mt-3 w-full rounded-2xl border border-neutral-200 bg-white p-4 font-mono text-xs leading-5 text-neutral-700"
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3 border-y border-amber-200 py-4">
            <button
              type="button"
              onClick={previousBatch}
              disabled={!hasPreviousBatch}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Previous Batch
            </button>

            <button
              type="button"
              onClick={nextBatch}
              disabled={!hasNextBatch}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next Batch
            </button>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold text-neutral-900">
              2. Import completed adaptation
            </h4>

            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Paste ChatGPT&apos;s rows here. Every
              sentence in the current batch must be
              present before anything is saved.
            </p>

            <p className="mt-2 rounded-xl bg-white px-4 py-3 font-mono text-xs text-neutral-600">
              Sentence # | Adapted English |{" "}
              {learningLanguageLabel} | Pronunciation
            </p>

            <textarea
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setMessage("");
              }}
              rows={12}
              placeholder={`1 | Adapted English | ${learningLanguageLabel} translation | Latin pronunciation`}
              className="mt-3 w-full rounded-2xl border border-neutral-200 bg-white p-4 font-mono text-xs leading-5 text-neutral-700"
            />

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveImport}
                disabled={
                  saving ||
                  batchSentences.length === 0 ||
                  !importText.trim()
                }
                className="rounded-xl bg-[#181818] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
              >
                {saving
                  ? "Saving..."
                  : "Validate & Save Batch"}
              </button>
            </div>
          </div>
        </>
      )}

      {message && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {message}
        </p>
      )}
    </section>
  );
}