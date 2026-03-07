export type SkillFrontmatter = {
  name: string;
  description: string;
  tags?: string[];
};

export type SkillEntry = {
  name: string;
  description: string;
  tags: string[];
  content: string;
  sourcePath: string;
};
