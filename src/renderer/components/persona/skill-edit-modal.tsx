import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea
} from "@heroui/react";
import type { SkillItem, SkillCreateInput, SkillUpdateInput } from "../../../shared/ipc";

type SkillEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingSkill: SkillItem | null; // null = create mode
  defaultValues?: Partial<SkillItem>; // pre-fill for create mode (e.g. duplicate)
};

export const SkillEditModal = ({ isOpen, onClose, onSaved, editingSkill, defaultValues }: SkillEditModalProps) => {
  const isEditing = editingSkill !== null;
  const source = editingSkill ?? defaultValues;
  const [name, setName] = useState(source?.name ?? "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [tagsStr, setTagsStr] = useState(source?.tags?.join(", ") ?? "");
  const [content, setContent] = useState(source?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) {
      setError("Name and description are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (isEditing) {
        const input: SkillUpdateInput = { description, tags, content };
        const result = await window.api.skillsUpdate(editingSkill.name, input);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      } else {
        const input: SkillCreateInput = { name: name.trim(), description, tags, content };
        const result = await window.api.skillsCreate(input);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>{isEditing ? `Edit: ${editingSkill.name}` : "Create Skill"}</ModalHeader>
        <ModalBody className="space-y-3">
          <Input
            label="Name"
            value={name}
            onValueChange={setName}
            isReadOnly={isEditing}
            placeholder="my-skill"
            description={isEditing ? "Name cannot be changed" : "Use kebab-case (e.g., write-tests)"}
          />
          <Input
            label="Description"
            value={description}
            onValueChange={setDescription}
            placeholder="Brief one-line description"
          />
          <Input
            label="Tags"
            value={tagsStr}
            onValueChange={setTagsStr}
            placeholder="tag1, tag2, tag3"
            description="Comma-separated"
          />
          <Textarea
            label="Content"
            value={content}
            onValueChange={setContent}
            minRows={8}
            maxRows={20}
            placeholder="# My Skill&#10;&#10;Instructions for the agent..."
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            {isEditing ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
