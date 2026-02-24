/**
 * Script to generate a CSV file with 4000 mock Zoom participants
 * Usage: node scripts/generate-mock-participants.js [output-file]
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = process.argv[2] || path.join(__dirname, '../data/mock-participants.csv');
const PARTICIPANT_COUNT = 4000;

// Generate random timestamp within last 7 days
function randomTimestamp() {
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const randomTime = sevenDaysAgo + Math.random() * (now - sevenDaysAgo);
  return new Date(randomTime).toISOString();
}

// Generate random duration between 5 minutes and 2 hours
function randomDuration(joinTime) {
  const minDuration = 5 * 60; // 5 minutes
  const maxDuration = 2 * 60 * 60; // 2 hours
  const duration = Math.floor(minDuration + Math.random() * (maxDuration - minDuration));
  const leaveTime = new Date(new Date(joinTime).getTime() + duration * 1000);
  return {
    duration,
    leaveTime: leaveTime.toISOString(),
  };
}

// Generate CSV content
function generateCSV() {
  const header = 'registrant_id,user_email,name,join_time,leave_time,duration,status\n';
  const rows = [];

  for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
    const joinTime = randomTimestamp();
    const { duration, leaveTime } = randomDuration(joinTime);
    const status = i % 10 === 0 ? 'left' : 'in_meeting'; // 10% have left status

    const row = [
      `reg-${i}`,
      `participant${i}@example.com`,
      `Participant ${i}`,
      joinTime,
      leaveTime,
      duration,
      status,
    ].join(',');

    rows.push(row);
  }

  return header + rows.join('\n');
}

// Write CSV file
try {
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvContent = generateCSV();
  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf-8');

  console.log(`✅ Generated ${PARTICIPANT_COUNT} participants in ${OUTPUT_FILE}`);
  console.log(`   File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('❌ Error generating CSV file:', error.message);
  process.exit(1);
}



