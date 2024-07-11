export function getTimezoneCurrentDate(timeZone: string) {
    const nowUtc = new Date();
    const nowTimezone = new Date(nowUtc.toLocaleString('en-US', { timeZone: timeZone }));

    const offset = nowTimezone.getTimezoneOffset() * 60000;

    return new Date(nowTimezone.getTime() - offset) //.toISOString() //.slice(0, -1);
}