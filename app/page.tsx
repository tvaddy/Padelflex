import DashboardClient from "@/components/DashboardClient";
import { getActiveTournament, getPlayers, getLeagues, getTournamentHistory } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function Home() {
  let activeTournament = null;
  let allPlayers: any[] = [];
  let leagues: any[] = [];
  let tournamentHistory: any[] = [];

  try {
    const [tourneyRes, playersRes, leaguesRes, historyRes] = await Promise.all([
      getActiveTournament(),
      getPlayers(),
      getLeagues(),
      getTournamentHistory()
    ]);
    activeTournament = tourneyRes;
    allPlayers = playersRes;
    leagues = leaguesRes;
    tournamentHistory = historyRes;
  } catch (error) {
    console.error("Failed to load initial data from database:", error);
  }

  return (
    <DashboardClient 
      activeTournament={activeTournament} 
      allPlayers={allPlayers} 
      initialLeagues={leagues}
      initialHistory={tournamentHistory}
    />
  );
}
