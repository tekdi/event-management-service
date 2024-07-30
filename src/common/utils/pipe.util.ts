export function getTimezoneDate(
  timeZone: string,
  nowUtc: Date = new Date(),
): Date {
  // function accepts date in UTC
  // converts the current date(UTC) to the timezone ->  2024-07-15T11:07:09.827Z => 2024-07-15T16:37:09.827Z
  const nowTimezone = new Date(
    nowUtc.toLocaleString('en-US', { timeZone: timeZone }),
  );

  const offset = nowTimezone.getTimezoneOffset() * 60000;

  return new Date(nowTimezone.getTime() - offset); //.toISOString() //.slice(0, -1);
}

export function getTimezoneDateString(
  timezoneOffset: number,
  timeZone: string,
  timezoneOffsetString: string,
  utcDate: Date,
): string {
  // Format the date to the desired format
  const formattedDate = utcDate.toLocaleString('en-GB', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });

  // Replace the default locale date format separators with the desired format
  const [date, time] = formattedDate.split(', ');
  const [day, month, year] = date.split('/');
  const formattedDateStr = `${year}-${month}-${day} ${time.replace('.', ':')} ${timezoneOffsetString}`;

  return formattedDateStr;
}
