export type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;

  source_language: string;
  learning_language: string;

  level: string;
  category:
    | "everyday"
    | "travel"
    | "mystery"
    | "romance"
    | "adventure"
    | "food";

  estimated_minutes: number | null;
  cover_image_path: string | null;

  status: "draft" | "published";
  sort_order: number;

    content_type:
    | "original"
    | "classic";

  access_tier:
    | "free"
    | "plus";

  original_author: string | null;
  original_author: string | null;
  original_publication_year: number | null;
  source_title: string | null;
  source_url: string | null;
  adaptation_note: string | null;

  created_at: string;
  updated_at: string;
  published_at: string | null;
};