import React from "react";
import { Users, UserCircle, Trash2, Edit2 } from "lucide-react";
import type { TeamWithMembers } from "../../../../types/team";

interface TeamListProps {
  teams: TeamWithMembers[];
  onEditTeam: (team: TeamWithMembers) => void;
  onDeleteTeam: (id: string) => void;
}

export default function TeamList({
  teams,
  onEditTeam,
  onDeleteTeam,
}: TeamListProps) {
  const getTeamColorClasses = (color: string = "blue") => ({
    icon: `text-${color}-500`,
    bg: `bg-${color}-50`,
    border: `border-${color}-200`,
    text: `text-${color}-700`,
  });

  return (
    <div className="grid gap-6">
      {teams.map((team) => {
        const colorClasses = getTeamColorClasses(team.color);

        return (
          <div
            key={team.id}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-neutral-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${colorClasses.bg}`}>
                  <Users className={`w-6 h-6 ${colorClasses.icon}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary-900">
                    {team.name}
                  </h3>
                  <p className="text-sm text-primary-500 mt-1">
                    {team.description}
                  </p>
                  {team.leaderDetails && (
                    <p className="text-sm text-primary-600 mt-2">
                      Led by {team.leaderDetails.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEditTeam(team)}
                  className="p-2 text-primary-600 hover:text-primary-900 transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDeleteTeam(team.id)}
                  className="p-2 text-red-600 hover:text-red-900 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-primary-700 mb-3">
                Team Members ({team.memberDetails.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {team.memberDetails.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full border border-neutral-200 dark:border-gray-700"
                  >
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <UserCircle className="w-6 h-6 text-gray-400" />
                    )}
                    <span className="text-sm text-primary-700">
                      {member.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {teams.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-900 mb-2">
            No Teams Created
          </h3>
          <p className="text-primary-500">
            Create your first team to start organizing your members.
          </p>
        </div>
      )}
    </div>
  );
}
