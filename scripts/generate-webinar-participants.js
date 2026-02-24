/**
 * Script to generate CSV file with webinar participant data
 * Based on real Zoom webinar API response structure
 * Replicates sample data to create 4000+ records with variations
 * Usage: node scripts/generate-webinar-participants.js [output-file]
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = process.argv[2] || path.join(__dirname, '../data/mock-webinar-participants.csv');
const TARGET_COUNT = 4000;

// Original sample data from Zoom webinar API
const sampleParticipants = [
  {
    id: "cquyjINHTjeGMA6MoGCFbQ",
    user_id: "16778240",
    name: "Program Services",
    user_email: "program_services@aspireleaders.org",
    join_time: "2025-12-17T10:24:25Z",
    leave_time: "2025-12-17T10:36:21Z",
    duration: 716,
    registrant_id: "cquyjINHTjeGMA6MoGCFbQ",
    failover: false,
    status: "in_meeting",
    groupId: "",
    internal_user: true
  },
  {
    id: "",
    user_id: "34579456",
    name: "Varun B500",
    user_email: "rvcode8999+500@gmail.com",
    join_time: "2025-12-17T10:24:57Z",
    leave_time: "2025-12-17T10:26:00Z",
    duration: 63,
    registrant_id: "-d5Fc9G4SfeukY5yjlsqwQ",
    failover: false,
    status: "in_meeting",
    groupId: "",
    internal_user: false
  },
  {
    id: "",
    user_id: "51356672",
    name: "Varun B501",
    user_email: "rvcode8999+501@gmail.com",
    join_time: "2025-12-17T10:26:57Z",
    leave_time: "2025-12-17T10:27:42Z",
    duration: 45,
    registrant_id: "JGgeQK_7RfymbVl3F3ZCRg",
    failover: false,
    status: "in_meeting",
    groupId: "",
    internal_user: false
  },
  {
    id: "",
    user_id: "68133888",
    name: "Varun B501",
    user_email: "rvcode8999+501@gmail.com",
    join_time: "2025-12-17T10:27:53Z",
    leave_time: "2025-12-17T10:28:12Z",
    duration: 19,
    registrant_id: "JGgeQK_7RfymbVl3F3ZCRg",
    failover: false,
    status: "in_meeting",
    groupId: "",
    internal_user: false
  },
  {
    id: "",
    user_id: "84911104",
    name: "Varun B501",
    user_email: "rvcode8999+501@gmail.com",
    join_time: "2025-12-17T10:28:21Z",
    leave_time: "2025-12-17T10:29:54Z",
    duration: 93,
    registrant_id: "JGgeQK_7RfymbVl3F3ZCRg",
    failover: false,
    status: "in_meeting",
    groupId: "",
    internal_user: false
  }
];

/**
 * Generate unique variations of participant data
 */
function generateParticipantVariation(baseParticipant, index) {
  const baseTime = new Date('2025-12-17T10:24:25Z');
  
  // Vary join time (add random minutes between 0-120)
  const joinTimeOffset = Math.floor(Math.random() * 120) * 60 * 1000;
  const joinTime = new Date(baseTime.getTime() + joinTimeOffset);
  
  // Vary duration (between 10 seconds to 2 hours)
  const duration = Math.floor(10 + Math.random() * 7200);
  const leaveTime = new Date(joinTime.getTime() + duration * 1000);
  
  // Keep original registrant_id (no suffix) - allows multiple sessions per user
  // This matches real Zoom webinar behavior where same user can have multiple sessions
  const registrantId = baseParticipant.registrant_id || `reg-${index}`;
  
  // Vary user_id (increment base) to make each record unique
  const baseUserId = parseInt(baseParticipant.user_id) || 10000000;
  const userId = (baseUserId + index).toString();
  
  // Vary email if it's not the program services one
  let userEmail = baseParticipant.user_email;
  if (!baseParticipant.internal_user) {
    const emailParts = userEmail.split('@');
    const emailMatch = emailParts[0].match(/^(.+?)(\+(\d+))?$/);
    if (emailMatch) {
      const emailBase = emailMatch[1];
      const emailNumber = emailMatch[3] ? parseInt(emailMatch[3]) : 0;
      const newNumber = (emailNumber + Math.floor(index / 5)) % 1000;
      userEmail = `${emailBase}+${newNumber}@${emailParts[1]}`;
    }
  }
  
  // Vary name
  let name = baseParticipant.name;
  if (!baseParticipant.internal_user) {
    const nameMatch = name.match(/(\w+)\s*(\w*)/);
    if (nameMatch) {
      const nameNumber = parseInt(nameMatch[2].replace(/\D/g, '') || '0');
      const newNumber = (nameNumber + Math.floor(index / 5)) % 1000;
      name = `${nameMatch[1]} B${newNumber}`;
    }
  }
  
  // Vary status (90% in_meeting, 10% left)
  const status = Math.random() > 0.1 ? 'in_meeting' : 'left';
  
  // Generate ID (matches original format)
  // Program Services: id = registrant_id (same value)
  // Others: id = "" (empty string)
  const id = baseParticipant.internal_user 
    ? registrantId  // Program Services: id matches registrant_id
    : '';  // Others: empty string
  
  return {
    id: id,
    user_id: userId,
    name: name,
    user_email: userEmail,
    join_time: joinTime.toISOString(),
    leave_time: leaveTime.toISOString(),
    duration: duration,
    registrant_id: registrantId,
    failover: false,
    status: status,
    groupId: "",
    internal_user: baseParticipant.internal_user
  };
}

