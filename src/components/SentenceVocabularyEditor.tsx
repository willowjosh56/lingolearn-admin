"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type VocabularyItem = {
  id: string;
  sentence_id: string;
  word: string;
  translation: string;
  pronunciation: string | null;
  sort_order: number;
};

type Props = {
  sentenceId: string;
};

export default function SentenceVocabularyEditor({
  sentenceId,
}: Props) {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newPronunciation, setNewPronunciation] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [editPronunciation, setEditPronunciation] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadVocabulary();
  }, [sentenceId]);

  async function loadVocabulary() {
    setLoading(true);

    const { data, error } = await supabase
      .from("vocabulary_items")
      .select(
        "id, sentence_id, word, translation, pronunciation, sort_order"
      )
      .eq("sentence_id", sentenceId)
      .order("sort_order", { ascending: true });

    if (error) {
      setMessage(`Could not load vocabulary: ${error.message}`);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as VocabularyItem[]);
    setLoading(false);
  }

  function startAdd() {
    setMessage("");
    setAdding(true);

    setNewWord("");
    setNewTranslation("");
    setNewPronunciation("");
  }

  function cancelAdd() {
    setAdding(false);

    setNewWord("");
    setNewTranslation("");
    setNewPronunciation("");
  }

  async function addVocabularyItem() {
    if (saving) return;

    const word = newWord.trim();
    const translation = newTranslation.trim();
    const pronunciation = newPronunciation.trim();

    if (!word || !translation) {
      setMessage("Russian word and English translation are required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const nextSortOrder =
      items.length === 0
        ? 1
        : Math.max(...items.map((item) => item.sort_order)) + 1;

    const { error } = await supabase
      .from("vocabulary_items")
      .insert({
        sentence_id: sentenceId,
        word,
        translation,
        pronunciation,
        sort_order: nextSortOrder,
      });

    if (error) {
      setMessage(`Could not add vocabulary: ${error.message}`);
      setSaving(false);
      return;
    }

    await loadVocabulary();

    setAdding(false);
    setNewWord("");
    setNewTranslation("");
    setNewPronunciation("");

    setMessage("Vocabulary added.");
    setSaving(false);
  }

  function startEdit(item: VocabularyItem) {
    setMessage("");

    setEditingId(item.id);
    setEditWord(item.word);
    setEditTranslation(item.translation);
    setEditPronunciation(item.pronunciation ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditWord("");
    setEditTranslation("");
    setEditPronunciation("");
  }

  async function saveVocabularyItem(item: VocabularyItem) {
    if (saving) return;

    const word = editWord.trim();
    const translation = editTranslation.trim();
    const pronunciation = editPronunciation.trim();

    if (!word || !translation) {
      setMessage("Russian word and English translation are required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("vocabulary_items")
      .update({
        word,
        translation,
        pronunciation,
      })
      .eq("id", item.id);

    if (error) {
      setMessage(`Could not save vocabulary: ${error.message}`);
      setSaving(false);
      return;
    }

    await loadVocabulary();

    setEditingId(null);
    setEditWord("");
    setEditTranslation("");
    setEditPronunciation("");

    setMessage("Vocabulary saved.");
    setSaving(false);
  }

  async function deleteVocabularyItem(item: VocabularyItem) {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Delete "${item.word}" from this sentence's vocabulary?`
    );

    if (!confirmed) return;

    setDeletingId(item.id);
    setMessage("");

    const { error } = await supabase
      .from("vocabulary_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(`Could not delete vocabulary: ${error.message}`);
      setDeletingId(null);
      return;
    }

    setItems((current) =>
      current.filter((existing) => existing.id !== item.id)
    );

    setMessage("Vocabulary deleted.");
    setDeletingId(null);
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
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Vocabulary
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {items.length} {items.length === 1 ? "word" : "words"}
          </p>
        </div>

        <span className="text-sm font-semibold text-neutral-500">
          {open ? "Hide" : "Manage"}
        </span>
      </button>

      {open && (
        <div className="mt-4">
          {message && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-xs font-medium ${
                message.startsWith("Could not") ||
                message.includes("required")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          {items.length === 0 && !adding && (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-center">
              <p className="text-xs text-neutral-400">
                No vocabulary attached to this sentence.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <VocabularyField
                          label="Russian word"
                          value={editWord}
                          onChange={setEditWord}
                          placeholder="кот"
                        />

                        <VocabularyField
                          label="English translation"
                          value={editTranslation}
                          onChange={setEditTranslation}
                          placeholder="cat"
                        />

                        <VocabularyField
                          label="Pronunciation"
                          value={editPronunciation}
                          onChange={setEditPronunciation}
                          placeholder="kot"
                        />

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() => saveVocabularyItem(item)}
                            disabled={saving}
                            className="rounded-lg bg-[#181818] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold">
                              {item.word}
                            </span>

                            <span className="text-sm text-neutral-500">
                              {item.translation}
                            </span>
                          </div>

                          {item.pronunciation && (
                            <p className="mt-1 text-xs text-neutral-400">
                              {item.pronunciation}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            disabled={
                              editingId !== null ||
                              adding ||
                              deletingId !== null
                            }
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteVocabularyItem(item)}
                            disabled={
                              editingId !== null ||
                              adding ||
                              deletingId !== null
                            }
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {adding ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold">
                Add vocabulary
              </p>

              <div className="mt-4 space-y-3">
                <VocabularyField
                  label="Russian word"
                  value={newWord}
                  onChange={setNewWord}
                  placeholder="кот"
                />

                <VocabularyField
                  label="English translation"
                  value={newTranslation}
                  onChange={setNewTranslation}
                  placeholder="cat"
                />

                <VocabularyField
                  label="Pronunciation"
                  value={newPronunciation}
                  onChange={setNewPronunciation}
                  placeholder="kot"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelAdd}
                  disabled={saving}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={addVocabularyItem}
                  disabled={saving}
                  className="rounded-lg bg-[#181818] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Word"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAdd}
              disabled={editingId !== null || deletingId !== null}
              className="mt-3 w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40"
            >
              + Add Vocabulary
            </button>
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
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-neutral-400"
      />
    </div>
  );
}