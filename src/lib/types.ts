export type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  source_language: string;
  learning_language: string;
  level: string;
  estimated_minutes: number | null;
  cover_image_path: string | null;
  status: "draft" | "published";
  sort_order: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};