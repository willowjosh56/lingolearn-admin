from http.server import BaseHTTPRequestHandler

import json
import re

import pymorphy3
import simplemma


# ---------------------------------------------------------
# Russian
# ---------------------------------------------------------

russian_morph = pymorphy3.MorphAnalyzer()


# ---------------------------------------------------------
# Word Cleaning
# ---------------------------------------------------------

def clean_word(value, language):

    if not isinstance(value, str):
        return ""

    value = value.strip().lower()

    if language == "ru":

        value = re.sub(
            r"^[^а-яё-]+|[^а-яё-]+$",
            "",
            value,
            flags=re.IGNORECASE,
        )

    elif language == "es":

        value = re.sub(
            r"^[^a-záéíóúüñ-]+|[^a-záéíóúüñ-]+$",
            "",
            value,
            flags=re.IGNORECASE,
        )

    elif language == "fr":

        value = re.sub(
            r"^[^a-zàâäæçéèêëîïôœùûüÿ-]+|[^a-zàâäæçéèêëîïôœùüÿ-]+$",
            "",
            value,
            flags=re.IGNORECASE,
        )

    elif language == "de":

        value = re.sub(
            r"^[^a-zäöüß-]+|[^a-zäöüß-]+$",
            "",
            value,
            flags=re.IGNORECASE,
        )

    return value


# ---------------------------------------------------------
# Russian Lemmatizer
# ---------------------------------------------------------

def lemmatize_russian(word):

    parses = russian_morph.parse(word)

    if not parses:

        return {
            "word": word,
            "lemma": None,
            "candidates": [],
        }

    candidates = []

    seen = set()

    for parse in parses[:5]:

        lemma = parse.normal_form

        if lemma in seen:
            continue

        seen.add(lemma)

        candidates.append(
            {
                "lemma": lemma,
                "score": float(parse.score),
                "tag": str(parse.tag),
            }
        )

    best = (
        candidates[0]
        if candidates
        else None
    )

    return {
        "word": word,
        "lemma": (
            best["lemma"]
            if best
            else None
        ),
        "candidates": candidates,
    }


# ---------------------------------------------------------
# Spanish Lemmatizer
# ---------------------------------------------------------

def lemmatize_spanish(word):

    lemma = simplemma.lemmatize(
        word,
        lang="es",
    )

    if not lemma:
        lemma = None

    candidates = []

    if lemma:

        candidates.append(
            {
                "lemma": lemma,
                "score": 1.0,
                "tag": "simplemma",
            }
        )

    return {
        "word": word,
        "lemma": lemma,
        "candidates": candidates,
    }


# ---------------------------------------------------------
# French Lemmatizer
# ---------------------------------------------------------

def lemmatize_french(word):

    lemma = simplemma.lemmatize(
        word,
        lang="fr",
    )

    if not lemma:
        lemma = None

    candidates = []

    if lemma:

        candidates.append(
            {
                "lemma": lemma,
                "score": 1.0,
                "tag": "simplemma",
            }
        )

    return {
        "word": word,
        "lemma": lemma,
        "candidates": candidates,
    }


# ---------------------------------------------------------
# German Lemmatizer
# ---------------------------------------------------------

def lemmatize_german(word):

    lemma = simplemma.lemmatize(
        word,
        lang="de",
    )

    if not lemma:
        lemma = None

    candidates = []

    if lemma:

        candidates.append(
            {
                "lemma": lemma,
                "score": 1.0,
                "tag": "simplemma",
            }
        )

    return {
        "word": word,
        "lemma": lemma,
        "candidates": candidates,
    }


# ---------------------------------------------------------
# Request Handler
# ---------------------------------------------------------

class handler(BaseHTTPRequestHandler):

    def do_POST(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0,
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(
                body.decode("utf-8")
            )


            # -------------------------------------------------
            # Language
            # -------------------------------------------------

            language = data.get(
                "language",
                "ru",
            )

            language = str(
                language
            ).strip().lower()


            # Accept full language names too.

            if language == "russian":

                language = "ru"

            elif language == "spanish":

                language = "es"

            elif language == "french":

                language = "fr"

            elif language == "german":

                language = "de"


            # -------------------------------------------------
            # Validate language
            # -------------------------------------------------

            if language not in {
                "ru",
                "es",
                "fr",
                "de",
            }:

                self.send_json(
                    {
                        "error":
                            "Unsupported language.",

                        "supportedLanguages": [
                            "ru",
                            "es",
                            "fr",
                            "de",
                        ],
                    },
                    400,
                )

                return


            # -------------------------------------------------
            # Clean word
            # -------------------------------------------------

            word = clean_word(
                data.get(
                    "word",
                    "",
                ),
                language,
            )


            if not word:

                if language == "ru":

                    message = (
                        "A Russian word is required."
                    )

                elif language == "es":

                    message = (
                        "A Spanish word is required."
                    )

                elif language == "fr":

                    message = (
                        "A French word is required."
                    )

                else:

                    message = (
                        "A German word is required."
                    )


                self.send_json(
                    {
                        "error": message
                    },
                    400,
                )

                return


            # -------------------------------------------------
            # Russian
            # -------------------------------------------------

            if language == "ru":

                result = lemmatize_russian(
                    word
                )

                result["language"] = "ru"

                self.send_json(
                    result
                )

                return


            # -------------------------------------------------
            # Spanish
            # -------------------------------------------------

            if language == "es":

                result = lemmatize_spanish(
                    word
                )

                result["language"] = "es"

                self.send_json(
                    result
                )

                return


            # -------------------------------------------------
            # French
            # -------------------------------------------------

            if language == "fr":

                result = lemmatize_french(
                    word
                )

                result["language"] = "fr"

                self.send_json(
                    result
                )

                return


            # -------------------------------------------------
            # German
            # -------------------------------------------------

            if language == "de":

                result = lemmatize_german(
                    word
                )

                result["language"] = "de"

                self.send_json(
                    result
                )

                return


        except Exception as error:

            self.send_json(
                {
                    "error": str(error)
                },
                500,
            )


    # ---------------------------------------------------------
    # GET
    # ---------------------------------------------------------

    def do_GET(self):

        self.send_json(
            {
                "status": "ok",

                "service":
                    "Multilingual lemmatizer",

                "languages": [
                    "ru",
                    "es",
                    "fr",
                    "de",
                ],
            }
        )


    # ---------------------------------------------------------
    # JSON Response
    # ---------------------------------------------------------

    def send_json(
        self,
        payload,
        status=200,
    ):

        encoded = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8")


        self.send_response(
            status
        )


        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )


        self.send_header(
            "Content-Length",
            str(len(encoded)),
        )


        self.end_headers()


        self.wfile.write(
            encoded
        )