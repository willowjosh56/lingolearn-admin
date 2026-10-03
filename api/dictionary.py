from http.server import BaseHTTPRequestHandler
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import simplemma
import pymorphy3
# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
WIKTAPI_BASE = "https://api.wiktapi.dev/v1/en/word/"
# ---------------------------------------------------------
# Russian
# ---------------------------------------------------------
russian_morph = pymorphy3.MorphAnalyzer()
# ---------------------------------------------------------
# Language Helpers
# ---------------------------------------------------------
SUPPORTED_LANGUAGES = {
    "ru",
    "es",
    "fr",
    "de",
}
def normalize_language(language):
    if not isinstance(language, str):
        return "ru"
    language = language.strip().lower()
    aliases = {
        "russian": "ru",
        "spanish": "es",
        "french": "fr",
        "german": "de",
    }
    return aliases.get(
        language,
        language
    )
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
            r"^[^a-zàâäæçéèêëîïôœùûüÿ-]+|[^a-zàâäæçéèêëîïôœùûüÿ-]+$",
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
# Lemmatization
# ---------------------------------------------------------
def lemmatize_word(word, language):
    # Russian
    if language == "ru":
        parses = russian_morph.parse(word)
        if not parses:
            return word
        return parses[0].normal_form
    # Spanish / French / German
    if language in {
    "es",
    "fr",
    "de",
}:
        lemma = simplemma.lemmatize(
            word,
            lang=language,
        )
        if lemma:
            return lemma
        return word
    return word
# ---------------------------------------------------------
# WiktAPI
# ---------------------------------------------------------
def fetch_wiktapi(word, language):
    encoded_word = urllib.parse.quote(
        word
    )
    url = (
        WIKTAPI_BASE
        + encoded_word
        + "?lang="
        + urllib.parse.quote(language)
    )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "DualLanguageLibrary/1.0",
        },
    )
    with urllib.request.urlopen(
        request,
        timeout=10,
    ) as response:
        if response.status != 200:
            raise RuntimeError(
                f"WiktAPI returned HTTP {response.status}"
            )
        return json.loads(
            response.read().decode(
                "utf-8"
            )
        )
# ---------------------------------------------------------
# Extract Dictionary Information
# ---------------------------------------------------------
def extract_dictionary_entry(data):
    entries = data.get("entries", [])
    if not entries:
        return None
    # Proper nouns are identified by WiktAPI/Wiktextract with pos == "name".
    # Return a simple learner-friendly label before considering normal senses.
    for entry in entries:
        if entry.get("pos") != "name":
            continue
        pronunciation = None
        for sound in entry.get("sounds", []):
            ipa = sound.get("ipa")
            if ipa:
                pronunciation = ipa
                break
        return {
            "word": entry.get("word") or data.get("word"),
            "english": "NAME",
            "pronunciation": pronunciation,
        }
    candidates = []
    for entry in entries:
        sounds = entry.get("sounds", [])
        pronunciation = None
        for sound in sounds:
            ipa = sound.get("ipa")
            if ipa:
                pronunciation = ipa
                break
        senses = entry.get("senses", [])
        for sense in senses:
            tags = set(sense.get("tags", []))
            excluded_tags = {
                "slang",
                "rare",
                "obsolete",
                "archaic",
                "vulgar",
                "offensive",
                "derogatory",
            }
            if tags.intersection(excluded_tags):
                continue
            glosses = sense.get("glosses", [])
            for gloss in glosses:
                if not isinstance(gloss, str):
                    continue
                english = gloss.strip()
                if not english:
                    continue
                if len(english) > 140:
                    continue
                lower = english.lower()
                # Skip grammatical descriptions.
                grammatical_terms = [
                    "third-person",
                    "first-person",
                    "second-person",
                    "singular",
                    "plural",
                    "indicative",
                    "subjunctive",
                    "imperative",
                    "infinitive",
                    "participle",
                    "gerund",
                    "conjugated form",
                    "conjugation",
                    "declension",
                    "past tense",
                    "present tense",
                    "future tense",
                    "imperfect tense",
                    "perfect tense",
                    "of parler",
                    "of manger",
                ]
                grammatical_count = sum(
                    term in lower
                    for term in grammatical_terms
                )
                if grammatical_count >= 2:
                    continue
                # Skip technical linguistic explanations.
                technical_terms = [
                    "transitive",
                    "intransitive",
                    "imperfective",
                    "perfective",
                    "genitive",
                    "dative",
                    "instrumental",
                    "prepositional",
                    "nominative",
                    "accusative",
                    "vocative",
                    "locative",
                ]
                technical_count = sum(
                    term in lower
                    for term in technical_terms
                )
                if technical_count >= 2:
                    continue
                # Score learner-friendly meanings.
                score = 100
                if len(english) <= 30:
                    score += 30
                elif len(english) <= 60:
                    score += 15
                if "," in english:
                    score += 5
                if "(" in english:
                    score -= 10
                if ";" in english:
                    score -= 5
                if "vernacular" in lower:
                    score -= 40
                if "dialect" in lower:
                    score -= 40
                if "foodstuff" in lower:
                    score -= 20
                candidates.append(
                    {
                        "english": english,
                        "pronunciation": pronunciation,
                        "score": score,
                    }
                )
    if not candidates:
        return None
    candidates.sort(
        key=lambda item: item["score"],
        reverse=True,
    )
    best = candidates[0]
    return {
        "word": data.get("word"),
        "english": best["english"],
        "pronunciation": best["pronunciation"],
    }
