export interface Team {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  members: string[]; // Array of staff member IDs
  leaderId?: string; // ID of the team leader
  color?: string;
  icon?: string;
}

export interface TeamWithMembers extends Team {
  memberDetails: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  }[];
  leaderDetails?: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
}