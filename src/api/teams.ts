const STORAGE_KEY = 'teams';

export const teamsApi = {
  getAll: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getById: (id: string) => {
    const teams = teamsApi.getAll();
    return teams.find(t => t.id === id);
  },

  save: (team: Team) => {
    const teams = teamsApi.getAll();
    const index = teams.findIndex(t => t.id === team.id);
    
    if (index >= 0) {
      teams[index] = team;
    } else {
      teams.push(team);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    window.dispatchEvent(new Event('storage'));
  },

  delete: (id: string) => {
    const teams = teamsApi.getAll();
    const updatedTeams = teams.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTeams));
    window.dispatchEvent(new Event('storage'));
  }
};