# ---------------------------------------------------------
# Supabase Helpers
# ---------------------------------------------------------
def get_supabase_url():
    value = os.environ.get(
        "SUPABASE_URL"
    )
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
    prefer=None,
):
    headers = {
        "apikey":
            get_supabase_key(),
        "Authorization":
            "Bearer "
            + get_supabase_key(),
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
            ensure_ascii=False,
        ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=10,
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
                errors="replace",
            )
        )
        raise RuntimeError(
            f"Supabase HTTP {error.code}: "
            f"{error_body}"
        )
# ---------------------------------------------------------
# Find Existing Dictionary Word
# ---------------------------------------------------------
def find_existing_dictionary_word(
    word,
    language,
):
    url = get_supabase_url()
    endpoint = (
        url
        + "/rest/v1/dictionary_words"
        + "?select=id,word,tap_text,english,pronunciation"
        + "&learning_language=eq."
        + urllib.parse.quote(
            language,
            safe="",
        )
        + "&tap_text=eq."
        + urllib.parse.quote(
            word,
            safe="",
        )
        + "&limit=1"
    )
    rows = supabase_request(
        "GET",
        endpoint,
    )
    if not rows:
        return None
    return rows[0]
# ---------------------------------------------------------
# Save Dictionary Word
# ---------------------------------------------------------
def save_dictionary_word(
    word,
    english,
    pronunciation,
    language,
):
    existing = find_existing_dictionary_word(
        word,
        language,
    )
    if existing:
        return existing
    url = get_supabase_url()
    endpoint = (
        url
        + "/rest/v1/dictionary_words"
    )
    payload = {
        "learning_language":
            language,
        "word":
            word,
        "tap_text":
            word,
        "english":
            english,
        "pronunciation":
            pronunciation or "",
    }
    rows = supabase_request(
        "POST",
        endpoint,
        body=payload,
        prefer="return=representation",
    )
    if not rows:
        raise RuntimeError(
            "Supabase returned no dictionary row"
        )
    return rows[0]
# ---------------------------------------------------------
# Save Alias
# ---------------------------------------------------------
def save_alias(
    alias,
    dictionary_word_id,
    language,
):
    url = get_supabase_url()
    endpoint = (
        url
        + "/rest/v1/dictionary_aliases"
    )
    payload = {
        "learning_language":
            language,
        "alias":
            alias,
        "dictionary_word_id":
            dictionary_word_id,
    }
    try:
        return supabase_request(
            "POST",
            endpoint,
            body=payload,
            prefer="resolution=merge-duplicates",
        )
    except Exception as error:
        print(
            "Alias save warning:",
            str(error),
        )
        return None
