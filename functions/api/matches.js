export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300"
  };

  function reply(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers
    });
  }

  // Retrieve the private API token from Cloudflare.
  const token = env.FOOTBALL_DATA_API_KEY;

  if (!token) {
    return reply({
      error: "Football data API secret is not configured."
    }, 500);
  }

  const url = new URL(request.url);

  const allowedCompetitions = [
    "PL",  // English Premier League
    "PD",  // Spanish La Liga
    "BL1", // German Bundesliga
    "SA",  // Italian Serie A
    "FL1", // French Ligue 1
    "CL",  // Champions League
    "ELC", // English Championship
    "DED", // Dutch Eredivisie
    "PPL"  // Portuguese Primeira Liga
  ];

  const competition = (
    url.searchParams.get("competition") || "PL"
  ).toUpperCase();

  if (!allowedCompetitions.includes(competition)) {
    return reply({
      error: "Unsupported competition."
    }, 400);
  }

  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const validDate = value =>
    /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (
    (dateFrom && !validDate(dateFrom)) ||
    (dateTo && !validDate(dateTo))
  ) {
    return reply({
      error: "Dates must use YYYY-MM-DD format."
    }, 400);
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return reply({
      error: "dateFrom cannot be after dateTo."
    }, 400);
  }

  const apiUrl = new URL(
    `https://api.football-data.org/v4/competitions/${competition}/matches`
  );

  if (dateFrom) {
    apiUrl.searchParams.set("dateFrom", dateFrom);
  }

  if (dateTo) {
    apiUrl.searchParams.set("dateTo", dateTo);
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: {
        "X-Auth-Token": token
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return reply({
        error: "Football data request failed.",
        status: response.status,
        message: data.message || "API request unsuccessful."
      }, response.status);
    }

    const matches = (data.matches || []).map(match => ({
      id: match.id,
      date: match.utcDate,
      status: match.status,
      competition: match.competition?.name,
      homeTeam: {
        id: match.homeTeam?.id,
        name: match.homeTeam?.name,
        crest: match.homeTeam?.crest
      },
      awayTeam: {
        id: match.awayTeam?.id,
        name: match.awayTeam?.name,
        crest: match.awayTeam?.crest
      },
      score: {
        home: match.score?.fullTime?.home,
        away: match.score?.fullTime?.away
      }
    }));

    return reply({
      source: "football-data.org",
      competition,
      count: matches.length,
      matches
    });

  } catch (error) {
    return reply({
      error: "Unable to retrieve football data."
    }, 502);
  }
}
