export interface Diary {
  id: string;
  title: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export interface Entry {
  id: string;
  diary_id: string;
  content: string;
  topic_id?: string;
  archived: boolean;
  bookmarked: boolean;
  preview_hidden: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  removed_at?: Date;
  version: number;
}

export interface Topic {
  id: string;
  diary_id: string;
  title: string;
  description: string;
  color: string;
  default_template_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  removed_at?: Date;
  version: number;
}

export interface Template {
  id: string;
  diary_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  removed_at?: Date;
  version: number;
}

export interface EncryptionKey {
  id: string;
  value: Uint8Array;
  status: "active" | "rotating" | "rotated";
}
