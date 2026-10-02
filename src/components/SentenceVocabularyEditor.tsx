"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type VocabularyItem = {
  id: string;
  sentence_id: string;
  word: string;
  tap_text: string | null;
  translation: string;
  pronunciation: string | null;
  sort_order: number;
};

type Props = {
  sentenceId: string;
  learningLanguage: string;
};

export default function SentenceVocabularyEditor({
  sentenceId,
  learningLanguage,
}: Props) {
  const normalizedLearningLanguage =
    learningLanguage.trim().toLowerCase();

  const learningLanguageName =
    normalizedLearningLanguage === "es" ||
    normalizedLearningLanguage === "spanish"
      ? "Spanish"
      : normalizedLearningLanguage === "fr" ||
          normalizedLearningLanguage === "french"
        ? "French"
        : normalizedLearningLanguage === "de" ||
            normalizedLearningLanguage === "german"
          ? "German"
          : normalizedLearningLanguage === "it" ||
              normalizedLearningLanguage === "italian"
            ? "Italian"
            : "Russian";

  const learningWordPlaceholder =
    learningLanguageName === "Spanish"
      ? "descansar"
      : learningLanguageName === "French"
        ? "aller"
        : learningLanguageName === "German"
          ? "gehen"
          : learningLanguageName === "Italian"
            ? "andare"
            : "отдыхать";

  const tapTextPlaceholder =
    learningLanguageName === "Spanish"
      ? "descansan"
      : learningLanguageName === "French"
        ? "va"
        : learningLanguageName === "German"
          ? "geht"
          : learningLanguageName === "Italian"
            ? "va"
            : "отдыхают";

  const pronunciationPlaceholder =
    learningLanguageName === "Spanish"
      ? "des-kan-SAR"
      : learningLanguageName === "French"
        ? "ah-LAY"
        : learningLanguageName === "German"
          ? "GAY-en"
          : learningLanguageName === "Italian"
            ? "an-DAH-reh"
            : "at-dih-KHAT";

  const [items, setItems] =
    useState<VocabularyItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [open, setOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [newWord, setNewWord] =
    useState("");

  const [newTapText, setNewTapText] =
    useState("");

  const [newTranslation, setNewTranslation] =
    useState("");

  const [newPronunciation, setNewPronunciation] =
    useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editWord, setEditWord] =
    useState("");

  const [editTapText, setEditTapText] =
    useState("");

  const [editTranslation, setEditTranslation] =
    useState("");

  const [editPronunciation, setEditPronunciation] =
    useState("");

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [bulkOpen, setBulkOpen] =
    useState(false);

  const [bulkText, setBulkText] =
    useState("");

  const [bulkSaving, setBulkSaving] =
    useState(false);

  useEffect(() => {
    loadVocabulary();
  }, [sentenceId]);

  async function loadVocabulary() {
    setLoading(true);

    const { data, error } = await supabase
      .from("vocabulary_items")
      .select(
        "id, sentence_id, word, tap_text, translation, pronunciation, sort_order"
      )
      .eq("sentence_id", sentenceId)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      setMessage(
        `Could not load vocabulary: ${error.message}`
      );

      setLoading(false);
      return;
    }

    setItems(
      (data ?? []) as VocabularyItem[]
    );

    setLoading(false);
  }

  function startAdd() {
    setMessage("");
    setBulkOpen(false);
    setBulkText("");

    setAdding(true);

    setNewWord("");
    setNewTapText("");
    setNewTranslation("");
    setNewPronunciation("");
  }

  function cancelAdd() {
    setAdding(false);

    setNewWord("");
    setNewTapText("");
    setNewTranslation("");
    setNewPronunciation("");
  }

  async function addVocabularyItem() {
    if (saving) return;

    const word =
      newWord.trim();

    const tapText =
      newTapText.trim();

    const translation =
      newTranslation.trim();

    const pronunciation =
      newPronunciation.trim();

    if (!word || !translation) {
      setMessage(
        `${learningLanguageName} word and English translation are required.`
      );

      return;
    }

    setSaving(true);
    setMessage("");

    const nextSortOrder =
      items.length === 0
        ? 1
        : Math.max(
            ...items.map(
              (item) =>
                item.sort_order
            )
          ) + 1;

    const { error } = await supabase
      .from("vocabulary_items")
      .insert({
        sentence_id: sentenceId,
        word,
        tap_text:
          tapText || word,
        translation,
        pronunciation,
        sort_order:
          nextSortOrder,
      });

    if (error) {
      setMessage(
        `Could not add vocabulary: ${error.message}`
      );

      setSaving(false);
      return;
    }

    await loadVocabulary();

    setAdding(false);

    setNewWord("");
    setNewTapText("");
    setNewTranslation("");
    setNewPronunciation("");

    setMessage(
      "Vocabulary added."
    );

    setSaving(false);
  }

  function startEdit(
    item: VocabularyItem
  ) {
    setMessage("");
    setBulkOpen(false);
    setBulkText("");

    setEditingId(item.id);

    setEditWord(
      item.word
    );

    setEditTapText(
      item.tap_text ??
        item.word
    );

    setEditTranslation(
      item.translation
    );

    setEditPronunciation(
      item.pronunciation ?? ""
    );
  }

  function cancelEdit() {
    setEditingId(null);

    setEditWord("");
    setEditTapText("");
    setEditTranslation("");
    setEditPronunciation("");
  }

  async function saveVocabularyItem(
    item: VocabularyItem
  ) {
    if (saving) return;

    const word =
      editWord.trim();

    const tapText =
      editTapText.trim();

    const translation =
      editTranslation.trim();

    const pronunciation =
      editPronunciation.trim();

    if (!word || !translation) {
      setMessage(
        `${learningLanguageName} word and English translation are required.`
      );

      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("vocabulary_items")
      .update({
        word,
        tap_text:
          tapText || word,
        translation,
        pronunciation,
      })
      .eq(
        "id",
        item.id
      );

    if (error) {
      setMessage(
        `Could not save vocabulary: ${error.message}`
      );

      setSaving(false);
      return;
    }

    await loadVocabulary();

    setEditingId(null);

    setEditWord("");
    setEditTapText("");
    setEditTranslation("");
    setEditPronunciation("");

    setMessage(
      "Vocabulary saved."
    );

    setSaving(false);
  }

  async function deleteVocabularyItem(
    item: VocabularyItem
  ) {
    if (deletingId) return;

    const confirmed =
      window.confirm(
        `Delete "${item.word}" from this sentence's vocabulary?`
      );

    if (!confirmed) return;

    setDeletingId(
      item.id
    );

    setMessage("");

    const { error } = await supabase
      .from("vocabulary_items")
      .delete()
      .eq(
        "id",
        item.id
      );

    if (error) {
      setMessage(
        `Could not delete vocabulary: ${error.message}`
      );

      setDeletingId(null);
      return;
    }

    setItems(
      (current) =>
        current.filter(
          (existing) =>
            existing.id !==
            item.id
        )
    );

    setMessage(
      "Vocabulary deleted."
    );

    setDeletingId(null);
  }

  function openBulkImport() {
    setMessage("");

    setAdding(false);

    setNewWord("");
    setNewTapText("");
    setNewTranslation("");
    setNewPronunciation("");

    setBulkText("");
    setBulkOpen(true);
  }

  function cancelBulkImport() {
    setBulkOpen(false);
    setBulkText("");
  }

  async function importBulkVocabulary() {
    if (bulkSaving) return;

    const lines =
      bulkText
        .split("\n")
        .map(
          (line) =>
            line.trim()
        )
        .filter(Boolean);

    if (lines.length === 0) {
      setMessage(
        "Paste at least one vocabulary item."
      );

      return;
    }

    const parsedItems: {
      word: string;
      tapText: string;
      translation: string;
      pronunciation: string;
    }[] = [];

    for (
      let index = 0;
      index < lines.length;
      index += 1
    ) {
      const parts =
        lines[index]
          .split("|")
          .map(
            (part) =>
              part.trim()
          );

      if (parts.length < 3) {
        setMessage(
          `Line ${
            index + 1
          } is invalid. Use: ${learningLanguageName} base word | Text in sentence | English | Pronunciation`
        );

        return;
      }

      const word =
        parts[0];

      const tapText =
        parts[1];

      const translation =
        parts[2];

      const pronunciation =
        parts
          .slice(3)
          .join("|")
          .trim();

      if (
        !word ||
        !tapText ||
        !translation
      ) {
        setMessage(
          `Line ${
            index + 1
          } needs a ${learningLanguageName} base word, text in sentence, and English translation.`
        );

        return;
      }

      parsedItems.push({
        word,
        tapText,
        translation,
        pronunciation,
      });
    }

    setBulkSaving(true);
    setMessage("");

    const nextSortOrder =
      items.length === 0
        ? 1
        : Math.max(
            ...items.map(
              (item) =>
                item.sort_order
            )
          ) + 1;

    const rows =
      parsedItems.map(
        (
          item,
          index
        ) => ({
          sentence_id:
            sentenceId,
          word:
            item.word,
          tap_text:
            item.tapText,
          translation:
            item.translation,
          pronunciation:
            item.pronunciation,
          sort_order:
            nextSortOrder +
            index,
        })
      );

    const { error } =
      await supabase
        .from(
          "vocabulary_items"
        )
        .insert(rows);

    if (error) {
      setMessage(
        `Could not import vocabulary: ${error.message}`
      );

      setBulkSaving(false);
      return;
    }

    await loadVocabulary();

    setBulkOpen(false);
    setBulkText("");

    setMessage(
      `${
        parsedItems.length
      } ${
        parsedItems.length === 1
          ? "word"
          : "words"
      } imported successfully.`
    );

    setBulkSaving(false);
  }

  if (loading) {
    return (
      <div className="mt-5 border-t border-neutral-200 pt-4">
        <p className="text-xs text-neutral-400">
          Loading vocabulary...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-neutral-200 pt-4">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Vocabulary
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {items.length}{" "}
            {items.length === 1
              ? "word"
              : "words"}
          </p>
        </div>

        <span className="text-sm font-semibold text-neutral-500">
          {open
            ? "Hide"
            : "Manage"}
        </span>
      </button>

      {open && (
        <div className="mt-4">
          {message && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-xs font-medium ${
                message.startsWith(
                  "Could not"
                ) ||
                message.includes(
                  "required"
                ) ||
                message.includes(
                  "invalid"
                ) ||
                message.includes(
                  "needs"
                ) ||
                message.startsWith(
                  "Paste"
                )
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          {items.length === 0 &&
            !adding &&
            !bulkOpen && (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-center">
                <p className="text-xs text-neutral-400">
                  No vocabulary attached
                  to this sentence.
                </p>
              </div>
            )}

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map(
                (item) => {
                  const isEditing =
                    editingId ===
                    item.id;

                  const isDeleting =
                    deletingId ===
                    item.id;

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="rounded-xl border border-neutral-200 bg-white p-4"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <VocabularyField
                            label={`${learningLanguageName} base word / vocabulary entry`}
                            value={
                              editWord
                            }
                            onChange={
                              setEditWord
                            }
                            placeholder={
                              learningWordPlaceholder
                            }
                          />

                          <VocabularyField
                            label="Text in sentence (tap text)"
                            value={
                              editTapText
                            }
                            onChange={
                              setEditTapText
                            }
                            placeholder={
                              tapTextPlaceholder
                            }
                          />

                          <p className="-mt-1 text-[11px] leading-5 text-neutral-400">
                            Enter the
                            exact word
                            or phrase as
                            it appears in
                            this sentence.
                          </p>

                          <VocabularyField
                            label="English translation"
                            value={
                              editTranslation
                            }
                            onChange={
                              setEditTranslation
                            }
                            placeholder="to be on holiday"
                          />

                          <VocabularyField
                            label="Pronunciation"
                            value={
                              editPronunciation
                            }
                            onChange={
                              setEditPronunciation
                            }
                            placeholder={
                              pronunciationPlaceholder
                            }
                          />

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={
                                cancelEdit
                              }
                              disabled={
                                saving
                              }
                              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                saveVocabularyItem(
                                  item
                                )
                              }
                              disabled={
                                saving
                              }
                              className="rounded-lg bg-[#181818] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                            >
                              {saving
                                ? "Saving..."
                                : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold">
                                {
                                  item.word
                                }
                              </span>

                              <span className="text-sm text-neutral-500">
                                {
                                  item.translation
                                }
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-neutral-500">
                              Tap text:{" "}
                              <span className="font-medium text-neutral-700">
                                {item.tap_text ||
                                  item.word}
                              </span>
                            </p>

                            {item.pronunciation && (
                              <p className="mt-1 text-xs text-neutral-400">
                                {
                                  item.pronunciation
                                }
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  item
                                )
                              }
                              disabled={
                                editingId !==
                                  null ||
                                adding ||
                                bulkOpen ||
                                deletingId !==
                                  null
                              }
                              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteVocabularyItem(
                                  item
                                )
                              }
                              disabled={
                                editingId !==
                                  null ||
                                adding ||
                                bulkOpen ||
                                deletingId !==
                                  null
                              }
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                            >
                              {isDeleting
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          {adding ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold">
                Add vocabulary
              </p>

              <div className="mt-4 space-y-3">
                <VocabularyField
                  label={`${learningLanguageName} base word / vocabulary entry`}
                  value={newWord}
                  onChange={
                    setNewWord
                  }
                  placeholder={
                    learningWordPlaceholder
                  }
                />

                <VocabularyField
                  label="Text in sentence (tap text)"
                  value={
                    newTapText
                  }
                  onChange={
                    setNewTapText
                  }
                  placeholder={
                    tapTextPlaceholder
                  }
                />

                <p className="-mt-1 text-[11px] leading-5 text-neutral-400">
                  Enter the exact
                  word or phrase as
                  it appears in this
                  sentence. If left
                  blank, the base
                  word is used.
                </p>

                <VocabularyField
                  label="English translation"
                  value={
                    newTranslation
                  }
                  onChange={
                    setNewTranslation
                  }
                  placeholder="to be on holiday"
                />

                <VocabularyField
                  label="Pronunciation"
                  value={
                    newPronunciation
                  }
                  onChange={
                    setNewPronunciation
                  }
                  placeholder={
                    pronunciationPlaceholder
                  }
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={
                    cancelAdd
                  }
                  disabled={
                    saving
                  }
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    addVocabularyItem
                  }
                  disabled={
                    saving
                  }
                  className="rounded-lg bg-[#181818] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {saving
                    ? "Adding..."
                    : "Add Word"}
                </button>
              </div>
            </div>
          ) : bulkOpen ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    Bulk import
                    vocabulary
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    One vocabulary
                    item per line.
                  </p>
                </div>

                <span className="rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-500">
                  Base word | Tap
                  text | English |
                  Pronunciation
                </span>
              </div>

              <textarea
                value={bulkText}
                onChange={(
                  event
                ) =>
                  setBulkText(
                    event.target
                      .value
                  )
                }
                rows={8}
                placeholder={`отдыхать | отдыхают | to be on holiday | at-dih-KHAT
бутерброд | бутерброды | sandwich | boot-ehr-BROT`}
                className="mt-4 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-3 font-mono text-sm leading-6 outline-none transition focus:border-neutral-400"
              />

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-xs text-neutral-400">
                  {
                    bulkText
                      .split(
                        "\n"
                      )
                      .map(
                        (
                          line
                        ) =>
                          line.trim()
                      )
                      .filter(
                        Boolean
                      ).length
                  }{" "}
                  lines ready
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      cancelBulkImport
                    }
                    disabled={
                      bulkSaving
                    }
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      importBulkVocabulary
                    }
                    disabled={
                      bulkSaving ||
                      !bulkText.trim()
                    }
                    className="rounded-lg bg-[#181818] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {bulkSaving
                      ? "Importing..."
                      : "Import Words"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={
                  startAdd
                }
                disabled={
                  editingId !==
                    null ||
                  deletingId !==
                    null ||
                  bulkSaving
                }
                className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40"
              >
                + Add Vocabulary
              </button>

              <button
                type="button"
                onClick={
                  openBulkImport
                }
                disabled={
                  editingId !==
                    null ||
                  deletingId !==
                    null ||
                  saving
                }
                className="rounded-xl border border-neutral-300 px-4 py-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40"
              >
                Bulk Import
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VocabularyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </label>

      <input
        type="text"
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-neutral-400"
      />
    </div>
  );
}