/**
 * Generate CSV content
 */
function generateCSV() {
  const header = 'registrant_id,user_email,name,join_time,leave_time,duration,status\n';
  const rows = [];
  
  // Calculate how many times to repeat the sample (5 participants)
  const repeats = Math.ceil(TARGET_COUNT / sampleParticipants.length);
  
  let globalIndex = 0;
  
  // Repeat the sample data
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (let i = 0; i < sampleParticipants.length; i++) {
      if (globalIndex >= TARGET_COUNT) break;
      
      const baseParticipant = sampleParticipants[i];
      const variation = generateParticipantVariation(baseParticipant, globalIndex);
      
      const row = [
        variation.registrant_id,
        variation.user_email,
        variation.name,
        variation.join_time,
        variation.leave_time,
        variation.duration,
        variation.status
      ].join(',');
      
      rows.push(row);
      globalIndex++;
    }
    
    if (globalIndex >= TARGET_COUNT) break;
  }
  
  return header + rows.join('\n');
}

/**
 * Generate JSON file for reference
 */
function generateJSON() {
  const participants = [];
  const repeats = Math.ceil(TARGET_COUNT / sampleParticipants.length);
  
  let globalIndex = 0;
  
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (let i = 0; i < sampleParticipants.length; i++) {
      if (globalIndex >= TARGET_COUNT) break;
      
      const baseParticipant = sampleParticipants[i];
      const variation = generateParticipantVariation(baseParticipant, globalIndex);
      
      participants.push({
        id: variation.id,
        user_id: variation.user_id,
        name: variation.name,
        user_email: variation.user_email,
        join_time: variation.join_time,
        leave_time: variation.leave_time,
        duration: variation.duration,
        registrant_id: variation.registrant_id,
        failover: variation.failover,
        status: variation.status,
        groupId: variation.groupId,
        internal_user: variation.internal_user
      });
      
      globalIndex++;
    }
    
    if (globalIndex >= TARGET_COUNT) break;
  }
  
  // Return 2000 records in JSON (instead of just 300)
  const jsonRecordCount = Math.min(2000, participants.length);
  
  return {
    page_count: 1,
    page_size: 300,
    total_records: participants.length,
    next_page_token: participants.length > jsonRecordCount ? "page-2" : "",
    participants: participants.slice(0, jsonRecordCount) // First 2000 records for reference
  };
}

// Write CSV file
try {
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvContent = generateCSV();
  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf-8');

  console.log(`✅ Generated ${TARGET_COUNT} webinar participants in ${OUTPUT_FILE}`);
  console.log(`   File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
  console.log(`   Total pages (300 per page): ${Math.ceil(TARGET_COUNT / 300)}`);
  
  // Also generate JSON reference file
  const jsonFile = OUTPUT_FILE.replace('.csv', '.json');
  const jsonContent = generateJSON();
  fs.writeFileSync(jsonFile, JSON.stringify(jsonContent, null, 2), 'utf-8');
  console.log(`✅ Generated JSON reference file: ${jsonFile}`);
  
} catch (error) {
  console.error('❌ Error generating files:', error.message);
  process.exit(1);
}

