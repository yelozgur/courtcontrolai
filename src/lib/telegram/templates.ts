
/**
 * @fileOverview Centralized Telegram message templates for CourtControl AI.
 */

export const TELEGRAM_TEMPLATES = {
  MATCH_SCHEDULED: (court: number, time: string, opponent: string) => 
    `📅 <b>New Match Scheduled!</b>\n\nCourt: ${court}\nTime: ${time}\nOpponent: ${opponent}\n\nPlease check in 15 mins early.`,
    
  BRACKET_PUBLISHED: (tournamentName: string) => 
    `🏆 <b>Bracket Live!</b>\n\nThe bracket for <b>${tournamentName}</b> has been generated and published. View your position in the app.`,
    
  WAITLIST_PROMOTION: (tournamentName: string) => 
    `✨ <b>You're In!</b>\n\nA spot opened up for <b>${tournamentName}</b>. You have been promoted from the waitlist to registered.`,
    
  SCORE_UPDATE: (teamA: string, scoreA: number, teamB: string, scoreB: number) => 
    `📊 <b>Live Score Update</b>\n\n${teamA}: ${scoreA}\n${teamB}: ${scoreB}`
};
