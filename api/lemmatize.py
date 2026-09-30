from http.server import BaseHTTPRequestHandler
import json
import re

import pymorphy3


morph = pymorphy3.MorphAnalyzer()


def clean_word(value):
    if not isinstance(value, str):
        return ""

    value = value.strip().lower()

    value = re.sub(
        r"^[^а-яё-]+|[^а-яё-]+$",
        "",
        value,
        flags=re.IGNORECASE,
    )

    return value


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            content_length = int(
                self.headers.get("Content-Length", 0)
            )

            body = self.rfile.read(content_length)

            data = json.loads(
                body.decode("utf-8")
            )

            word = clean_word(
                data.get("word", "")
            )

            if not word:
                self.send_json(
                    {
                        "error": "A Russian word is required."
                    },
                    400,
                )
                return

            parses = morph.parse(word)

            if not parses:
                self.send_json(
                    {
                        "word": word,
                        "lemma": None,
                        "candidates": [],
                    }
                )
                return

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

            best = candidates[0] if candidates else None

            self.send_json(
                {
                    "word": word,
                    "lemma": (
                        best["lemma"]
                        if best
                        else None
                    ),
                    "candidates": candidates,
                }
            )

        except Exception as error:
            self.send_json(
                {
                    "error": str(error)
                },
                500,
            )

    def do_GET(self):
        self.send_json(
            {
                "status": "ok",
                "service": "Russian lemmatizer",
            }
        )

    def send_json(
        self,
        payload,
        status=200,
    ):
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )

        self.send_header(
            "Content-Length",
            str(len(encoded)),
        )

        self.end_headers()

        self.wfile.write(encoded)