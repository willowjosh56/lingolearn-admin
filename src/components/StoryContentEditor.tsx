"use client";



import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import SentenceVocabularyEditor from "@/components/SentenceVocabularyEditor";

import FullBookImporter from "@/components/FullBookImporter";

type Chapter = {

  id: string;

  book_id: string;

  chapter_number: number;

  title: string;

  sort_order: number;

};



type Sentence = {

  id: string;

  book_id: string;

  chapter_id: string | null;

  position: number;

  source_text: string;

  translated_text: string;

  pronunciation: string | null;

};



type StoryContentEditorProps = {

  bookId: string;

};



export default function StoryContentEditor({

  bookId,

}: StoryContentEditorProps) {

  const [learningLanguage, setLearningLanguage] = useState("ru");

  const learningLanguageLabel =
  learningLanguage === "es"
    ? "Spanish"
    : learningLanguage === "fr"
      ? "French"
      : learningLanguage === "de"
        ? "German"
        : learningLanguage === "ru"
          ? "Russian"
          : learningLanguage.toUpperCase();

  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [sentences, setSentences] = useState<Sentence[]>([]);



  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");



  // --------------------------------------------------

  // SENTENCE EDITING

  // --------------------------------------------------



  const [editingSentenceId, setEditingSentenceId] =

    useState<string | null>(null);



  const [editEnglish, setEditEnglish] = useState("");

  const [editTranslation, setEditTranslation] = useState("");

  const [editPronunciation, setEditPronunciation] =

    useState("");



  const [savingSentence, setSavingSentence] =

    useState(false);



  const [deletingSentenceId, setDeletingSentenceId] =

    useState<string | null>(null);



  // --------------------------------------------------

  // ADD SENTENCE

  // --------------------------------------------------



  const [addingSentence, setAddingSentence] =

    useState(false);



  const [addSentenceChapterId, setAddSentenceChapterId] =

    useState<string | null>(null);



  const [newEnglish, setNewEnglish] = useState("");

  const [newTranslation, setNewTranslation] = useState("");

  const [newPronunciation, setNewPronunciation] =

    useState("");



  const [creatingSentence, setCreatingSentence] =

    useState(false);



  // --------------------------------------------------

  // BULK SENTENCE IMPORT

  // --------------------------------------------------



  const [bulkImportOpen, setBulkImportOpen] =

    useState(false);



  const [bulkImportChapterId, setBulkImportChapterId] =

    useState<string | null>(null);



  const [bulkImportText, setBulkImportText] =

    useState("");



  const [importingSentences, setImportingSentences] =

    useState(false);



  // --------------------------------------------------

  // BULK VOCABULARY IMPORT

  // --------------------------------------------------



  const [bulkVocabularyOpen, setBulkVocabularyOpen] =

    useState(false);



  const [

    bulkVocabularyChapterId,

    setBulkVocabularyChapterId,

  ] = useState<string | null>(null);



  const [bulkVocabularyText, setBulkVocabularyText] =

    useState("");



  const [importingVocabulary, setImportingVocabulary] =

    useState(false);



  // --------------------------------------------------

  // CHAPTERS

  // --------------------------------------------------



  const [addingChapter, setAddingChapter] =

    useState(false);



  const [newChapterTitle, setNewChapterTitle] =

    useState("");



  const [creatingChapter, setCreatingChapter] =

    useState(false);



  const [editingChapterId, setEditingChapterId] =

    useState<string | null>(null);



  const [editChapterTitle, setEditChapterTitle] =

    useState("");



  const [editChapterNumber, setEditChapterNumber] =

    useState("");



  const [savingChapter, setSavingChapter] =

    useState(false);



  const [deletingChapterId, setDeletingChapterId] =

    useState<string | null>(null);



  // --------------------------------------------------

  // LOAD CONTENT

  // --------------------------------------------------



  useEffect(() => {

    loadLearningLanguage();
    loadContent();

  }, [bookId]);

  async function loadLearningLanguage() {
    const { data, error } = await supabase
      .from("books")
      .select("learning_language")
      .eq("id", bookId)
      .single();

    if (!error && data?.learning_language) {
      setLearningLanguage(data.learning_language);
    }
  }



  async function loadContent(showLoading = true) {

    if (showLoading) {

      setLoading(true);

    }



    setError("");



    const [

      { data: chapterData, error: chapterError },

      { data: sentenceData, error: sentenceError },

    ] = await Promise.all([

      supabase

        .from("chapters")

        .select(

          "id, book_id, chapter_number, title, sort_order"

        )

        .eq("book_id", bookId)

        .order("sort_order", { ascending: true })

        .order("chapter_number", { ascending: true }),



      supabase

        .from("sentences")

        .select(

          "id, book_id, chapter_id, position, source_text, translated_text, pronunciation"

        )

        .eq("book_id", bookId)

        .order("position", { ascending: true }),

    ]);



    if (chapterError) {

      setError(

        `Could not load chapters: ${chapterError.message}`

      );

      setLoading(false);

      return;

    }



    if (sentenceError) {

      setError(

        `Could not load sentences: ${sentenceError.message}`

      );

      setLoading(false);

      return;

    }



    setChapters((chapterData ?? []) as Chapter[]);

    setSentences((sentenceData ?? []) as Sentence[]);

    setLoading(false);

  }



  async function reorderBook() {

    const { error } = await supabase.rpc(

      "reorder_book_sentences",

      {

        p_book_id: bookId,

      }

    );



    if (error) {

      throw new Error(error.message);

    }

  }



  function clearMessage() {

    setMessage("");

  }



  // --------------------------------------------------

  // SENTENCE EDITING

  // --------------------------------------------------



  function startEditingSentence(sentence: Sentence) {

    clearMessage();



    setEditingSentenceId(sentence.id);

    setEditEnglish(sentence.source_text);

    setEditTranslation(sentence.translated_text);

    setEditPronunciation(

      sentence.pronunciation ?? ""

    );

  }



  function cancelEditingSentence() {

    setEditingSentenceId(null);

    setEditEnglish("");

    setEditTranslation("");

    setEditPronunciation("");

  }



  async function saveSentence(sentence: Sentence) {

    if (savingSentence) return;



    const cleanEnglish = editEnglish.trim();

    const cleanTranslation = editTranslation.trim();

    const cleanPronunciation =

      editPronunciation.trim();



    if (!cleanEnglish || !cleanTranslation) {

      setMessage(

        `English and ${learningLanguageLabel} are required.`

      );

      return;

    }



    setSavingSentence(true);

    clearMessage();



    const { error } = await supabase

      .from("sentences")

      .update({

        source_text: cleanEnglish,

        translated_text: cleanTranslation,

        pronunciation: cleanPronunciation,

      })

      .eq("id", sentence.id);



    if (error) {

      setMessage(

        `Could not save sentence: ${error.message}`

      );

      setSavingSentence(false);

      return;

    }



    setEditingSentenceId(null);

    setEditEnglish("");

    setEditTranslation("");

    setEditPronunciation("");



    await loadContent(false);



    setMessage(

      `Sentence ${sentence.position} saved.`

    );



    setSavingSentence(false);

  }



  async function deleteSentence(sentence: Sentence) {

    if (deletingSentenceId) return;



    const confirmed = window.confirm(

      `Delete sentence ${sentence.position}?\n\n"${sentence.source_text}"\n\nAny vocabulary attached to this sentence will also be deleted.\n\nThis cannot be undone.`

    );



    if (!confirmed) return;



    setDeletingSentenceId(sentence.id);

    clearMessage();



    const { error } = await supabase

      .from("sentences")

      .delete()

      .eq("id", sentence.id);



    if (error) {

      setMessage(

        `Could not delete sentence: ${error.message}`

      );

      setDeletingSentenceId(null);

      return;

    }



    try {

      await reorderBook();

      await loadContent(false);



      setMessage("Sentence deleted.");

    } catch (reorderError) {

      await loadContent(false);



      setMessage(

        `Sentence was deleted, but positions could not be renumbered: ${

          reorderError instanceof Error

            ? reorderError.message

            : "Unknown error"

        }`

      );

    }



    setDeletingSentenceId(null);

  }



  // --------------------------------------------------

  // ADD SENTENCE

  // --------------------------------------------------



  function openAddSentence(

    chapterId: string | null

  ) {

    clearMessage();



    setAddingSentence(true);

    setAddSentenceChapterId(chapterId);



    setNewEnglish("");

    setNewTranslation("");

    setNewPronunciation("");

  }



  function cancelAddSentence() {

    setAddingSentence(false);

    setAddSentenceChapterId(null);



    setNewEnglish("");

    setNewTranslation("");

    setNewPronunciation("");

  }



  async function createSentence() {

    if (creatingSentence) return;



    const cleanEnglish = newEnglish.trim();

    const cleanTranslation = newTranslation.trim();

    const cleanPronunciation =

      newPronunciation.trim();



    if (!cleanEnglish || !cleanTranslation) {

      setMessage(

        `English and ${learningLanguageLabel} are required.`

      );

      return;

    }



    setCreatingSentence(true);

    clearMessage();



    const nextTemporaryPosition =

      sentences.length === 0

        ? 1

        : Math.max(

            ...sentences.map(

              (sentence) => sentence.position

            )

          ) + 1;



    const { error } = await supabase

      .from("sentences")

      .insert({

        book_id: bookId,

        chapter_id: addSentenceChapterId,

        position: nextTemporaryPosition,

        source_text: cleanEnglish,

        translated_text: cleanTranslation,

        pronunciation: cleanPronunciation,

      });



    if (error) {

      setMessage(

        `Could not add sentence: ${error.message}`

      );

      setCreatingSentence(false);

      return;

    }



    try {

      await reorderBook();

      await loadContent(false);



      setAddingSentence(false);

      setAddSentenceChapterId(null);



      setNewEnglish("");

      setNewTranslation("");

      setNewPronunciation("");



      setMessage("Sentence added.");

    } catch (reorderError) {

      await loadContent(false);



      setMessage(

        `Sentence was added, but positions could not be reordered: ${

          reorderError instanceof Error

            ? reorderError.message

            : "Unknown error"

        }`

      );

    }



    setCreatingSentence(false);

  }



  // --------------------------------------------------

  // BULK SENTENCE IMPORT

  // --------------------------------------------------



  function openBulkImport(

    chapterId: string | null

  ) {

    clearMessage();



    setBulkVocabularyOpen(false);

    setBulkVocabularyChapterId(null);

    setBulkVocabularyText("");



    setBulkImportChapterId(chapterId);

    setBulkImportText("");

    setBulkImportOpen(true);

  }



  function cancelBulkImport() {

    setBulkImportOpen(false);

    setBulkImportChapterId(null);

    setBulkImportText("");

  }



  async function importBulkSentences() {

    if (importingSentences) return;



    const cleanText = bulkImportText.trim();



    if (!cleanText) {

      setMessage(

        "Paste at least one sentence to import."

      );

      return;

    }



    const lines = cleanText

      .split("\n")

      .map((line) => line.trim())

      .filter(Boolean);



    if (lines.length === 0) {

      setMessage(

        "Paste at least one sentence to import."

      );

      return;

    }



    const parsedRows: {

      source_text: string;

      translated_text: string;

      pronunciation: string;

    }[] = [];



    for (

      let index = 0;

      index < lines.length;

      index += 1

    ) {

      const line = lines[index];



      const parts = line

        .split("|")

        .map((part) => part.trim());



      if (parts.length < 2) {

        setMessage(

          `Line ${

            index + 1

          } is invalid. Use: English | ${learningLanguageLabel} | Pronunciation`

        );

        return;

      }



      const english = parts[0];

      const translationText = parts[1];



      const pronunciation = parts

        .slice(2)

        .join("|")

        .trim();



      if (!english || !translationText) {

        setMessage(

          `Line ${

            index + 1

          } needs both English and ${learningLanguageLabel} text.`

        );

        return;

      }



      parsedRows.push({

        source_text: english,

        translated_text: translationText,

        pronunciation,

      });

    }



    setImportingSentences(true);

    clearMessage();



    const nextTemporaryPosition =

      sentences.length === 0

        ? 1

        : Math.max(

            ...sentences.map(

              (sentence) => sentence.position

            )

          ) + 1;



    const rowsToInsert = parsedRows.map(

      (row, index) => ({

        book_id: bookId,

        chapter_id: bulkImportChapterId,

        position:

          nextTemporaryPosition + index,

        source_text: row.source_text,

        translated_text:

          row.translated_text,

        pronunciation:

          row.pronunciation,

      })

    );



    const { error } = await supabase

      .from("sentences")

      .insert(rowsToInsert);



    if (error) {

      setMessage(

        `Could not import sentences: ${error.message}`

      );



      setImportingSentences(false);

      return;

    }



    try {

      await reorderBook();

      await loadContent(false);



      setBulkImportOpen(false);

      setBulkImportChapterId(null);

      setBulkImportText("");



      setMessage(

        `${parsedRows.length} ${

          parsedRows.length === 1

            ? "sentence"

            : "sentences"

        } imported successfully.`

      );

    } catch (reorderError) {

      await loadContent(false);



      setMessage(

        `Sentences were imported, but positions could not be reordered: ${

          reorderError instanceof Error

            ? reorderError.message

            : "Unknown error"

        }`

      );

    }



    setImportingSentences(false);

  }



  // --------------------------------------------------

  // BULK VOCABULARY IMPORT

  // --------------------------------------------------



  function openBulkVocabularyImport(

    chapterId: string

  ) {

    clearMessage();



    setBulkImportOpen(false);

    setBulkImportChapterId(null);

    setBulkImportText("");



    setBulkVocabularyChapterId(chapterId);

    setBulkVocabularyText("");

    setBulkVocabularyOpen(true);

  }



  function cancelBulkVocabularyImport() {

    setBulkVocabularyOpen(false);

    setBulkVocabularyChapterId(null);

    setBulkVocabularyText("");

  }



  async function importBulkVocabulary() {

    if (importingVocabulary) return;



    const cleanText =

      bulkVocabularyText.trim();



    if (!cleanText) {

      setMessage(

        "Paste at least one vocabulary item to import."

      );

      return;

    }



    if (!bulkVocabularyChapterId) {

      setMessage(

        "Could not determine which chapter to import vocabulary into."

      );

      return;

    }



    const chapterSentences = sentences

      .filter(

        (sentence) =>

          sentence.chapter_id ===

          bulkVocabularyChapterId

      )

      .sort(

        (a, b) =>

          a.position - b.position

      );



    if (chapterSentences.length === 0) {

      setMessage(

        "This chapter does not contain any sentences yet."

      );

      return;

    }



    const lines = cleanText

      .split("\n")

      .map((line) => line.trim())

      .filter(Boolean);



    type ParsedVocabulary = {
  sentenceId: string;
  word: string;
  tapText: string;
  translation: string;
  pronunciation: string;
};


    const parsedRows: ParsedVocabulary[] = [];



    for (

      let index = 0;

      index < lines.length;

      index += 1

    ) {

      const parts = lines[index]

        .split("|")

        .map((part) => part.trim());



      if (parts.length < 4) {

        setMessage(

          `Line ${

            index + 1

          } is invalid. Use: Sentence # | ${learningLanguageLabel} base word | Text in sentence | English | Pronunciation`

        );

        return;

      }



      const sentenceNumber = Number(parts[0]);
const word = parts[1];
const tapText = parts[2];
const translation = parts[3];

const pronunciation = parts
  .slice(4)
  .join("|")
  .trim();



      if (

        !Number.isInteger(sentenceNumber) ||

        sentenceNumber < 1

      ) {

        setMessage(

          `Line ${

            index + 1

          } has an invalid sentence number.`

        );

        return;

      }



      if (

        sentenceNumber >

        chapterSentences.length

      ) {

        setMessage(

          `Line ${

            index + 1

          } refers to sentence ${sentenceNumber}, but this chapter only has ${chapterSentences.length} sentences.`

        );

        return;

      }



      if (!word || !tapText || !translation) {

        setMessage(

          `Line ${

            index + 1

          } needs both a ${learningLanguageLabel} word and English translation.`

        );

        return;

      }



      const targetSentence =

        chapterSentences[

          sentenceNumber - 1

        ];



     parsedRows.push({
  sentenceId: targetSentence.id,
  word,
  tapText,
  translation,
  pronunciation,
});

    }



    setImportingVocabulary(true);

    clearMessage();



    const sentenceIds =

      chapterSentences.map(

        (sentence) => sentence.id

      );



    const {

      data: existingVocabulary,

      error: existingVocabularyError,

    } = await supabase

      .from("vocabulary_items")

      .select(

        "sentence_id, sort_order"

      )

      .in("sentence_id", sentenceIds);



    if (existingVocabularyError) {

      setMessage(

        `Could not check existing vocabulary: ${existingVocabularyError.message}`

      );

      setImportingVocabulary(false);

      return;

    }



    const nextSortOrders =

      new Map<string, number>();



    for (const sentence of chapterSentences) {

      const existingForSentence = (

        existingVocabulary ?? []

      ).filter(

        (item) =>

          item.sentence_id ===

          sentence.id

      );



      const highestSortOrder =

        existingForSentence.length === 0

          ? 0

          : Math.max(

              ...existingForSentence.map(

                (item) =>

                  item.sort_order

              )

            );



      nextSortOrders.set(

        sentence.id,

        highestSortOrder + 1

      );

    }



    const rowsToInsert = parsedRows.map(

      (row) => {

        const sortOrder =

          nextSortOrders.get(

            row.sentenceId

          ) ?? 1;



        nextSortOrders.set(

          row.sentenceId,

          sortOrder + 1

        );



        return {
  sentence_id: row.sentenceId,
  word: row.word,
  tap_text: row.tapText,
  translation: row.translation,
  pronunciation:
    row.pronunciation,
  sort_order: sortOrder,
};

      }

    );



    const { error } = await supabase

      .from("vocabulary_items")

      .insert(rowsToInsert);



    if (error) {

      setMessage(

        `Could not import vocabulary: ${error.message}`

      );

      setImportingVocabulary(false);

      return;

    }



    setBulkVocabularyOpen(false);

    setBulkVocabularyChapterId(null);

    setBulkVocabularyText("");



    setMessage(

      `${rowsToInsert.length} ${

        rowsToInsert.length === 1

          ? "vocabulary item"

          : "vocabulary items"

      } imported successfully.`

    );



    setImportingVocabulary(false);

  }



  // --------------------------------------------------

  // CHAPTERS

  // --------------------------------------------------



  function openAddChapter() {

    clearMessage();



    if (

      chapters.length === 0 &&

      sentences.length > 0

    ) {

      window.alert(

        "This story already contains sentences without chapters. Chapter conversion will be added separately so those existing sentences can be handled safely."

      );

      return;

    }



    setAddingChapter(true);

    setNewChapterTitle("");

  }



  function cancelAddChapter() {

    setAddingChapter(false);

    setNewChapterTitle("");

  }



  async function createChapter() {

    if (creatingChapter) return;



    const cleanTitle =

      newChapterTitle.trim();



    if (!cleanTitle) {

      setMessage(

        "A chapter title is required."

      );

      return;

    }



    setCreatingChapter(true);

    clearMessage();



    const nextChapterNumber =

      chapters.length === 0

        ? 1

        : Math.max(

            ...chapters.map(

              (chapter) =>

                chapter.chapter_number

            )

          ) + 1;



    const nextSortOrder =

      chapters.length === 0

        ? 1

        : Math.max(

            ...chapters.map(

              (chapter) =>

                chapter.sort_order

            )

          ) + 1;



    const { error } = await supabase

      .from("chapters")

      .insert({

        book_id: bookId,

        chapter_number:

          nextChapterNumber,

        title: cleanTitle,

        sort_order: nextSortOrder,

      });



    if (error) {

      setMessage(

        `Could not add chapter: ${error.message}`

      );

      setCreatingChapter(false);

      return;

    }



    await loadContent(false);



    setAddingChapter(false);

    setNewChapterTitle("");



    setMessage(

      `Chapter ${nextChapterNumber} added.`

    );



    setCreatingChapter(false);

  }



  function startEditingChapter(

    chapter: Chapter

  ) {

    clearMessage();



    setEditingChapterId(chapter.id);

    setEditChapterTitle(chapter.title);

    setEditChapterNumber(

      chapter.chapter_number.toString()

    );

  }



  function cancelEditingChapter() {

    setEditingChapterId(null);

    setEditChapterTitle("");

    setEditChapterNumber("");

  }



  async function saveChapter(

    chapter: Chapter

  ) {

    if (savingChapter) return;



    const cleanTitle =

      editChapterTitle.trim();



    const chapterNumber = Number(

      editChapterNumber

    );



    if (!cleanTitle) {

      setMessage(

        "A chapter title is required."

      );

      return;

    }



    if (

      !Number.isInteger(chapterNumber) ||

      chapterNumber < 1

    ) {

      setMessage(

        "Chapter number must be a whole number of 1 or higher."

      );

      return;

    }



    setSavingChapter(true);

    clearMessage();



    const { error } = await supabase

      .from("chapters")

      .update({

        title: cleanTitle,

        chapter_number: chapterNumber,

        sort_order: chapterNumber,

      })

      .eq("id", chapter.id);



    if (error) {

      setMessage(

        `Could not save chapter: ${error.message}`

      );

      setSavingChapter(false);

      return;

    }



    try {

      await reorderBook();

      await loadContent(false);



      setEditingChapterId(null);

      setEditChapterTitle("");

      setEditChapterNumber("");



      setMessage("Chapter saved.");

    } catch (reorderError) {

      await loadContent(false);



      setMessage(

        `Chapter was saved, but sentence positions could not be reordered: ${

          reorderError instanceof Error

            ? reorderError.message

            : "Unknown error"

        }`

      );

    }



    setSavingChapter(false);

  }



  async function deleteChapter(

    chapter: Chapter

  ) {

    if (deletingChapterId) return;



    const chapterSentences =

      sentences.filter(

        (sentence) =>

          sentence.chapter_id ===

          chapter.id

      );



    let confirmed = false;



    if (chapterSentences.length > 0) {

      const typedTitle = window.prompt(

        `Chapter ${chapter.chapter_number}: "${chapter.title}" contains ${chapterSentences.length} sentence${

          chapterSentences.length === 1

            ? ""

            : "s"

        }.\n\nDeleting the chapter will permanently delete those sentences and their vocabulary.\n\nType the chapter title exactly to confirm:`

      );



      if (typedTitle === null) return;



      if (typedTitle !== chapter.title) {

        window.alert(

          "The chapter title did not match. Nothing was deleted."

        );

        return;

      }



      confirmed = window.confirm(

        `Permanently delete Chapter ${chapter.chapter_number} and all ${chapterSentences.length} of its sentences?\n\nThis cannot be undone.`

      );

    } else {

      confirmed = window.confirm(

        `Delete Chapter ${chapter.chapter_number}: "${chapter.title}"?\n\nThe chapter is empty.`

      );

    }



    if (!confirmed) return;



    setDeletingChapterId(chapter.id);

    clearMessage();



    const { error } = await supabase

      .from("chapters")

      .delete()

      .eq("id", chapter.id);



    if (error) {

      setMessage(

        `Could not delete chapter: ${error.message}`

      );

      setDeletingChapterId(null);

      return;

    }



    try {

      await reorderBook();

      await loadContent(false);



      setMessage("Chapter deleted.");

    } catch (reorderError) {

      await loadContent(false);



      setMessage(

        `Chapter was deleted, but sentence positions could not be renumbered: ${

          reorderError instanceof Error

            ? reorderError.message

            : "Unknown error"

        }`

      );

    }



    setDeletingChapterId(null);

  }



  // --------------------------------------------------

  // SENTENCE CARD

  // --------------------------------------------------



  function renderSentence(

    sentence: Sentence

  ) {

    const isEditing =

      editingSentenceId === sentence.id;



    const isDeleting =

      deletingSentenceId === sentence.id;



    return (

      <div

        key={sentence.id}

        className="rounded-2xl border border-neutral-100 bg-[#fafaf9] p-5"

      >

        <div className="flex gap-4">

          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-400 shadow-sm">

            {sentence.position}

          </div>



          <div className="min-w-0 flex-1">

            {isEditing ? (

              <div className="space-y-5">

                <EditorField

                  label="English"

                  value={editEnglish}

                  onChange={setEditEnglish}

                  rows={3}

                />



                <EditorField

                  label={learningLanguageLabel}

                  value={editTranslation}

                  onChange={setEditTranslation}

                  rows={3}

                  prominent

                />



                <EditorField

                  label="Pronunciation"

                  value={editPronunciation}

                  onChange={

                    setEditPronunciation

                  }

                  rows={2}

                />



                <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">

                  <button

                    type="button"

                    onClick={

                      cancelEditingSentence

                    }

                    disabled={savingSentence}

                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

                  >

                    Cancel

                  </button>



                  <button

                    type="button"

                    onClick={() =>

                      saveSentence(sentence)

                    }

                    disabled={savingSentence}

                    className="rounded-xl bg-[#181818] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"

                  >

                    {savingSentence

                      ? "Saving..."

                      : "Save Sentence"}

                  </button>

                </div>

              </div>

            ) : (

              <>

                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0 flex-1">

                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">

                      English

                    </p>



                    <p className="mt-1 text-sm leading-6 text-neutral-700">

                      {sentence.source_text}

                    </p>

                  </div>



                  <div className="flex shrink-0 gap-2">

                    <button

                      type="button"

                      onClick={() =>

                        startEditingSentence(

                          sentence

                        )

                      }

                      disabled={

                        editingSentenceId !==

                          null ||

                        addingSentence ||

                        deletingSentenceId !==

                          null ||

                        bulkImportOpen ||

                        bulkVocabularyOpen

                      }

                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

                    >

                      Edit

                    </button>



                    <button

                      type="button"

                      onClick={() =>

                        deleteSentence(

                          sentence

                        )

                      }

                      disabled={

                        editingSentenceId !==

                          null ||

                        addingSentence ||

                        deletingSentenceId !==

                          null ||

                        bulkImportOpen ||

                        bulkVocabularyOpen

                      }

                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"

                    >

                      {isDeleting

                        ? "Deleting..."

                        : "Delete"}

                    </button>

                  </div>

                </div>



                <div className="mt-4">

                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">

                    {learningLanguageLabel}

                  </p>



                  <p className="mt-1 text-base font-medium leading-7">

                    {

                      sentence.translated_text

                    }

                  </p>

                </div>



                {sentence.pronunciation && (

                  <div className="mt-4">

                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">

                      Pronunciation

                    </p>



                    <p className="mt-1 text-sm leading-6 text-neutral-500">

                      {

                        sentence.pronunciation

                      }

                    </p>

                  </div>

                )}



                <SentenceVocabularyEditor
  sentenceId={sentence.id}
  learningLanguage={learningLanguage}
/>
              </>

            )}

          </div>

        </div>

      </div>

    );

  }



  // --------------------------------------------------

  // LOADING / ERROR

  // --------------------------------------------------



  if (loading) {

    return (

      <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">

        <p className="text-sm text-neutral-500">

          Loading story content...

        </p>

      </section>

    );

  }



  if (error) {

    return (

      <section className="rounded-3xl border border-red-100 bg-white p-7 shadow-sm">

        <h2 className="font-semibold">

          Story content

        </h2>



        <p className="mt-3 text-sm text-red-600">

          {error}

        </p>

      </section>

    );

  }



  // --------------------------------------------------

  // UI

  // --------------------------------------------------



  return (

    <section className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">

      {/* HEADER */}



      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-6">

        <div>

          <h2 className="text-lg font-semibold">

            Story content

          </h2>



          <p className="mt-1 text-sm text-neutral-500">

            {chapters.length > 0

              ? `${chapters.length} ${

                  chapters.length === 1

                    ? "chapter"

                    : "chapters"

                } · ${sentences.length} ${

                  sentences.length === 1

                    ? "sentence"

                    : "sentences"

                }`

              : `${sentences.length} ${

                  sentences.length === 1

                    ? "sentence"

                    : "sentences"

                } · No chapters`}

          </p>

        </div>



        <div className="flex gap-2">

          {chapters.length === 0 && (

            <button

              type="button"

              onClick={() =>

                openAddSentence(null)

              }

              disabled={

                addingSentence ||

                editingSentenceId !== null

              }

              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

            >

              + Add Sentence

            </button>

          )}



          <button

            type="button"

            onClick={openAddChapter}

            disabled={

              addingChapter ||

              addingSentence ||

              editingSentenceId !== null

            }

            className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"

          >

            + Add Chapter

          </button>

        </div>

      </div>



      {/* MESSAGE */}



      {message && (

        <div

          className={`mt-5 rounded-xl px-4 py-3 text-sm font-medium ${

            message.startsWith(

              "Could not"

            ) ||

            message.includes(

              "could not be"

            ) ||

            message.includes(

              "required"

            ) ||

            message.includes(

              "invalid"

            ) ||

            message.includes(

              "needs both"

            ) ||

            message.startsWith(

              "Paste"

            ) ||

            message.includes(

              "only has"

            ) ||

            message.includes(

              "does not contain"

            )

              ? "bg-red-50 text-red-700"

              : "bg-green-50 text-green-700"

          }`}

        >

          {message}

        </div>

      )}

      {/* FULL BOOK IMPORT */}

<FullBookImporter
  bookId={bookId}
  existingChapterCount={chapters.length}
  existingSentenceCount={sentences.length}
  onImported={() => loadContent(false)}
/>



      {/* ADD CHAPTER */}



      {addingChapter && (

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9] p-5">

          <h3 className="font-semibold">

            Add chapter

          </h3>



          <p className="mt-1 text-sm text-neutral-500">

            This will become Chapter{" "}

            {chapters.length === 0

              ? 1

              : Math.max(

                  ...chapters.map(

                    (chapter) =>

                      chapter.chapter_number

                  )

                ) + 1}

            .

          </p>



          <div className="mt-5">

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

              Chapter title

            </label>



            <input

              type="text"

              value={newChapterTitle}

              onChange={(event) =>

                setNewChapterTitle(

                  event.target.value

                )

              }

              placeholder="Enter chapter title..."

              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-400"

            />

          </div>



          <div className="mt-5 flex justify-end gap-2 border-t border-neutral-200 pt-5">

            <button

              type="button"

              onClick={cancelAddChapter}

              disabled={creatingChapter}

              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

            >

              Cancel

            </button>



            <button

              type="button"

              onClick={createChapter}

              disabled={creatingChapter}

              className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"

            >

              {creatingChapter

                ? "Adding..."

                : "Add Chapter"}

            </button>

          </div>

        </div>

      )}



      {/* BULK SENTENCE IMPORT */}



      {bulkImportOpen && (

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9] p-5">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="font-semibold">

                Bulk import sentences

              </h3>



              <p className="mt-1 text-sm text-neutral-500">

                {`Importing into ${

                  chapters.find(

                    (chapter) =>

                      chapter.id ===

                      bulkImportChapterId

                  )?.title ?? "chapter"

                }.`}

              </p>

            </div>



            <div className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm">

              English | {learningLanguageLabel} |

              Pronunciation

            </div>

          </div>



          <div className="mt-5">

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

              Sentences

            </label>



            <textarea

              value={bulkImportText}

              onChange={(event) =>

                setBulkImportText(

                  event.target.value

                )

              }

              rows={12}

              placeholder={`I was nervous, but I was not mad. | Я нервничал, но я не был сумасшедшим. | ya nerv-nee-chal...

I loved the old man. | Я любил старика. | ya lyu-beel...

But I hated his pale blue eye. | Но я ненавидел его бледно-голубой глаз. | no ya...`}

              className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-neutral-400"

            />



            <p className="mt-2 text-xs leading-5 text-neutral-400">

              One sentence per line.

              Separate English, {learningLanguageLabel} and

              pronunciation with |.

              Pronunciation is optional.

              Blank lines are ignored.

            </p>

          </div>



          <div className="mt-5 flex items-center justify-between gap-4 border-t border-neutral-200 pt-5">

            <p className="text-sm text-neutral-500">

              {

                bulkImportText

                  .split("\n")

                  .map((line) =>

                    line.trim()

                  )

                  .filter(Boolean).length

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

                  importingSentences

                }

                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

              >

                Cancel

              </button>



              <button

                type="button"

                onClick={

                  importBulkSentences

                }

                disabled={

                  importingSentences ||

                  !bulkImportText.trim()

                }

                className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"

              >

                {importingSentences

                  ? "Importing..."

                  : "Import Sentences"}

              </button>

            </div>

          </div>

        </div>

      )}



      {/* BULK VOCABULARY IMPORT */}



      {bulkVocabularyOpen && (

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9] p-5">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="font-semibold">

                Bulk import vocabulary

              </h3>



              <p className="mt-1 text-sm text-neutral-500">

                {`Importing into ${

                  chapters.find(

                    (chapter) =>

                      chapter.id ===

                      bulkVocabularyChapterId

                  )?.title ?? "chapter"

                }.`}

              </p>

            </div>



            <div className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm">

              Sentence # | {learningLanguageLabel} |

              English | Pronunciation

            </div>

          </div>



          <div className="mt-5">

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

              Vocabulary

            </label>



            <textarea

              value={

                bulkVocabularyText

              }

              onChange={(event) =>

                setBulkVocabularyText(

                  event.target.value

                )

              }

              rows={12}

              placeholder={`1 | нервничал | was nervous | nerv-nee-CHAL

1 | сумасшедшим | mad / insane | soo-ma-SHED-sheem

2 | чувства | senses / feelings | CHOOST-va

2 | сильнее | stronger | SEEL-nee-ye`}

              className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm leading-7 outline-none transition focus:border-neutral-400"

            />



            <p className="mt-2 text-xs leading-5 text-neutral-400">

              The first number is the

              sentence number within this

              chapter. Pronunciation is

              optional. Blank lines are

              ignored.

            </p>

          </div>



          <div className="mt-5 flex items-center justify-between gap-4 border-t border-neutral-200 pt-5">

            <p className="text-sm text-neutral-500">

              {

                bulkVocabularyText

                  .split("\n")

                  .map((line) =>

                    line.trim()

                  )

                  .filter(Boolean).length

              }{" "}

              lines ready

            </p>



            <div className="flex gap-2">

              <button

                type="button"

                onClick={

                  cancelBulkVocabularyImport

                }

                disabled={

                  importingVocabulary

                }

                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

              >

                Cancel

              </button>



              <button

                type="button"

                onClick={

                  importBulkVocabulary

                }

                disabled={

                  importingVocabulary ||

                  !bulkVocabularyText.trim()

                }

                className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"

              >

                {importingVocabulary

                  ? "Importing..."

                  : "Import Vocabulary"}

              </button>

            </div>

          </div>

        </div>

      )}



      {/* ADD SENTENCE */}



      {addingSentence && (

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-[#fafaf9] p-5">

          <h3 className="font-semibold">

            Add sentence

          </h3>



          <p className="mt-1 text-sm text-neutral-500">

            {addSentenceChapterId

              ? `Adding to ${

                  chapters.find(

                    (chapter) =>

                      chapter.id ===

                      addSentenceChapterId

                  )?.title ?? "chapter"

                }.`

              : "Adding to this story."}

          </p>



          <div className="mt-5 space-y-5">

            <EditorField

              label="English"

              value={newEnglish}

              onChange={setNewEnglish}

              rows={3}

              placeholder="Enter the English sentence..."

            />



            <EditorField

              label={learningLanguageLabel}

              value={newTranslation}

              onChange={setNewTranslation}

              rows={3}

              placeholder={`Enter the ${learningLanguageLabel} translation...`}

              prominent

            />



            <EditorField

              label="Pronunciation"

              value={newPronunciation}

              onChange={

                setNewPronunciation

              }

              rows={2}

              placeholder="Enter pronunciation..."

            />

          </div>



          <div className="mt-5 flex justify-end gap-2 border-t border-neutral-200 pt-5">

            <button

              type="button"

              onClick={

                cancelAddSentence

              }

              disabled={

                creatingSentence

              }

              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50"

            >

              Cancel

            </button>



            <button

              type="button"

              onClick={createSentence}

              disabled={

                creatingSentence

              }

              className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"

            >

              {creatingSentence

                ? "Adding..."

                : "Add Sentence"}

            </button>

          </div>

        </div>

      )}



      {/* EMPTY / STORY CONTENT */}



      {sentences.length === 0 &&

      chapters.length === 0 ? (

        <div className="py-14 text-center">

          <h3 className="font-semibold">

            No story content yet

          </h3>



          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">

            Add individual sentences or

            create the first chapter.

          </p>

        </div>

      ) : chapters.length > 0 ? (

        <div className="mt-8 space-y-10">

          {chapters.map((chapter) => {

            const chapterSentences =

              sentences

                .filter(

                  (sentence) =>

                    sentence.chapter_id ===

                    chapter.id

                )

                .sort(

                  (a, b) =>

                    a.position -

                    b.position

                );



            const isEditingChapter =

              editingChapterId ===

              chapter.id;



            const isDeletingChapter =

              deletingChapterId ===

              chapter.id;



            return (

              <div

                key={chapter.id}

                className="border-t border-neutral-100 pt-7 first:border-t-0 first:pt-0"

              >

                {isEditingChapter ? (

                  <div className="mb-5 rounded-2xl border border-neutral-200 bg-[#fafaf9] p-5">

                    <h3 className="font-semibold">

                      Edit chapter

                    </h3>



                    <div className="mt-5 grid gap-4 sm:grid-cols-[120px_1fr]">

                      <div>

                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

                          Number

                        </label>



                        <input

                          type="number"

                          min="1"

                          step="1"

                          value={

                            editChapterNumber

                          }

                          onChange={(

                            event

                          ) =>

                            setEditChapterNumber(

                              event.target

                                .value

                            )

                          }

                          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"

                        />

                      </div>



                      <div>

                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

                          Title

                        </label>



                        <input

                          type="text"

                          value={

                            editChapterTitle

                          }

                          onChange={(

                            event

                          ) =>

                            setEditChapterTitle(

                              event.target

                                .value

                            )

                          }

                          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400"

                        />

                      </div>

                    </div>



                    <div className="mt-5 flex justify-end gap-2">

                      <button

                        type="button"

                        onClick={

                          cancelEditingChapter

                        }

                        disabled={

                          savingChapter

                        }

                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"

                      >

                        Cancel

                      </button>



                      <button

                        type="button"

                        onClick={() =>

                          saveChapter(

                            chapter

                          )

                        }

                        disabled={

                          savingChapter

                        }

                        className="rounded-xl bg-[#181818] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"

                      >

                        {savingChapter

                          ? "Saving..."

                          : "Save Chapter"}

                      </button>

                    </div>

                  </div>

                ) : (

                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">

                        Chapter{" "}

                        {

                          chapter.chapter_number

                        }

                      </p>



                      <h3 className="mt-1 text-lg font-semibold">

                        {chapter.title}

                      </h3>



                      <p className="mt-1 text-xs text-neutral-400">

                        {

                          chapterSentences.length

                        }{" "}

                        {chapterSentences.length ===

                        1

                          ? "sentence"

                          : "sentences"}

                      </p>

                    </div>



                    <div className="flex flex-wrap gap-2">

                      <button

                        type="button"

                        onClick={() =>

                          openBulkImport(

                            chapter.id

                          )

                        }

                        disabled={

                          addingSentence ||

                          bulkImportOpen ||

                          bulkVocabularyOpen ||

                          editingSentenceId !==

                            null ||

                          editingChapterId !==

                            null ||

                          importingSentences ||

                          importingVocabulary

                        }

                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

                      >

                        Bulk Sentences

                      </button>



                      <button

                        type="button"

                        onClick={() =>

                          openBulkVocabularyImport(

                            chapter.id

                          )

                        }

                        disabled={

                          addingSentence ||

                          bulkImportOpen ||

                          bulkVocabularyOpen ||

                          editingSentenceId !==

                            null ||

                          editingChapterId !==

                            null ||

                          importingSentences ||

                          importingVocabulary ||

                          chapterSentences.length ===

                            0

                        }

                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

                      >

                        Bulk Vocabulary

                      </button>



                      <button

                        type="button"

                        onClick={() =>

                          openAddSentence(

                            chapter.id

                          )

                        }

                        disabled={

                          addingSentence ||

                          bulkImportOpen ||

                          bulkVocabularyOpen ||

                          editingSentenceId !==

                            null ||

                          editingChapterId !==

                            null

                        }

                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

                      >

                        + Add Sentence

                      </button>



                      <button

                        type="button"

                        onClick={() =>

                          startEditingChapter(

                            chapter

                          )

                        }

                        disabled={

                          addingSentence ||

                          bulkImportOpen ||

                          bulkVocabularyOpen ||

                          editingSentenceId !==

                            null ||

                          editingChapterId !==

                            null

                        }

                        className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold transition hover:bg-neutral-50 disabled:opacity-40"

                      >

                        Edit Chapter

                      </button>



                      <button

                        type="button"

                        onClick={() =>

                          deleteChapter(

                            chapter

                          )

                        }

                        disabled={

                          deletingChapterId !==

                            null ||

                          bulkImportOpen ||

                          bulkVocabularyOpen

                        }

                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"

                      >

                        {isDeletingChapter

                          ? "Deleting..."

                          : "Delete Chapter"}

                      </button>

                    </div>

                  </div>

                )}



                {chapterSentences.length ===

                0 ? (

                  <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-center">

                    <p className="text-sm text-neutral-400">

                      No sentences in this

                      chapter.

                    </p>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {chapterSentences.map(

                      renderSentence

                    )}

                  </div>

                )}

              </div>

            );

          })}

        </div>

      ) : (

        <div className="mt-7 space-y-3">

          {sentences.map(

            renderSentence

          )}

        </div>

      )}

    </section>

  );

}



function EditorField({

  label,

  value,

  onChange,

  rows,

  placeholder,

  prominent = false,

}: {

  label: string;

  value: string;

  onChange: (value: string) => void;

  rows: number;

  placeholder?: string;

  prominent?: boolean;

}) {

  return (

    <div>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-400">

        {label}

      </label>



      <textarea

        value={value}

        onChange={(event) =>

          onChange(event.target.value)

        }

        rows={rows}

        placeholder={placeholder}

        className={`w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 outline-none transition focus:border-neutral-400 ${

          prominent

            ? "text-base font-medium leading-7"

            : "text-sm leading-6"

        }`}

      />

    </div>

  );

}