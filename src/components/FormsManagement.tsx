import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  Eye,
  FileText,
  MessageSquarePlus,
  Copy,
} from "lucide-react";
import type { Question } from "../types";
import { questionsApi } from "../api/storage";
import { formVisibilityApi } from "../api/storage";

export default function FormsManagement() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [forms] = React.useState<Question[]>(() => questionsApi.getAll());
  const [visibilityData, setVisibilityData] = React.useState(() =>
    formVisibilityApi.getAll()
  );

  const filteredForms = forms.filter(
    (form) =>
      form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (form.parentFormId
        ? forms.find((f) => f.id === form.parentFormId)?.title || ""
        : form.description
      )
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this form? This action cannot be undone."
      )
    ) {
      questionsApi.delete(id);
      navigate(0);
    }
  };

  const handleCopyForm = (form: Question) => {
    const newForm: Question = {
      ...form,
      id: crypto.randomUUID(),
      title: `${form.title} (Copy)`,
      sections: form.sections.map((section) => ({
        ...section,
        id: crypto.randomUUID(),
        questions: section.questions.map((question) => ({
          ...question,
          id: crypto.randomUUID(),
        })),
      })),
      followUpQuestions: form.followUpQuestions.map((question) => ({
        ...question,
        id: crypto.randomUUID(),
      })),
    };
    questionsApi.save(newForm);
    navigate(0);
  };

  const handleAddFollowUp = (parentId: string) => {
    navigate(`/forms/create?parentId=${parentId}`);
  };

  const handleVisibilityChange = (formId: string, isVisible: boolean) => {
    formVisibilityApi.setVisibility(formId, isVisible);
    setVisibilityData((prev) => ({ ...prev, [formId]: isVisible }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-medium text-primary-600 mb-2">
            Forms Management
          </h1>
          <p className="text-primary-500">
            Create, edit, and manage all your forms in one place
          </p>
        </div>
        <button
          onClick={() => navigate("/forms/create")}
          className="btn-primary flex items-center"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Form
        </button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-500" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                  Form Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-primary-600 uppercase tracking-wider">
                  Parent Form / Child Form
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-primary-600 uppercase tracking-wider">
                  Public Visibility
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-primary-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-neutral-200">
              {filteredForms.map((form) => {
                const parentForm = form.parentFormId
                  ? forms.find((f) => f.id === form.parentFormId)
                  : null;
                const childForms = forms.filter(
                  (f) => f.parentFormId === form.id
                );

                return (
                  <tr key={form.id} className="hover:bg-primary-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {form.imageUrl ? (
                          <img
                            src={form.imageUrl}
                            alt={form.title}
                            className="w-10 h-10 object-cover rounded-lg mr-3"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-primary-600 mr-3" />
                        )}
                        <span className="text-sm font-medium text-primary-600">
                          {form.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          form.parentFormId
                            ? "bg-purple-50 text-purple-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {form.parentFormId ? "Follow-up Form" : "Parent Form"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {form.parentFormId ? (
                        <p className="text-sm text-primary-600 truncate max-w-xs">
                          Parent: {parentForm?.title || "Unknown Parent Form"}
                        </p>
                      ) : childForms.length > 0 ? (
                        <p className="text-sm text-purple-600 truncate max-w-xs">
                          Child Forms: {childForms.length}
                        </p>
                      ) : (
                        <p className="text-sm text-primary-500 truncate max-w-xs">
                          {form.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={visibilityData[form.id] || false}
                          onChange={(e) =>
                            handleVisibilityChange(form.id, e.target.checked)
                          }
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-900 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/forms/${form.id}/preview`)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Preview Form"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/forms/${form.id}/responses`)
                          }
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View Responses"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAddFollowUp(form.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Add Follow-up Form"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyForm(form)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Copy Form"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/forms/${form.id}/edit`)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit Form"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(form.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Form"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredForms.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-primary-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-600 mb-2">
                No Forms Found
              </h3>
              <p className="text-primary-500">
                {searchTerm
                  ? "No forms match your search criteria."
                  : "Start by creating your first form."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
