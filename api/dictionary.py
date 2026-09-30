from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.parse
import urllib.request


WIKTAPI_BASE = "https://api.wiktapi.dev/v1/en/word/"


# ---------------------------------------------------------
# WiktAPI
# ---------------------------------------------------------

def fetch_wiktapi(word):

    encoded_word = urllib.parse.quote(word)

    url = (
        WIKTAPI_BASE
        + encoded_word
        + "?lang=ru"
    )

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "BilingualLearningLibrary/1.0"
        }
    )

    with urllib.request.urlopen(
        request,
        timeout=10
    ) as response:

        if response.status != 200:
            raise RuntimeError(
                f"WiktAPI returned HTTP {response.status}"
            )

        return json.loads(
            response.read().decode("utf-8")
        )


# ---------------------------------------------------------
# Extract dictionary information
# ---------------------------------------------------------

def extract_dictionary_entry(data):

    entries = data.get("entries", [])

    if not entries:
        return None

    for entry in entries:

        senses = entry.get("senses", [])

        for sense in senses:

            tags = sense.get("tags", [])

            if any(
                tag in tags
                for tag in [
                    "slang",
                    "rare",
                    "obsolete",
                    "archaic"
                ]
            ):
                continue

            glosses = sense.get("glosses", [])

            if not glosses:
                continue

            english = glosses[0].strip()

            if not english:
                continue

            pronunciation = None

            sounds = entry.get("sounds", [])

            for sound in sounds:

                ipa = sound.get("ipa")

                if ipa:
                    pronunciation = ipa
                    break

            return {
                "word": data.get("word"),
                "english": english,
                "pronunciation": pronunciation
            }

    return None


# ---------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------

def get_supabase_url():

    value = os.environ.get("SUPABASE_URL")

    if not value:
        raise RuntimeError(
            "SUPABASE_URL is not configured"
        )

    return value.rstrip("/")


def get_supabase_key():

    value = os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    )

    if not value:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
        )

    return value


def supabase_request(
    method,
    endpoint,
    body=None,
    prefer=None
):

    headers = {
        "apikey": get_supabase_key(),
        "Authorization":
            "Bearer " + get_supabase_key()
    }

    if body is not None:

        headers["Content-Type"] = (
            "application/json"
        )

    if prefer:

        headers["Prefer"] = prefer

    data = None

    if body is not None:

        data = json.dumps(
            body,
            ensure_ascii=False
        ).encode("utf-8")

    request = urllib.request.Request(
        endpoint,
        data=data,
        method=method,
        headers=headers
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=10
        ) as response:

            raw = response.read().decode(
                "utf-8"
            )

            if not raw:
                return []

            return json.loads(raw)

    except urllib.error.HTTPError as error:

        error_body = (
            error.read()
            .decode(
                "utf-8",
                errors="replace"
            )
        )

        raise RuntimeError(
            f"Supabase HTTP {error.code}: "
            f"{error_body}"
        )


# ---------------------------------------------------------
# Find existing dictionary word
# ---------------------------------------------------------

def find_existing_dictionary_word(word):

    url = get_supabase_url()

    endpoint = (
        url
        + "/rest/v1/dictionary_words"
        + "?select=id,word,tap_text,english,pronunciation"
        + "&learning_language=eq.ru"
        + "&tap_text=eq."
        + urllib.parse.quote(
            word,
            safe=""
        )
        + "&limit=1"
    )

    rows = supabase_request(
        "GET",
        endpoint
    )

    if not rows:
        return None

    return rows[0]


# ---------------------------------------------------------
# Save dictionary word
# ---------------------------------------------------------

def save_dictionary_word(
    word,
    english,
    pronunciation
):

    existing = find_existing_dictionary_word(
        word
    )

    if existing:
        return existing

    url = get_supabase_url()

    endpoint = (
        url
        + "/rest/v1/dictionary_words"
    )

    payload = {
        "learning_language": "ru",
        "word": word,
        "tap_text": word,
        "english": english,
        "pronunciation": pronunciation or ""
    }

    rows = supabase_request(
        "POST",
        endpoint,
        body=payload,
        prefer="return=representation"
    )

    if not rows:
        raise RuntimeError(
            "Supabase returned no dictionary row"
        )

    return rows[0]


# ---------------------------------------------------------
# Save alias
# ---------------------------------------------------------

def save_alias(
    alias,
    dictionary_word_id
):

    url = get_supabase_url()

    endpoint = (
        url
        + "/rest/v1/dictionary_aliases"
    )

    payload = {
        "learning_language": "ru",
        "alias": alias,
        "dictionary_word_id":
            dictionary_word_id
    }

    try:

        return supabase_request(
            "POST",
            endpoint,
            body=payload,
            prefer="resolution=merge-duplicates"
        )

    except Exception as error:

        # Do not make an otherwise successful
        # dictionary lookup fail just because
        # an alias already exists.

        print(
            "Alias save warning:",
            str(error)
        )

        return None


# ---------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------

class handler(BaseHTTPRequestHandler):

    def do_GET(self):

        self.send_json({
            "service":
                "Bilingual Learning Library dictionary",
            "status":
                "ok"
        })


    def do_POST(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(
                body.decode("utf-8")
            )

            word = data.get(
                "word",
                ""
            )

            alias = data.get(
                "alias"
            )

            if not isinstance(
                word,
                str
            ):

                self.send_json({
                    "error":
                        "Word must be a string."
                }, 400)

                return

            word = word.strip().lower()

            if not word:

                self.send_json({
                    "error":
                        "A word is required."
                }, 400)

                return

            if alias is not None:

                if not isinstance(
                    alias,
                    str
                ):

                    self.send_json({
                        "error":
                            "Alias must be a string."
                    }, 400)

                    return

                alias = alias.strip().lower()

            # -------------------------------------------------
            # 1. Ask WiktAPI
            # -------------------------------------------------

            result = fetch_wiktapi(word)

            dictionary_entry = (
                extract_dictionary_entry(
                    result
                )
            )

            if dictionary_entry is None:

                self.send_json({
                    "word": word,
                    "found": False,
                    "saved": False,
                    "entry": None
                })

                return

            # -------------------------------------------------
            # 2. Save the lemma
            # -------------------------------------------------

            saved_row = save_dictionary_word(
                word=
                    dictionary_entry["word"],

                english=
                    dictionary_entry["english"],

                pronunciation=
                    dictionary_entry[
                        "pronunciation"
                    ]
            )

            # -------------------------------------------------
            # 3. Save the tapped form as an alias
            # -------------------------------------------------

            if (
                alias
                and alias != word
            ):

                save_alias(
                    alias=alias,
                    dictionary_word_id=
                        saved_row["id"]
                )

            # -------------------------------------------------
            # 4. Return everything
            # -------------------------------------------------

            self.send_json({
                "word": word,
                "found": True,
                "saved": True,
                "entry": {
                    "id":
                        saved_row.get("id"),

                    "word":
                        dictionary_entry["word"],

                    "english":
                        dictionary_entry["english"],

                    "pronunciation":
                        dictionary_entry[
                            "pronunciation"
                        ]
                }
            })

        except Exception as error:

            print(
                "Dictionary API error:",
                str(error)
            )

            self.send_json({
                "error":
                    str(error)
            }, 500)


    def send_json(
        self,
        payload,
        status=200
    ):

        encoded = json.dumps(
            payload,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Content-Length",
            str(len(encoded))
        )

        self.end_headers()

        self.wfile.write(encoded)