import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch
} from "@heroui/react";
import type { CronJobItem, CronCreateInput } from "../../../shared/ipc";

type AutomationEditModalProps = {
  isOpen: boolean;
  job: CronJobItem | null;
  onClose: () => void;
  onSaved: () => void;
};

const CRON_PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每 5 分钟", value: "*/5 * * * *" },
  { label: "每 15 分钟", value: "*/15 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天上午 9 点", value: "0 9 * * *" },
  { label: "每周一上午 9 点", value: "0 9 * * 1" },
  { label: "自定义", value: "" }
];

const describeCron = (expr: string): string => {
  const preset = CRON_PRESETS.find((p) => p.value === expr && p.value !== "");
  if (preset) return preset.label;
  if (!expr.trim()) return "请输入有效的 Cron 表达式";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Cron 表达式无效（需要 5 个字段）";
  return `自定义计划：${expr}`;
};

const defaultForm = (): CronCreateInput => ({
  name: "",
  description: "",
  prompt: "",
  schedule: "0 * * * *",
  enabled: true,
  mode: "default"
});

export const AutomationEditModal = ({ isOpen, job, onClose, onSaved }: AutomationEditModalProps) => {
  const [form, setForm] = useState<CronCreateInput>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (job) {
        setForm({
          name: job.name,
          description: job.description ?? "",
          prompt: job.prompt,
          schedule: job.schedule,
          enabled: job.enabled,
          modelProfileId: job.modelProfileId,
          mode: job.mode
        });
      } else {
        setForm(defaultForm());
      }
      setError("");
    }
  }, [isOpen, job]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("名称不能为空");
      return;
    }
    if (!form.prompt.trim()) {
      setError("提示词不能为空");
      return;
    }
    if (!form.schedule.trim()) {
      setError("执行计划不能为空");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (job) {
        await window.api.cronUpdate({ id: job.id, ...form });
      } else {
        await window.api.cronCreate(form);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedPreset = CRON_PRESETS.find((p) => p.value === form.schedule)?.value ?? "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{job ? "编辑自动化任务" : "新建自动化任务"}</ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label="名称"
            placeholder="例如：每日站会摘要"
            value={form.name}
            onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
            isRequired
          />
          <Input
            label="描述"
            placeholder="可选，简要说明任务用途"
            value={form.description ?? ""}
            onValueChange={(v) => setForm((f) => ({ ...f, description: v }))}
          />
          <Textarea
            label="提示词"
            placeholder="任务触发时，AI 智能体应执行什么操作？"
            value={form.prompt}
            onValueChange={(v) => setForm((f) => ({ ...f, prompt: v }))}
            minRows={4}
            isRequired
          />
          <div className="flex flex-col gap-2">
            <Select
              label="执行频率预设"
              selectedKeys={selectedPreset ? [selectedPreset] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;
                if (val) setForm((f) => ({ ...f, schedule: val }));
              }}
            >
              {CRON_PRESETS.filter((p) => p.value !== "").map((p) => (
                <SelectItem key={p.value}>{p.label}</SelectItem>
              ))}
            </Select>
            <Input
              label="Cron 表达式"
              placeholder="* * * * *"
              value={form.schedule}
              onValueChange={(v) => setForm((f) => ({ ...f, schedule: v }))}
              description={describeCron(form.schedule)}
              isRequired
            />
          </div>
          <Select
            label="运行模式"
            selectedKeys={form.mode ? [form.mode] : ["default"]}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as "default" | "thinking" | "subagents";
              setForm((f) => ({ ...f, mode: val }));
            }}
          >
            <SelectItem key="default">默认</SelectItem>
            <SelectItem key="thinking">深度思考</SelectItem>
            <SelectItem key="subagents">多智能体</SelectItem>
          </Select>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">启用任务</span>
            <Switch
              isSelected={form.enabled}
              onValueChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
          <Button color="primary" onPress={() => void handleSave()} isLoading={saving}>
            {job ? "保存" : "创建"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
