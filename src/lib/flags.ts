const FLAG: Record<string, string> = {
  Argentina: "🇦🇷", France: "🇫🇷", Brazil: "🇧🇷", Germany: "🇩🇪", Spain: "🇪🇸",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Portugal: "🇵🇹", Netherlands: "🇳🇱", Italy: "🇮🇹", Belgium: "🇧🇪",
  Croatia: "🇭🇷", Morocco: "🇲🇦", USA: "🇺🇸", Mexico: "🇲🇽", Canada: "🇨🇦",
  Japan: "🇯🇵", "South Korea": "🇰🇷", Australia: "🇦🇺", Uruguay: "🇺🇾", Senegal: "🇸🇳",
  Switzerland: "🇨🇭", Denmark: "🇩🇰", Poland: "🇵🇱", Serbia: "🇷🇸", Ecuador: "🇪🇨",
  Iran: "🇮🇷", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Tunisia: "🇹🇳", Ghana: "🇬🇭", Cameroon: "🇨🇲",
  Qatar: "🇶🇦", Norway: "🇳🇴", Sweden: "🇸🇪", Egypt: "🇪🇬", "Saudi Arabia": "🇸🇦",
};
export function flagFor(team: string, fallback?: string | null) {
  return FLAG[team] ?? fallback ?? "⚽";
}
