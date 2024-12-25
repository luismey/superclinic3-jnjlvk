import { api } from '../lib/api';
import { Organization, OrganizationPlan, OrganizationSettings, organizationSchema } from '../types/organization';
import axios, { AxiosError } from 'axios'; // v1.4.0

// Constants
const API_BASE_PATH = '/api/v1/organizations';
const CACHE_TTL = 300000; // 5 minutes
const MAX_RETRIES = 3;

// Types
interface OrganizationUpdateDto {
  name?: string;
  plan?: OrganizationPlan;
  settings?: Partial<OrganizationSettings>;
}

/**
 * Service for managing organization-related operations with caching and error handling
 */
class OrganizationService {
  private currentOrganization: Organization | null = null;
  private lastFetch: number = 0;

  /**
   * Retrieves the current organization details with caching
   * @returns Promise<Organization>
   * @throws {ApiError} If the request fails
   */
  async getOrganization(): Promise<Organization> {
    try {
      // Check cache validity
      if (
        this.currentOrganization && 
        Date.now() - this.lastFetch < CACHE_TTL
      ) {
        return this.currentOrganization;
      }

      const response = await api.get<Organization>(
        `${API_BASE_PATH}/current`,
        undefined,
        { cache: true }
      );

      // Validate response data
      const validatedOrg = organizationSchema.parse(response);
      
      // Update cache
      this.currentOrganization = validatedOrg;
      this.lastFetch = Date.now();

      return validatedOrg;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`Failed to fetch organization: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Updates the organization details with optimistic updates and retry logic
   * @param updateData - Partial organization data to update
   * @returns Promise<Organization>
   * @throws {ApiError} If the update fails
   */
  async updateOrganization(updateData: OrganizationUpdateDto): Promise<Organization> {
    let retries = 0;
    const previousData = this.currentOrganization;

    try {
      // Optimistically update cache
      if (this.currentOrganization) {
        this.currentOrganization = {
          ...this.currentOrganization,
          ...updateData,
          updatedAt: new Date()
        };
      }

      while (retries < MAX_RETRIES) {
        try {
          const response = await api.put<Organization, OrganizationUpdateDto>(
            `${API_BASE_PATH}/current`,
            updateData,
            { cache: false }
          );

          // Validate response data
          const validatedOrg = organizationSchema.parse(response);
          
          // Update cache with validated data
          this.currentOrganization = validatedOrg;
          this.lastFetch = Date.now();

          return validatedOrg;
        } catch (error) {
          retries++;
          if (retries === MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }

      throw new Error('Max retries exceeded');
    } catch (error) {
      // Revert optimistic update on failure
      this.currentOrganization = previousData;
      
      if (error instanceof AxiosError) {
        throw new Error(`Failed to update organization: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Updates specific organization settings with validation
   * @param settings - Partial settings to update
   * @returns Promise<Organization>
   * @throws {ApiError} If the settings update fails
   */
  async updateOrganizationSettings(
    settings: Partial<OrganizationSettings>
  ): Promise<Organization> {
    try {
      const currentOrg = await this.getOrganization();
      
      // Merge with existing settings
      const updatedSettings = {
        ...currentOrg.settings,
        ...settings
      };

      // Validate merged settings
      organizationSchema.shape.settings.parse(updatedSettings);

      return this.updateOrganization({
        settings: updatedSettings
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`Failed to update organization settings: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Clears the organization cache
   */
  clearCache(): void {
    this.currentOrganization = null;
    this.lastFetch = 0;
  }

  /**
   * Validates if the organization has access to a specific feature
   * @param featureKey - Key of the feature to check
   * @returns boolean
   */
  async hasFeature(featureKey: keyof OrganizationSettings['features']): Promise<boolean> {
    const org = await this.getOrganization();
    return org.settings.features[featureKey] || false;
  }

  /**
   * Checks if the organization is within its usage limits
   * @param limitKey - Key of the limit to check
   * @param currentValue - Current usage value
   * @returns boolean
   */
  async checkLimit(
    limitKey: keyof OrganizationSettings['limits'],
    currentValue: number
  ): Promise<boolean> {
    const org = await this.getOrganization();
    return currentValue <= org.settings.limits[limitKey];
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();