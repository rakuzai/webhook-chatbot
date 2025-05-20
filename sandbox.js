const INACTIVITY_THRESHOLD_MS = 1 * 60 * 1000; // 5 minutes

function isUserInactive(lastActivityTimestamp) {
  if (!lastActivityTimestamp) return true;

  const lastActivity = new Date(lastActivityTimestamp).getTime();
  const now = new Date().getTime();

  return now - lastActivity > INACTIVITY_THRESHOLD_MS;
}

// Plug in the value
const lastActivityTimestamp = "2025-05-20T08:01:44.341+00:00";

console.log("Is user inactive?", isUserInactive(lastActivityTimestamp));
