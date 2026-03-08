import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, Chip, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Play, Pencil, Trash2, ChevronDown, ChevronRight, Clock } from "lucide-react";
import type { CronJobItem, CronRunRecord } from "../../../shared/ipc";
import { AutomationEditModal } from "./automation-edit-modal";

const formatTime = (ts?: number): string => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
};

const statusColor = (status: CronRunRecord["status"]): "success" | "danger" | "warning" | "default" => {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "warning";
};

const statusLabel = (status: CronRunRecord["status"]): string => {
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return "运行中";
};

const formatDuration = (startedAt: number, completedAt?: number): string => {
  if (!completedAt) return "";
  const ms = completedAt - startedAt;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

type RunDetailModalProps = {
  record: CronRunRecord | null;
  onClose: () => void;
};

const RunDetailModal = ({ record, onClose }: RunDetailModalProps) => (
  <Modal isOpen={!!record} onClose={onClose} size="2xl" scrollBehavior="inside">
    <ModalContent>
      <ModalHeader className="flex items-center gap-3">
        {record && (
          <Chip size="sm" color={statusColor(record.status)} variant="flat">
            {statusLabel(record.status)}
          </Chip>
        )}
        <span className="text-base font-semibold">运行详情</span>
      </ModalHeader>
      <ModalBody className="gap-3">
        {record && (
          <>
            <div className="flex gap-6 text-xs text-gray-500">
              <span>开始时间：{formatTime(record.startedAt)}</span>
              {record.completedAt && (
                <>
                  <span>结束时间：{formatTime(record.completedAt)}</span>
                  <span>耗时：{formatDuration(record.startedAt, record.completedAt)}</span>
                </>
              )}
            </div>
            {record.output ? (
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-y-auto font-mono leading-relaxed">
                {record.output}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">暂无输出内容</p>
            )}
            {record.error && (
              <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-700 whitespace-pre-wrap break-words font-mono">
                {record.error}
              </pre>
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="flat" onPress={onClose}>关闭</Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
);

const RunHistoryRow = ({ record, onViewDetail }: { record: CronRunRecord; onViewDetail: (r: CronRunRecord) => void }) => (
  <div
    className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors"
    onClick={() => onViewDetail(record)}
  >
    <Chip size="sm" color={statusColor(record.status)} variant="flat" className="shrink-0 mt-0.5">
      {statusLabel(record.status)}
    </Chip>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3">
        <p className="text-gray-500 text-xs">{formatTime(record.startedAt)}</p>
        {record.completedAt && (
          <p className="text-gray-400 text-xs">{formatDuration(record.startedAt, record.completedAt)}</p>
        )}
      </div>
      {record.output && (
        <p className="text-gray-700 mt-1 truncate max-w-full text-xs">{record.output.slice(0, 120)}</p>
      )}
      {record.error && <p className="text-red-500 mt-1 truncate text-xs">{record.error}</p>}
    </div>
    <span className="text-xs text-gray-400 shrink-0 self-center">查看 →</span>
  </div>
);

type JobCardProps = {
  job: CronJobItem;
  onEdit: (job: CronJobItem) => void;
  onDelete: (id: string) => void;
  onToggle: (job: CronJobItem) => void;
  onRunNow: (id: string) => void;
  liveRecords: CronRunRecord[];
};

const JobCard = ({ job, onEdit, onDelete, onToggle, onRunNow, liveRecords }: JobCardProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<CronRunRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CronRunRecord | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const result = await window.api.cronHistory({ jobId: job.id, limit: 20 });
      setHistory(result.records);
    } finally {
      setLoadingHistory(false);
    }
  }, [job.id]);

  useEffect(() => {
    if (historyOpen) {
      void loadHistory();
    }
  }, [historyOpen, loadHistory]);

  // Merge live records into history
  const mergedHistory = (() => {
    const map = new Map<string, CronRunRecord>();
    for (const r of history) map.set(r.id, r);
    for (const r of liveRecords) map.set(r.id, r);
    return Array.from(map.values()).sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  })();

  const handleRunNow = async () => {
    setRunning(true);
    setRunError("");
    try {
      await onRunNow(job.id);
      if (historyOpen) await loadHistory();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "运行失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="mb-3">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{job.name}</span>
              <Chip size="sm" variant="flat" className="font-mono text-xs">
                {job.schedule}
              </Chip>
              {!job.enabled && (
                <Chip size="sm" color="default" variant="flat">
                  已禁用
                </Chip>
              )}
            </div>
            {job.description && (
              <p className="text-sm text-gray-500 mt-0.5">{job.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              {job.lastRunAt && <span>上次运行：{formatTime(job.lastRunAt)}</span>}
              {job.nextRunAt && <span>下次运行：{formatTime(job.nextRunAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              size="sm"
              isSelected={job.enabled}
              onValueChange={() => onToggle(job)}
              aria-label="Enable job"
            />
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              isLoading={running}
              onPress={() => void handleRunNow()}
              title="立即运行"
            >
              <Play size={14} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              onPress={() => onEdit(job)}
              title="编辑"
            >
              <Pencil size={14} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="danger"
              isIconOnly
              onPress={() => onDelete(job.id)}
              title="删除"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {runError && <p className="mt-2 text-xs text-red-500">{runError}</p>}

        <button
          className="flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          运行历史
        </button>

        {historyOpen && (
          <div className="mt-2 max-h-60 overflow-y-auto">
            {loadingHistory ? (
              <p className="text-xs text-gray-400 py-2">加载中...</p>
            ) : mergedHistory.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">暂无运行记录</p>
            ) : (
              mergedHistory.map((r) => (
                <RunHistoryRow key={r.id} record={r} onViewDetail={setSelectedRecord} />
              ))
            )}
          </div>
        )}
      </CardBody>

      <RunDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </Card>
  );
};

export const AutomationManager = () => {
  const [jobs, setJobs] = useState<CronJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJobItem | null>(null);
  const [liveRecords, setLiveRecords] = useState<Map<string, CronRunRecord[]>>(new Map());
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.cronList();
      setJobs(result.jobs);
      setMessage("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unlisten = window.api.onCronRunEvent((event) => {
      setLiveRecords((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.jobId) ?? [];
        const idx = existing.findIndex((r) => r.id === event.record.id);
        if (idx >= 0) {
          existing[idx] = event.record;
        } else {
          existing.unshift(event.record);
        }
        next.set(event.jobId, existing.slice(0, 20));
        return next;
      });
      // Refresh job list to update lastRunAt/nextRunAt
      void load();
    });
    return unlisten;
  }, [load]);

  const handleEdit = (job: CronJobItem) => {
    setEditingJob(job);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingJob(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除此自动化任务？此操作不可撤销。")) return;
    try {
      await window.api.cronDelete({ id });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleToggle = async (job: CronJobItem) => {
    try {
      await window.api.cronUpdate({ id: job.id, enabled: !job.enabled });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "切换状态失败");
    }
  };

  const handleRunNow = async (id: string) => {
    await window.api.cronRunNow({ id });
  };

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">加载中...</p>;
  }

  return (
    <div>
      {message && <p className="mb-3 text-sm text-red-500">{message}</p>}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {jobs.length === 0 ? "暂无自动化任务" : `共 ${jobs.length} 个自动化任务`}
        </p>
        <Button color="primary" size="sm" onPress={handleNew} startContent={<Clock size={14} />}>
          新建任务
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">创建您的第一个自动化任务，让 AI 定时为您工作。</p>
        </div>
      ) : (
        jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onEdit={handleEdit}
            onDelete={(id) => void handleDelete(id)}
            onToggle={(j) => void handleToggle(j)}
            onRunNow={handleRunNow}
            liveRecords={liveRecords.get(job.id) ?? []}
          />
        ))
      )}

      <AutomationEditModal
        isOpen={modalOpen}
        job={editingJob}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
};
