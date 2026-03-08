export type UserFileRecord = {
  id: string;
  file_path: string;
  size_bytes: number;
  mime_type: string | null;
  viking_uri: string | null;
  viking_synced_at: number | null;
  created_at: number;
  updated_at: number;
};

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  mimeType?: string;
  createdAt?: number;
  updatedAt?: number;
};
