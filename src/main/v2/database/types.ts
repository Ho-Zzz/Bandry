/**
 * Agent type classification
 */
export type AgentType = "planner" | "generalist" | "specialist" | "executor";

/**
 * Provider configuration (stored in database)
 */
export type ProviderRecord = {
  id: string;
  provider_name: string;
  api_key: string;
  base_url?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

/**
 * Employee configuration (stored in database)
 */
export type EmployeeRecord = {
  id: string;
  name: string;
  avatar?: string;
  type: AgentType;
  provider_id: string;
  model_id: string;
  system_prompt?: string;
  mcp_tools: string[]; // Stored as JSON string in DB
  override_params?: {
    temperature?: number;
    max_tokens?: number;
  }; // Stored as JSON string in DB
  created_at: number;
  updated_at: number;
};

/**
 * Input for creating a provider
 */
export type CreateProviderInput = {
  provider_name: string;
  api_key: string;
  base_url?: string;
  is_active?: boolean;
};

/**
 * Input for updating a provider
 */
export type UpdateProviderInput = Partial<Omit<CreateProviderInput, "provider_name">>;

/**
 * Input for creating an employee
 */
export type CreateEmployeeInput = {
  name: string;
  avatar?: string;
  type: AgentType;
  provider_id: string;
  model_id: string;
  system_prompt?: string;
  mcp_tools?: string[];
  override_params?: {
    temperature?: number;
    max_tokens?: number;
  };
};

/**
 * Input for updating an employee
 */
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;
