/**
 * Provider Manager Component
 *
 * CRUD interface for managing LLM providers
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Switch,
} from "@heroui/react";
import { Plus, Edit, Trash2, Check, X } from "lucide-react";
import type { ProviderResult, ProviderInput } from "../../../shared/ipc";

export const ProviderManager = () => {
  const [providers, setProviders] = useState<ProviderResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<ProviderResult | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [formData, setFormData] = useState<ProviderInput>({
    provider_name: "",
    api_key: "",
    base_url: "",
    is_active: true,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      const result = await window.api.providerList();
      setProviders(result);
    } catch (error) {
      console.error("Failed to load providers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProvider(null);
    setFormData({
      provider_name: "",
      api_key: "",
      base_url: "",
      is_active: true,
    });
    onOpen();
  };

  const handleEdit = (provider: ProviderResult) => {
    setEditingProvider(provider);
    setFormData({
      provider_name: provider.provider_name,
      api_key: provider.api_key,
      base_url: provider.base_url,
      is_active: provider.is_active,
    });
    onOpen();
  };

  const handleSave = async () => {
    try {
      if (editingProvider) {
        await window.api.providerUpdate(editingProvider.id, formData);
      } else {
        await window.api.providerCreate(formData);
      }
      await loadProviders();
      onClose();
    } catch (error) {
      console.error("Failed to save provider:", error);
      alert(error instanceof Error ? error.message : "Failed to save provider");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;

    try {
      await window.api.providerDelete(id);
      await loadProviders();
    } catch (error) {
      console.error("Failed to delete provider:", error);
      alert(error instanceof Error ? error.message : "Failed to delete provider");
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <Card>
        <CardHeader className="flex justify-between items-center px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">Provider Management</h2>
            <p className="text-sm text-gray-500 mt-1">Configure LLM providers and API keys</p>
          </div>
          <Button color="primary" startContent={<Plus size={16} />} onPress={handleCreate}>
            Add Provider
          </Button>
        </CardHeader>
        <CardBody className="px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading providers...</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No providers configured. Click "Add Provider" to get started.
            </div>
          ) : (
            <Table aria-label="Providers table">
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>BASE URL</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <span className="font-medium">{provider.provider_name}</span>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-gray-500">
                        {provider.base_url || "Default"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={provider.is_active ? "success" : "default"}
                        variant="flat"
                        startContent={provider.is_active ? <Check size={12} /> : <X size={12} />}
                      >
                        {provider.is_active ? "Active" : "Inactive"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleEdit(provider)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          onPress={() => handleDelete(provider.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        placement="center"
        scrollBehavior="inside"

      >
        <ModalContent className="shadow-lg">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {editingProvider ? "Edit Provider" : "Add New Provider"}
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Provider Name"
                    placeholder="e.g., deepseek, openai, volcengine"
                    value={formData.provider_name}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, provider_name: value }))
                    }
                    isRequired
                    variant="bordered"
                  />
                  <Input
                    label="API Key"
                    placeholder="Enter your API key"
                    type="password"
                    value={formData.api_key}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, api_key: value }))}
                    isRequired
                    variant="bordered"
                  />
                  <Input
                    label="Base URL"
                    placeholder="e.g., https://api.deepseek.com (optional)"
                    value={formData.base_url}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, base_url: value }))}
                    variant="bordered"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Active</span>
                      <span className="text-xs text-gray-500">Enable this provider for use</span>
                    </div>
                    <Switch
                      isSelected={formData.is_active}
                      onValueChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_active: checked }))
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSave}
                  isDisabled={!formData.provider_name || !formData.api_key}
                >
                  {editingProvider ? "Update" : "Create"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
