export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  avatar?: string;
  mobile: string;
  userId: string;
  password: string;
  profilePic?: string;
}

export interface FormPermission {
  formId: string;
  formTitle: string;
  permissions: {
    respond: boolean;
    viewResponses: boolean;
    edit: boolean;
    addFollowUp: boolean;
    delete: boolean;
    publicVisibility: boolean;
  };
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  formPermissions: FormPermission[];
  canCreateForms?: boolean;
  isSystem?: boolean;
}
