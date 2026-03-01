import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Switch } from "@heroui/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { SkillItem } from "../../../shared/ipc";
import { SkillEditModal } from "./skill-edit-modal";

export const SkillsManager = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [duplicateDefaults, setDuplicateDefaults] = useState<Partial<SkillItem> | undefined>(undefined);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.skillsList();
      setSkills(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = () => {
    setEditingSkill(null);
    setDuplicateDefaults(undefined);
    setModalOpen(true);
  };

  const handleEdit = (skill: SkillItem) => {
    setEditingSkill(skill);
    setDuplicateDefaults(undefined);
    setModalOpen(true);
  };

  const handleDelete = async (name: string) => {
    try {
      const result = await window.api.skillsDelete(name);
      if (result.ok) {
        await load();
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleDuplicate = (skill: SkillItem) => {
    setEditingSkill(null);
    setDuplicateDefaults({
      name: `${skill.name}-custom`,
      description: skill.description,
      tags: skill.tags,
      content: skill.content
    });
    setModalOpen(true);
  };

  const handleToggle = async (skill: SkillItem) => {
    try {
      const result = await window.api.skillsToggle({ name: skill.name, enabled: !skill.enabled });
      if (result.ok) {
        await load();
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Toggle failed");
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Skills</h3>
          <Button color="primary" variant="flat" size="sm" startContent={<Plus size={14} />} onPress={handleCreate}>
            New Skill
          </Button>
        </CardHeader>
        <CardBody className="space-y-2">
          {skills.length === 0 ? (
            <p className="text-sm text-gray-500">No skills loaded</p>
          ) : (
            skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{skill.name}</span>
                    {skill.isBundled ? (
                      <Chip size="sm" variant="flat" color="default">
                        built-in
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="primary">
                        custom
                      </Chip>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{skill.description}</p>
                  {skill.tags.length > 0 ? (
                    <div className="flex gap-1 mt-1">
                      {skill.tags.map((tag) => (
                        <Chip key={tag} size="sm" variant="dot" className="text-[10px]">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Switch
                    size="sm"
                    isSelected={skill.enabled}
                    onValueChange={() => { void handleToggle(skill); }}
                    title={skill.enabled ? "Disable" : "Enable"}
                  />
                  {skill.isBundled ? (
                    <Button
                      size="sm"
                      variant="light"
                      onPress={() => handleDuplicate(skill)}
                      title="Duplicate as custom"
                    >
                      Copy
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        onPress={() => handleEdit(skill)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        isIconOnly
                        onPress={() => { void handleDelete(skill.name); }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {message ? <p className="text-sm text-gray-600 mt-2">{message}</p> : null}
        </CardBody>
      </Card>

      {modalOpen ? (
        <SkillEditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={() => { void load(); }}
          editingSkill={editingSkill?.isBundled ? null : editingSkill}
          defaultValues={duplicateDefaults}
        />
      ) : null}
    </div>
  );
};