# ---------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------
class handler(
    BaseHTTPRequestHandler
):
    # -----------------------------------------------------
    # GET
    # -----------------------------------------------------
    def do_GET(self):
        self.send_json({
            "service":
                "Dual Language Library dictionary",
            "status":
                "ok",
            "languages": [
                "ru",
                "es",
                "fr",
                 "de"
            ],
        })
    # -----------------------------------------------------
    # POST
    # -----------------------------------------------------
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
            word = data.get(
                "word",
                "",
            )
            alias = data.get(
                "alias"
            )
            language = normalize_language(
                data.get(
                    "language",
                    "ru",
                )
            )
            # -------------------------------------------------
            # Validate language
            # -------------------------------------------------
            if language not in SUPPORTED_LANGUAGES:
                self.send_json(
                    {
                        "error":
                            "Unsupported language.",
                        "supportedLanguages":
                            [
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
            # Validate word
            # -------------------------------------------------
            if not isinstance(
                word,
                str,
            ):
                self.send_json(
                    {
                        "error":
                            "Word must be a string.",
                    },
                    400,
                )
                return
            word = clean_word(
                word,
                language,
            )
            if not word:
                self.send_json(
                    {
                        "error":
                            "A word is required.",
                    },
                    400,
                )
                return
            # -------------------------------------------------
            # Validate alias
            # -------------------------------------------------
            if alias is not None:
                if not isinstance(
                    alias,
                    str,
                ):
                    self.send_json(
                        {
                            "error":
                                "Alias must be a string.",
                        },
                        400,
                    )
                    return
                alias = clean_word(
                    alias,
                    language,
                )
            # -------------------------------------------------
            # 1. Lemmatize the supplied word
            # -------------------------------------------------
            lemma = lemmatize_word(
                word,
                language,
            )
            lemma = clean_word(
                lemma,
                language,
            )
            if not lemma:
                lemma = word
            # -------------------------------------------------
            # 2. Look up the lemma
            # -------------------------------------------------
            result = fetch_wiktapi(
                lemma,
                language,
            )
            dictionary_entry = (
                extract_dictionary_entry(
                    result
                )
            )
            # -------------------------------------------------
            # Fallback to original word
            # -------------------------------------------------
            if (
                dictionary_entry is None
                and lemma != word
            ):
                result = fetch_wiktapi(
                    word,
                    language,
                )
                dictionary_entry = (
                    extract_dictionary_entry(
                        result
                    )
                )
                if dictionary_entry:
                    lemma = word
            # -------------------------------------------------
            # Dictionary entry not found
            # -------------------------------------------------
            if dictionary_entry is None:
                self.send_json(
                    {
                        "word":
                            word,
                        "lemma":
                            lemma,
                        "found":
                            False,
                        "saved":
                            False,
                        "entry":
                            None,
                        "language":
                            language,
                    }
                )
                return
            # -------------------------------------------------
            # 3. Save dictionary headword
            # -------------------------------------------------
            dictionary_word = clean_word(
                dictionary_entry["word"],
                language,
            )
            saved_row = save_dictionary_word(
                word=dictionary_word,
                english=dictionary_entry["english"],
                pronunciation=dictionary_entry["pronunciation"],
                language=language,
            )
            # -------------------------------------------------
            # 4. Save supplied word as alias
            # -------------------------------------------------
            if (
                word != dictionary_word
            ):
                save_alias(
                    alias=word,
                    dictionary_word_id=saved_row["id"],
                    language=language,
                )
            # -------------------------------------------------
            # 5. Save explicit alias
            # -------------------------------------------------
            if (
                alias
                and alias != dictionary_word
                and alias != word
            ):
                save_alias(
                    alias=alias,
                    dictionary_word_id=saved_row["id"],
                    language=language,
                )
            # -------------------------------------------------
            # 6. Return result
            # -------------------------------------------------
            self.send_json(
                {
                    "word":
                        word,
                    "lemma":
                        dictionary_word,
                    "found":
                        True,
                    "saved":
                        True,
                    "language":
                        language,
                    "entry":
                        {
                            "id":
                                saved_row.get(
                                    "id"
                                ),
                            "word":
                                dictionary_word,
                            "english":
                                dictionary_entry[
                                    "english"
                                ],
                            "pronunciation":
                                dictionary_entry[
                                    "pronunciation"
                                ],
                        },
                }
            )
        except Exception as error:
            print(
                "Dictionary API error:",
                str(error),
            )
            self.send_json(
                {
                    "error":
                        str(error),
                },
                500,
            )
    # -----------------------------------------------------
    # JSON Response
    # -----------------------------------------------------
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
