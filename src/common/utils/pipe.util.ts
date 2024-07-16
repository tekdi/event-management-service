export function getTimezoneDate(timeZone: string, nowUtc: Date = new Date()) {
  // converts the current date(UTC) to the timezone ->  2024-07-15T11:07:09.827Z => 2024-07-15T16:37:09.827Z
  const nowTimezone = new Date(
    nowUtc.toLocaleString('en-US', { timeZone: timeZone }),
  );

  const offset = nowTimezone.getTimezoneOffset() * 60000;

  return new Date(nowTimezone.getTime() - offset); //.toISOString() //.slice(0, -1);
}
