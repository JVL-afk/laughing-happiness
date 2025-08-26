// lib/api-client.ts
// FRONTEND API CLIENT - Fixes request formatting and error handling

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
  requiresAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  }

  private getAuthHeaders(): Record<string, string> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          data: data.success !== false ? data : undefined,
          message: data.message
        };
      } else {
        return {
          success: false,
          error: data.error || 'Request failed',
          message: data.message || data.error || 'An error occurred',
          details: data.details,
          requiresAuth: data.requiresAuth
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: 'Failed to connect to server. Please check your internet connection.'
      };
    }
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: 'Failed to send request. Please try again.'
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        message: 'Failed to fetch data. Please try again.'
      };
    }
  }

  // Website generation API
  async generateWebsite(data: {
    productUrl: string;
    niche?: string;
    targetAudience?: string;
    customization?: {
      colorScheme?: string;
      style?: string;
      tone?: string;
    };
  }) {
    // Validate required fields
    if (!data.productUrl) {
      return {
        success: false,
        error: 'Validation error',
        message: 'Product URL is required'
      };
    }

    // Validate URL format
    try {
      new URL(data.productUrl);
    } catch {
      return {
        success: false,
        error: 'Validation error',
        message: 'Please enter a valid URL'
      };
    }

    // Clean and format data
    const requestData = {
      productUrl: data.productUrl.trim(),
      niche: data.niche?.trim() || undefined,
      targetAudience: data.targetAudience?.trim() || undefined,
      customization: data.customization || {
        colorScheme: 'modern',
        style: 'professional',
        tone: 'persuasive'
      }
    };

    return this.post('/api/ai/generate-website', requestData);
  }

  // Website analysis API
  async analyzeWebsite(data: {
    websiteUrl: string;
    analysisType?: 'basic' | 'comprehensive' | 'seo' | 'performance';
    includeCompetitorAnalysis?: boolean;
  }) {
    // Validate required fields
    if (!data.websiteUrl) {
      return {
        success: false,
        error: 'Validation error',
        message: 'Website URL is required'
      };
    }

    // Validate URL format
    try {
      new URL(data.websiteUrl);
    } catch {
      return {
        success: false,
        error: 'Validation error',
        message: 'Please enter a valid URL (include http:// or https://)'
      };
    }

    // Clean and format data
    const requestData = {
      websiteUrl: data.websiteUrl.trim(),
      analysisType: data.analysisType || 'comprehensive',
      includeCompetitorAnalysis: data.includeCompetitorAnalysis || false
    };

    return this.post('/api/ai/analyze-website', requestData);
  }

  // User authentication
  async login(email: string, password: string) {
    return this.post('/api/auth/login', { email, password });
  }

  async signup(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    return this.post('/api/auth/signup', data);
  }

  async getUser() {
    return this.get('/api/auth/me');
  }

  // Website management
  async getWebsites() {
    return this.get('/api/websites');
  }

  async getWebsite(id: string) {
    return this.get(`/api/websites/${id}`);
  }

  async deleteWebsite(id: string) {
    return this.post(`/api/websites/${id}/delete`, {});
  }

  // Analytics
  async getAnalytics() {
    return this.get('/api/analytics');
  }

  async trackClick(websiteId: string) {
    return this.post('/api/analytics/click', { websiteId });
  }

  async trackConversion(websiteId: string, amount?: number) {
    return this.post('/api/analytics/conversion', { websiteId, amount });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;

// Export types for use in components
export type { ApiResponse };
