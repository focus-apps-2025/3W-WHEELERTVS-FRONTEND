import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForms, useResponses } from "../hooks/useApi";
import { FileText, ChevronLeft, ChevronRight, Smile, Frown, Meh, Search, Users, Building, ArrowLeft, Eye } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { apiClient } from "../api/client";
import { LAYOUT_CONFIG } from "../config/layoutConfig";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Tenant {
  _id: string;
  name: string;
  companyName: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface TenantStats {
  totalForms: number;
  totalResponses: number;
  promoterPercentage: number;
}

export default function DashboardNew() {
  const navigate = useNavigate();
  const { user, tenant: currentTenant } = useAuth();
  const { data: formsData, loading: formsLoading, error: formsError } = useForms();
  const { data: responsesData, loading: responsesLoading, error: responsesError } = useResponses();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New states for tenant management
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStats>>({});
  const [viewMode, setViewMode] = useState<"tenants" | "forms">("tenants");

  // Check user role
  const isSuperAdmin = user?.role === "superadmin";
  
  console.log("Auth Data:", { 
    user, 
    currentTenant, 
    isSuperAdmin,
    currentTenantId: currentTenant?._id,
    currentTenantSlug: currentTenant?.slug 
  });
  console.log("Forms Data:", formsData);
  console.log("Responses Data:", responsesData);

  // Determine initial view mode based on user role
  useEffect(() => {
    if (user && currentTenant) {
      console.log("Setting up tenant view for user:", user.role);
      
      // Create tenant object from currentTenant
      const tenantObj: Tenant = {
        _id: currentTenant.id,
        name: currentTenant.name,
        companyName: currentTenant.companyName,
        slug: currentTenant.slug,
        isActive: currentTenant.isActive !== false,
        createdAt: currentTenant.createdAt || new Date().toISOString()
      };
      
      console.log("Created tenant object:", tenantObj);
      
      // Always set selected tenant for admin users
      setSelectedTenant(tenantObj);
      
      if (isSuperAdmin) {
        // Superadmin sees tenants first
        setViewMode("tenants");
      } else {
        // Admin and other users see forms directly for their tenant
        setViewMode("forms");
      }
      
      // For all users, set current tenant in tenants array
      setTenants([tenantObj]);
    }
  }, [user, currentTenant, isSuperAdmin]);

  // Fetch all tenants (only for superadmin)
  useEffect(() => {
    const fetchTenants = async () => {
      // Only fetch tenants if user is superadmin
      if (!isSuperAdmin) {
        console.log("Not superadmin, skipping tenant fetch");
        return;
      }

      setTenantsLoading(true);
      setTenantsError(null);
      try {
        console.log("Fetching tenants for superadmin...");
        const response = await apiClient.getTenants();
        console.log("Tenants API response:", response);
        
        if (response && response.tenants) {
          setTenants(response.tenants);
          
          // If current tenant is not in the list, add it
          if (currentTenant && !response.tenants.some((t: any) => t._id === currentTenant._id)) {
            const currentTenantObj: Tenant = {
              _id: currentTenant._id,
              name: currentTenant.name,
              companyName: currentTenant.companyName,
              slug: currentTenant.slug,
              isActive: currentTenant.isActive !== false,
              createdAt: currentTenant.createdAt || new Date().toISOString()
            };
            setTenants(prev => [currentTenantObj, ...prev]);
          }
        } else {
          setTenants([]);
          setTenantsError("No tenants data received from API");
        }
      } catch (error: any) {
        console.error("Error fetching tenants:", error);
        setTenantsError(error.message || "Failed to fetch tenants");
        
        // Fallback to current tenant if fetch fails
        if (currentTenant) {
          const tenantObj: Tenant = {
            _id: currentTenant._id,
            name: currentTenant.name,
            companyName: currentTenant.companyName,
            slug: currentTenant.slug,
            isActive: currentTenant.isActive !== false,
            createdAt: currentTenant.createdAt || new Date().toISOString()
          };
          setTenants([tenantObj]);
        }
      } finally {
        setTenantsLoading(false);
      }
    };

    if (isSuperAdmin) {
      fetchTenants();
    }
  }, [currentTenant, isSuperAdmin]);

  // Calculate tenant statistics
  useEffect(() => {
    if (formsData?.forms && responsesData?.responses && tenants.length > 0) {
      console.log("Calculating tenant stats...");
      const stats: Record<string, TenantStats> = {};
      
      tenants.forEach(tenant => {
        // Filter forms by tenant - check multiple possible tenant ID fields
        const tenantForms = formsData.forms.filter((form: any) => {
          const formTenantId = form.tenantId || form.tenant?._id || form.tenant?.slug;
          console.log(`Form ${form.title} - tenantId: ${form.tenantId}, tenant._id: ${form.tenant?._id}, tenant.slug: ${form.tenant?.slug}`);
          console.log(`Comparing with tenant: ${tenant.companyName} (id: ${tenant._id}, slug: ${tenant.slug})`);
          
          const matches = formTenantId === tenant._id || formTenantId === tenant.slug;
          if (matches) {
            console.log(`✓ Form ${form.title} matches tenant ${tenant.companyName}`);
          }
          return matches;
        });
        
        console.log(`Tenant ${tenant.companyName} has ${tenantForms.length} forms`);
        
        // Get all responses for this tenant's forms
        const tenantFormIds = tenantForms.map((form: any) => form.id || form._id);
        const tenantResponses = responsesData.responses.filter((response: any) =>
          tenantFormIds.includes(response.formId || response.questionId)
        );
        
        // Calculate promoter percentage
        let yesCount = 0;
        let totalResponses = 0;
        
        tenantResponses.forEach((response: any) => {
          if (response.answers) {
            Object.values(response.answers).forEach((answer: any) => {
              const answerStr = String(answer).toLowerCase();
              if (answerStr === "yes") {
                yesCount++;
              }
              if (answerStr === "yes" || answerStr === "no" || answerStr === "n/a" || answerStr === "na") {
                totalResponses++;
              }
            });
          }
        });
        
        const promoterPercentage = totalResponses > 0 
          ? parseFloat(((yesCount / totalResponses) * 100).toFixed(1))
          : 0;
        
        stats[tenant._id] = {
          totalForms: tenantForms.length,
          totalResponses: tenantResponses.length,
          promoterPercentage
        };
        
        console.log(`Stats for ${tenant.companyName}:`, stats[tenant._id]);
      });
      
      setTenantStats(stats);
    }
  }, [formsData, responsesData, tenants]);

  // Filter forms by selected tenant
  const filteredForms = React.useMemo(() => {
    if (!formsData?.forms) {
      console.log("No forms data available");
      return [];
    }
    
    console.log("Total forms in system:", formsData.forms.length);
    console.log("All forms:", formsData.forms.map((f: any) => ({ 
      title: f.title, 
      tenantId: f.tenantId,
      tenant: f.tenant 
    })));
    
    // If in forms view and tenant is selected, filter by tenant
    if (viewMode === "forms" && selectedTenant) {
      console.log("Filtering forms for tenant:", {
        tenantName: selectedTenant.companyName,
        tenantId: selectedTenant._id,
        tenantSlug: selectedTenant.slug
      });
      
      const tenantForms = formsData.forms.filter((form: any) => {
        const formTenantId = form.tenantId || form.tenant?._id || form.tenant?.slug;
        console.log(`Checking form "${form.title}":`);
        console.log(`  Form tenantId: ${form.tenantId}`);
        console.log(`  Form tenant._id: ${form.tenant?._id}`);
        console.log(`  Form tenant.slug: ${form.tenant?.slug}`);
        console.log(`  Selected tenant._id: ${selectedTenant._id}`);
        console.log(`  Selected tenant.slug: ${selectedTenant.slug}`);
        
        const matches = formTenantId === selectedTenant._id || formTenantId === selectedTenant.slug;
        console.log(`  Matches: ${matches}`);
        return matches;
      });
      
      console.log(`Forms for tenant ${selectedTenant.companyName}:`, tenantForms.length);
      console.log("Matched forms:", tenantForms.map((f: any) => f.title));
      
      // Apply search filter on top of tenant filter
      const filtered = tenantForms.filter((form: any) =>
        form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (form.description && form.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
      console.log(`After search filter:`, filtered.length);
      return filtered;
    }
    
    // In tenants view or no tenant selected, return empty
    return [];
  }, [formsData?.forms, selectedTenant, viewMode, searchQuery]);

  const statsCache = React.useMemo(() => {
    const cache = new Map<string, { yesCount: number; noCount: number; naCount: number; total: number }>();

    if (responsesData?.responses) {
      responsesData.responses.forEach((response: any) => {
        if (response.answers) {
          const formId = response.questionId || response.formId;
          if (!cache.has(formId)) {
            cache.set(formId, { yesCount: 0, noCount: 0, naCount: 0, total: 0 });
          }
          const stats = cache.get(formId)!;
          Object.values(response.answers).forEach((answer: any) => {
            const answerStr = String(answer).toLowerCase();
            if (answerStr === "yes") {
              stats.yesCount++;
            } else if (answerStr === "no") {
              stats.noCount++;
            } else if (answerStr === "n/a" || answerStr === "na") {
              stats.naCount++;
            }
          });
          stats.total = stats.yesCount + stats.noCount + stats.naCount;
        }
      });
    }

    return cache;
  }, [responsesData?.responses]);

  const getFormResponseStats = (formId: string) => {
    return statsCache.get(formId) || { yesCount: 0, noCount: 0, naCount: 0, total: 0 };
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleTenantClick = (tenant: Tenant) => {
    console.log("Tenant clicked:", tenant);
    setSelectedTenant(tenant);
    setViewMode("forms");
    setSearchQuery(""); // Reset search when switching to forms view
  };

  const handleBackToTenants = () => {
    setSelectedTenant(null);
    setViewMode("tenants");
    setSearchQuery(""); // Reset search when going back
  };

  // Render tenant cards - only for superadmin
  const renderTenantCards = () => {
    // If user is not superadmin, don't show tenant cards at all
    if (!isSuperAdmin) {
      return null;
    }

    if (tenantsLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading tenants...
          </p>
        </div>
      );
    }

    if (tenantsError) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error loading tenants
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {tenantsError}
          </p>
        </div>
      );
    }

    if (!tenants || tenants.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No tenants available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No tenants found in the system
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="relative -mx-6 px-6">
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto pb-4 scroll-smooth"
          style={{ scrollBehavior: "smooth", scrollPaddingLeft: "2rem", scrollPaddingRight: "2rem" }}
        >
          {tenants.map((tenant) => {
            const stats = tenantStats[tenant._id] || { totalForms: 0, totalResponses: 0, promoterPercentage: 0 };
            
            return (
              <div
                key={tenant._id}
                className="flex-shrink-0 w-72 h-[28rem] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-600 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col"
                onClick={() => handleTenantClick(tenant)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      tenant.isActive
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {tenant.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {tenant.companyName || tenant.name}
                </h3>

                <div className="space-y-4 flex-1">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Total Forms
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalForms}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Total Responses
                        </span>
                      </div>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {stats.totalResponses}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Promoter Score
                      </span>
                      <span className="text-lg font-bold" style={{ color: "#1e3a8a" }}>
                        {stats.promoterPercentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(stats.promoterPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <button
                  className="mt-4 w-full bg-blue-800 hover:bg-white hover:text-blue-800  text-white py-2 px-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center border border-transparent hover:border-blue-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTenantClick(tenant);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Forms
                </button>
              </div>
            );
          })}
        </div>

        {tenants.length > 3 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    );
  };

  // Render form cards (your existing code with modifications)
  const renderFormCards = () => {
    console.log("Rendering form cards...");
    console.log("Forms loading:", formsLoading);
    console.log("Responses loading:", responsesLoading);
    console.log("Forms data:", formsData);
    console.log("Filtered forms:", filteredForms.length);
    console.log("Selected tenant:", selectedTenant);

    if (formsLoading || responsesLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading forms...
          </p>
        </div>
      );
    }

    if (formsError || responsesError) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error loading data
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {formsError || responsesError}
          </p>
        </div>
      );
    }

    if (!formsData?.forms || formsData.forms.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No forms available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first form to get started
          </p>
        </div>
      );
    }

    if (filteredForms.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No forms found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? "No forms match your search criteria" : 
             selectedTenant ? `No forms found for ${selectedTenant.companyName}` : 
             "No forms available"}
          </p>
          {!searchQuery && selectedTenant && (
            <div className="mt-4 text-sm text-gray-500">
              <p>Make sure forms have the correct tenant ID:</p>
              <p className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                tenantId should be: "{selectedTenant._id}" or "{selectedTenant.slug}"
              </p>
              <p className="mt-2">Available forms in system:</p>
              <div className="mt-1 max-h-40 overflow-y-auto">
                {formsData.forms.map((form: any, index: number) => (
                  <div key={index} className="p-2 border-b text-left">
                    <p><strong>{form.title}</strong></p>
                    <p className="text-xs">tenantId: {form.tenantId || 'null'}</p>
                    <p className="text-xs">tenant._id: {form.tenant?._id || 'null'}</p>
                    <p className="text-xs">tenant.slug: {form.tenant?.slug || 'null'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative -mx-6 px-6">
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto pb-4 scroll-smooth"
          style={{ scrollBehavior: "smooth", scrollPaddingLeft: "2rem", scrollPaddingRight: "2rem" }}
        >
          {filteredForms.map((form: any) => {
            const stats = getFormResponseStats(form.id);
            const promoterPercentage = stats.total > 0 ? ((stats.yesCount / stats.total) * 100).toFixed(1) : '0';
            return (
              <div
                key={form._id}
                className="flex-shrink-0 w-72 h-[36rem] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-600 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      form.isVisible
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {form.isVisible ? "Published" : "Draft"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 truncate">
                  {form.title}
                </h3>

                <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 line-clamp-1">
                  {form.description || "No description provided"}
                </p>

                <div className="flex items-center justify-between py-2 border-b border-gray-300 dark:border-gray-500">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">
                      Total Responses
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
                      {form.responseCount || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600 dark:text-gray-400 text-xs">
                      Promoters
                    </p>
                    <p className="text-lg font-bold" style={{ color: "#1e3a8a" }}>
                      {promoterPercentage}%
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex-1 flex flex-col items-center justify-center min-h-0">
                  {stats.total > 0 ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center py-2" style={{ maxHeight: "160px" }}>
                        <Doughnut
                          data={{
                            labels: ["Promoters", "Detractors", "Neutral"],
                            datasets: [
                              {
                                data: [stats.yesCount, stats.noCount, stats.naCount],
                                backgroundColor: [
                                  "rgba(30, 58, 138, 1)",
                                  "rgba(147, 197, 253, 1)",
                                  "rgba(37, 99, 235, 1)",
                                ],
                                borderColor: [
                                  "rgba(30, 58, 138, 1)",
                                  "rgba(147, 197, 253, 1)",
                                  "rgba(37, 99, 235, 1)",
                                ],
                                borderWidth: 2,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: true,
                            cutout: "75%",
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                enabled: false,
                              },
                              datalabels: {
                                display: false,
                              },
                            },
                          } as any}
                        />
                      </div>
                      <div className="mt-2 flex justify-center gap-4">
                        <div className="flex flex-col items-center">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.yesCount}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Promoters</p>
                          <Smile className="w-4 h-4 mt-0.5" style={{ color: "#1e3a8a" }} />
                          <p className="text-xs font-semibold mt-0.5" style={{ color: "#1e3a8a" }}>{stats.total > 0 ? ((stats.yesCount / stats.total) * 100).toFixed(1) : '0'}%</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.noCount}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Detractors</p>
                          <Frown className="w-4 h-4 mt-0.5" style={{ color: "#93c5fd" }} />
                          <p className="text-xs font-semibold mt-0.5" style={{ color: "#93c5fd" }}>{stats.total > 0 ? ((stats.noCount / stats.total) * 100).toFixed(1) : '0'}%</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{stats.naCount}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Neutral</p>
                          <Meh className="w-4 h-4 mt-0.5" style={{ color: "#2563eb" }} />
                          <p className="text-xs font-semibold mt-0.5" style={{ color: "#2563eb" }}>{stats.total > 0 ? ((stats.naCount / stats.total) * 100).toFixed(1) : '0'}%</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No responses
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/forms/${form.id}/analytics`)}
                  className="mt-4 w-full bg-blue-800 hover:bg-white hover:text-blue-800  text-white py-2 px-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center border border-transparent hover:border-blue-800"
                  style={{ backgroundColor: "#1e3a8a" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ffffffff")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e3a8a")}
                >
                  View More Analytics
                </button>
              </div>
            );
          })} 
        </div>

        {filteredForms.length > 3 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-all z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    );
  };

  // Determine page title based on user role
  const getPageTitle = () => {
    if (viewMode === "tenants") {
      return "All Tenants";
    } else if (viewMode === "forms" && selectedTenant) {
      return `${selectedTenant.companyName || selectedTenant.name} - Forms`;
    } else if (!isSuperAdmin && currentTenant) {
      return `${currentTenant.companyName} - Forms`;
    }
    return "Forms";
  };

  // Determine if we should show back button
  const showBackButton = () => {
    return isSuperAdmin && viewMode === "forms" && selectedTenant;
  };

  // Determine if we should show search bar
  const showSearchBar = () => {
    return viewMode === "forms";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      {/* Tenant Info Banner */}
      {currentTenant && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Your Tenant Information
              </h3>
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Business Name:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {currentTenant.companyName}
                  </span>
                </div>
                <div>
                  
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {currentTenant._id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Tenant Slug:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {currentTenant.slug}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    User Role:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
            {currentTenant.slug && (
              <div className="text-right">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Customer Portal URL:
                </p>
                <a
                  href={`https://forms.focusengineeringapp.com/${currentTenant.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline"
                >
                  {`https://forms.focusengineeringapp.com/${currentTenant.slug}`}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Dashboard Container */}
      <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 p-6">
        {/* Header with Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {showBackButton() && (
                <button
                  onClick={handleBackToTenants}
                  className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Tenants
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {getPageTitle()}
              </h2>
            </div>
            
            {/* Search Bar - Only show in forms view */}
            {showSearchBar() && (
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search forms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Stats Summary - Only show in forms view */}
          {viewMode === "forms" && selectedTenant && tenantStats[selectedTenant._id] && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Forms</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {tenantStats[selectedTenant._id].totalForms}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Responses</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {tenantStats[selectedTenant._id].totalResponses}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <Smile className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Promoter Score</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {tenantStats[selectedTenant._id].promoterPercentage}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Debug Info - Remove in production 
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
            <p className="font-semibold">Debug Info:</p>
            <p>User Role: {user?.role}</p>
            <p>Is Superadmin: {isSuperAdmin ? 'Yes' : 'No'}</p>
            <p>View Mode: {viewMode}</p>
            <p>Selected Tenant: {selectedTenant?.companyName || 'None'}</p>
            <p>Selected Tenant ID: {selectedTenant?._id || 'None'}</p>
            <p>Selected Tenant Slug: {selectedTenant?.slug || 'None'}</p>
            <p>Total Forms in System: {formsData?.forms?.length || 0}</p>
            <p>Filtered Forms: {filteredForms.length}</p>
          </div>
        )}
          */}

        {/* Content Area */}
        {viewMode === "tenants" ? renderTenantCards() : renderFormCards()}
      </div>
    </div>
  );
}