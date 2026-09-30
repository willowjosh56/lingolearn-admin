from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request


WIKTAPI_BASE = "https://api.wiktapi.dev/v1/en/word/"


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


def extract_dictionary_entry(data):

    entries = data.get("entries", [])

    if not entries:
        return None


    for entry in entries:

        senses = entry.get("senses", [])

        for sense in senses:

            glosses = sense.get("glosses", [])

            if not glosses:
                continue


            english = glosses[0].strip()

            if not english:
                continue


            pronunciation = None

            sounds = entry.get(
                "sounds",
                []
            )

            for sound in sounds:

                ipa = sound.get("ipa")

                if ipa:
                    pronunciation = ipa
                    break


            return {
                "word": data.get(
                    "word"
                ),

                "english": english,

                "pronunciation":
                    pronunciation
            }


    return None


class handler(BaseHTTPRequestHandler):

    def do_GET(self):

        self.send_json(
            {
                "service":
                    "Bilingual Learning Library dictionary",

                "status":
                    "ok"
            }
        )


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


            if not isinstance(
                word,
                str
            ):

                self.send_json(
                    {
                        "error":
                            "Word must be a string."
                    },
                    400
                )

                return


            word = word.strip()


            if not word:

                self.send_json(
                    {
                        "error":
                            "A word is required."
                    },
                    400
                )

                return


            result = fetch_wiktapi(
                word
            )


            dictionary_entry = extract_dictionary_entry(result)


            if dictionary_entry is None:

                self.send_json(
                    {
                        "word": word,
                        "found": False,
                        "entry": None
                    }
                )

                return


            self.send_json(
                {
                    "word": word,
                    "found": True,
                    "entry":
                        dictionary_entry
                }
            )


        except Exception as error:

            print(
                "Dictionary API error:",
                str(error)
            )


            self.send_json(
                {
                    "error":
                        str(error)
                },
                500
            )


    def send_json(
        self,
        payload,
        status=200
    ):

        encoded = json.dumps(
            payload,
            ensure_ascii=False
        ).encode("utf-8")


        self.send_response(
            status
        )


        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )


        self.send_header(
            "Content-Length",
            str(len(encoded))
        )


        self.end_headers()


        self.wfile.write(
            encoded
        )