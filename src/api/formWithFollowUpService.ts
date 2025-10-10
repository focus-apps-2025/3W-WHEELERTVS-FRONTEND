// API service for Form with Follow-up Questions

export interface FollowUpConfig {
  hasFollowUp: boolean;
  required: boolean;
}

export interface FormWithFollowUpData {
  title: string;
  description: string;
  logoUrl?: string;
  imageUrl?: string;
  options: string[];
  followUpConfig: Record<string, FollowUpConfig>;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

class FormWithFollowUpService {
  private baseUrl = "/api/forms";

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }
    return response.json();
  }

  /**
   * Create a new form with follow-up questions
   */
  async createFormWithFollowUp(
    formData: FormWithFollowUpData
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/with-followup`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(formData),
    });

    return this.handleResponse(response);
  }

  /**
   * Get form by ID
   */
  async getForm(id: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Get public form (no auth required)
   */
  async getPublicForm(id: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${id}/public`);
    return this.handleResponse(response);
  }

  /**
   * Get follow-up configuration for a form
   */
  async getFollowUpConfig(formId: string): Promise<
    ApiResponse<{
      formId: string;
      title: string;
      followUpConfig: Record<string, FollowUpConfig>;
    }>
  > {
    const response = await fetch(`${this.baseUrl}/${formId}/followup-config`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Update follow-up configuration for a form
   */
  async updateFollowUpConfig(
    formId: string,
    followUpConfig: Record<string, FollowUpConfig>
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${formId}/followup-config`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ followUpConfig }),
    });

    return this.handleResponse(response);
  }

  /**
   * Submit form response
   */
  async submitResponse(responseData: {
    questionId: string;
    answers: Record<string, any>;
    timestamp: string;
    parentResponseId?: string;
  }): Promise<ApiResponse<any>> {
    const response = await fetch("/api/responses", {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(responseData),
    });

    return this.handleResponse(response);
  }

  /**
   * Get all forms (with pagination)
   */
  async getAllForms(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isVisible?: boolean;
    createdBy?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const url = `${this.baseUrl}?${searchParams.toString()}`;
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Get public forms
   */
  async getPublicForms(): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/public`);
    return this.handleResponse(response);
  }

  /**
   * Update form
   */
  async updateForm(
    formId: string,
    updateData: Partial<FormWithFollowUpData>
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${formId}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    return this.handleResponse(response);
  }

  /**
   * Delete form
   */
  async deleteForm(formId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${formId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Update form visibility
   */
  async updateFormVisibility(
    formId: string,
    isVisible: boolean
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${formId}/visibility`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ isVisible }),
    });

    return this.handleResponse(response);
  }

  /**
   * Duplicate form
   */
  async duplicateForm(formId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}/${formId}/duplicate`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(
    formId: string,
    period: "7d" | "30d" | "90d" = "30d"
  ): Promise<ApiResponse<any>> {
    const response = await fetch(
      `${this.baseUrl}/${formId}/analytics?period=${period}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Get form responses
   */
  async getFormResponses(
    formId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: "pending" | "verified" | "rejected";
      assignedTo?: string;
    }
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append("questionId", formId);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(`/api/responses?${searchParams.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Validate form data before submission
   */
  validateFormData(formData: FormWithFollowUpData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!formData.title.trim()) {
      errors.push("Form title is required");
    }

    if (!formData.description.trim()) {
      errors.push("Form description is required");
    }

    if (formData.options.length < 2) {
      errors.push("Form must have at least 2 options");
    }

    if (formData.options.some((option) => !option.trim())) {
      errors.push("All options must have text");
    }

    // Check for duplicate options
    const optionSet = new Set(
      formData.options.map((opt) => opt.trim().toLowerCase())
    );
    if (optionSet.size !== formData.options.length) {
      errors.push("All options must be unique");
    }

    // Validate URLs if provided
    if (formData.logoUrl && !this.isValidUrl(formData.logoUrl)) {
      errors.push("Logo URL must be a valid URL");
    }

    if (formData.imageUrl && !this.isValidUrl(formData.imageUrl)) {
      errors.push("Image URL must be a valid URL");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper function to validate URLs
   */
  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get follow-up question summary
   */
  getFollowUpSummary(followUpConfig: Record<string, FollowUpConfig>): {
    withFollowUp: string[];
    requiredFollowUp: string[];
    optionalFollowUp: string[];
    summary: string;
  } {
    const withFollowUp = Object.entries(followUpConfig)
      .filter(([_, config]) => config.hasFollowUp)
      .map(([option, _]) => option);

    const requiredFollowUp = Object.entries(followUpConfig)
      .filter(([_, config]) => config.hasFollowUp && config.required)
      .map(([option, _]) => option);

    const optionalFollowUp = Object.entries(followUpConfig)
      .filter(([_, config]) => config.hasFollowUp && !config.required)
      .map(([option, _]) => option);

    let summary = "No follow-up questions configured";

    if (withFollowUp.length > 0) {
      const parts = [];
      if (requiredFollowUp.length > 0) {
        parts.push(`Required: ${requiredFollowUp.join(", ")}`);
      }
      if (optionalFollowUp.length > 0) {
        parts.push(`Optional: ${optionalFollowUp.join(", ")}`);
      }
      summary = `Follow-up questions - ${parts.join("; ")}`;
    }

    return {
      withFollowUp,
      requiredFollowUp,
      optionalFollowUp,
      summary,
    };
  }
}

export const formWithFollowUpService = new FormWithFollowUpService();
export default formWithFollowUpService;
