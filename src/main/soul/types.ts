export type IdentityData = {
  name: string;
  tagline?: string;
  content: string;
};

export type SoulContext = {
  soul?: { content: string };
  identity?: IdentityData;
};
