import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AdaptRequest = {
  sentences?: string[];
  learningLanguage?: string;
  level?: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  ru: "Russian",
  es: "Spanish",
  fr: "French",
  de: "German",
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as AdaptRequest;

    const sentences = body.sentences ?? [];
    const learningLanguage = body.learningLanguage ?? "ru";
    const level = body.level ?? "B2";

    if (!Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        {
          error: "No sentences were supplied.",
        },
        { status: 400 }
      );
    }

    if (sentences.length > 20) {
      return NextResponse.json(
        {
          error: "A maximum of 20 sentences can be processed at once.",
        },
        { status: 400 }
      );
    }

    const targetLanguage =
      LANGUAGE_NAMES[learningLanguage] ?? "Russian";

    const openai = new OpenAI({
      apiKey,
    });

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      instructions: `
You are preparing a classic work of literature for DUAL LANGUAGE LIBRARY,
a language-learning reading application.

The original English text must remain recognisable as the author's story,
but the adapted English should be suitable for a ${level} English reader.

For every supplied sentence:

1. Produce an adapted English version.
2. Preserve the original meaning, facts, characters, tone, and story continuity.
3. Simplify unnecessarily archaic or difficult Victorian wording.
4. Do not invent events, dialogue, descriptions, or explanations.
5. Preserve dialogue as dialogue.
6. Do not censor or modernise the plot.
7. Keep names, places, clues, dates, amounts, and important details accurate.
8. Prefer natural modern English over archaic constructions.
9. Do not oversimplify the prose into childish English.
10. Translate the adapted English naturally into ${targetLanguage}.
11. The translation must reflect the adapted English, not independently rewrite the story.

Return exactly one result for every input sentence and preserve the original order.
      `.trim(),

      input: JSON.stringify(
        sentences.map((sentence, index) => ({
          index,
          original: sentence,
        }))
      ),

      text: {
        format: {
          type: "json_schema",
          name: "adapted_sentences",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sentences: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: {
                      type: "integer",
                    },
                    adaptedEnglish: {
                      type: "string",
                    },
                    translation: {
                      type: "string",
                    },
                  },
                  required: [
                    "index",
                    "adaptedEnglish",
                    "translation",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["sentences"],
            additionalProperties: false,
          },
        },
      },
    });

    const outputText = response.output_text;

    if (!outputText) {
      throw new Error("OpenAI returned an empty response.");
    }

    const parsed = JSON.parse(outputText);

    if (!Array.isArray(parsed.sentences)) {
      throw new Error("OpenAI returned an unexpected response.");
    }

    if (parsed.sentences.length !== sentences.length) {
      throw new Error(
        `Expected ${sentences.length} results but received ${parsed.sentences.length}.`
      );
    }

    return NextResponse.json({
      success: true,
      model: "gpt-5.6-luna",
      targetLanguage,
      level,
      sentences: parsed.sentences,
    });
  } catch (error) {
    console.error("Adapt chapter API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown adaptation error.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}