import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input, Textarea } from "@heroui/react";
import { Pencil, Eye, Sparkles, RotateCcw, Save } from "lucide-react";
import Markdown from "react-markdown";
import type { SoulState } from "../../../shared/ipc";
import { SoulInterviewModal } from "./soul-interview-modal";

const mdClass =
  "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-2.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-gray-600 [&_hr]:my-3 [&_hr]:border-gray-200";

export const SoulEditor = () => {
  const [state, setState] = useState<SoulState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [soulEditMode, setSoulEditMode] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.soulGet();
      setState(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load soul");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading...</div>;
  }

  if (!state) {
    return <div className="p-4 text-sm text-red-500">Failed to load soul state</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await window.api.soulUpdate({
        soulContent: state.soulContent,
        identityContent: state.identityContent
      });
      setMessage(result.ok ? "Saved" : result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await window.api.soulReset();
      if (result.ok) {
        await load();
        setMessage("Reset to defaults");
      } else {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Identity</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Name"
            value={extractFrontmatterField(state.identityContent, "name") ?? "Bandry"}
            onValueChange={(value) => {
              setState((s) =>
                s ? { ...s, identityContent: updateFrontmatterField(s.identityContent, "name", value) } : s
              );
            }}
          />
          <Input
            label="Tagline"
            value={extractFrontmatterField(state.identityContent, "tagline") ?? ""}
            onValueChange={(value) => {
              setState((s) =>
                s ? { ...s, identityContent: updateFrontmatterField(s.identityContent, "tagline", value) } : s
              );
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Soul</h3>
          <Button
            size="sm"
            variant="light"
            startContent={soulEditMode ? <Eye size={14} /> : <Pencil size={14} />}
            onPress={() => setSoulEditMode(!soulEditMode)}
          >
            {soulEditMode ? "Preview" : "Edit"}
          </Button>
        </CardHeader>
        <CardBody>
          {soulEditMode ? (
            <Textarea
              minRows={12}
              maxRows={30}
              value={state.soulContent}
              onValueChange={(value) => setState((s) => (s ? { ...s, soulContent: value } : s))}
              placeholder="Define the assistant's personality, values, and communication style..."
            />
          ) : (
            <div className={`min-h-[200px] px-1 ${mdClass}`}>
              {state.soulContent.trim() ? (
                <Markdown>{state.soulContent}</Markdown>
              ) : (
                <p className="text-gray-400 italic">No soul content defined yet.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            color="primary"
            size="sm"
            startContent={<Save size={14} />}
            onPress={handleSave}
            isLoading={saving}
          >
            Save
          </Button>
          <Button
            variant="flat"
            size="sm"
            startContent={<RotateCcw size={14} />}
            onPress={handleReset}
            isDisabled={saving}
          >
            Reset
          </Button>
        </div>
        <Button
          variant="flat"
          color="secondary"
          size="sm"
          startContent={<Sparkles size={14} />}
          onPress={() => setInterviewOpen(true)}
        >
          AI Interview
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </div>
      )}

      {interviewOpen && (
        <SoulInterviewModal
          isOpen={interviewOpen}
          onClose={() => setInterviewOpen(false)}
          onApply={(result) => {
            setState({ soulContent: result.soulContent, identityContent: result.identityContent });
            setInterviewOpen(false);
            setMessage("Interview applied - click Save to persist");
          }}
        />
      )}
    </div>
  );
};

const extractFrontmatterField = (content: string, field: string): string | null => {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
};

const updateFrontmatterField = (content: string, field: string, value: string): string => {
  const regex = new RegExp(`^(${field}:\\s*)(.+)$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  return content.replace(/^---\s*\n/, `---\n${field}: ${value}\n`);
};
