import React from "react";
import { FileText, Users, BarChart2, TrendingUp } from "lucide-react";
import type { Question, Response } from "../../types";

interface DashboardStatsProps {
  questions: Question[];
  responses: Response[];
}

export default function DashboardStats({
  questions,
  responses,
}: DashboardStatsProps) {
  const totalForms = questions.length;
  const totalResponses = responses.length;
  const averageResponsesPerForm =
    totalForms > 0 ? Math.round((totalResponses / totalForms) * 10) / 10 : 0;
  const responseRate =
    totalForms > 0
      ? Math.round((responses.length / (totalForms * 100)) * 100)
      : 0;

  const stats = [
    {
      name: "Service Forms",
      value: totalForms,
      change: "+12%",
      icon: FileText,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
    },
    {
      name: "Customer Requests",
      value: totalResponses,
      change: "+8%",
      icon: Users,
      gradient: "from-green-500 to-green-600",
      bg: "bg-green-50",
    },
    {
      name: "Active Customers",
      value: questions.filter((q) =>
        responses.some((r) => r.questionId === q.id)
      ).length,
      change: "+5%",
      icon: BarChart2,
      gradient: "from-purple-500 to-purple-600",
      bg: "bg-purple-50",
    },
    {
      name: "Response Rate",
      value: `${responseRate}%`,
      change: "+2%",
      icon: TrendingUp,
      gradient: "from-orange-500 to-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {stat.name}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stat.value}
              </p>
            </div>
            <div className={`rounded-xl p-3 ${stat.bg}`}>
              <stat.icon
                className={`w-7 h-7 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-green-600">
              {stat.change} from last month
            </p>
            <div
              className={`h-2 bg-gradient-to-r ${stat.gradient} rounded-full flex-1 ml-4`}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}
