import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import type { Team, TeamWithMembers } from "../../../types/team";
import type { StaffMember } from "../../../types";
import { teamsApi } from "../../../api/teams";
import { staffApi } from "../../../api/storage";
import TeamCreationModal from "./team/TeamCreationModal";
import TeamList from "./team/TeamList";
import { useNotification } from "../../../context/NotificationContext";

export default function TeamManagement() {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithMembers | null>(null);
  const { showSuccess, showError, showConfirm } = useNotification();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = () => {
    const allTeams = teamsApi.getAll();
    const staff = staffApi.getAll();

    const teamsWithMembers: TeamWithMembers[] = allTeams.map((team) => ({
      ...team,
      memberDetails: team.members.map((memberId) => {
        const member = staff.find((s) => s.id === memberId);
        return member
          ? {
              id: member.id,
              name: member.name,
              role: member.role,
              avatar: member.profilePic,
            }
          : {
              id: memberId,
              name: "Unknown Member",
              role: "unknown",
            };
      }),
      leaderDetails: team.leaderId
        ? (() => {
            const leader = staff.find((s) => s.id === team.leaderId);
            return leader
              ? {
                  id: leader.id,
                  name: leader.name,
                  role: leader.role,
                  avatar: leader.profilePic,
                }
              : undefined;
          })()
        : undefined,
    }));

    setTeams(teamsWithMembers);
  };

  const handleCreateTeam = (teamData: Omit<Team, "id" | "createdAt">) => {
    const newTeam: Team = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...teamData,
    };
    teamsApi.save(newTeam);
    loadTeams();
    setShowCreateModal(false);
  };

  const handleEditTeam = (team: TeamWithMembers) => {
    setEditingTeam(team);
    setShowCreateModal(true);
  };

  const handleDeleteTeam = (id: string) => {
    const team = teams.find((t) => t.id === id);
    const teamName = team?.name || "this team";

    showConfirm(
      `Are you sure you want to delete "${teamName}"? This action cannot be undone.`,
      () => {
        try {
          teamsApi.delete(id);
          loadTeams();
          showSuccess("Team deleted successfully", "Success");
        } catch (error: any) {
          showError(error.message || "Failed to delete team", "Error");
        }
      },
      "Delete Team",
      "Delete",
      "Cancel"
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Teams</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage teams to organize your staff members
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Team
          </button>
        </div>
      </div>

      <TeamList
        teams={teams}
        onEditTeam={handleEditTeam}
        onDeleteTeam={handleDeleteTeam}
      />

      {showCreateModal && (
        <TeamCreationModal
          onClose={() => {
            setShowCreateModal(false);
            setEditingTeam(null);
          }}
          onSubmit={handleCreateTeam}
        />
      )}
    </div>
  );
}
