/**
 * Generate 4K+ Zoom participants from base 13 records
 * Creates zoom-dummy-data-4k.json with pagination support
 */

const fs = require('fs');
const path = require('path');

// Base participants from your Zoom API response
const baseParticipants = [
  {
    "id": "cquyjINHTjeGMA6MoGCFbQ",
    "user_id": "16778240",
    "name": "Program Services",
    "user_email": "program_services@aspireleaders.org",
    "join_time": "2025-12-01T11:13:11Z",
    "leave_time": "2025-12-01T11:19:47Z",
    "duration": 396,
    "registrant_id": "",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": true
  },
  {
    "id": "",
    "user_id": "16781312",
    "name": "Tushartest Mahajan",
    "user_email": "tusharmakeid+bulkimptest+634@yopmail.com",
    "join_time": "2025-12-01T11:13:48Z",
    "leave_time": "2025-12-01T12:12:24Z",
    "duration": 3516,
    "registrant_id": "-dwrqhweSF6iEC1cwqabrg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "cquyjINHTjeGMA6MoGCFbQ",
    "user_id": "16782336",
    "name": "Program Services",
    "user_email": "program_services@aspireleaders.org",
    "join_time": "2025-12-01T11:18:44Z",
    "leave_time": "2025-12-01T11:55:57Z",
    "duration": 2233,
    "registrant_id": "",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": true
  },
  {
    "id": "",
    "user_id": "16783360",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:22:04Z",
    "leave_time": "2025-12-01T11:25:23Z",
    "duration": 199,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16784384",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:24:31Z",
    "leave_time": "2025-12-01T11:36:06Z",
    "duration": 695,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16785408",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:33:49Z",
    "leave_time": "2025-12-01T11:36:02Z",
    "duration": 133,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16786432",
    "name": "Varun B13",
    "user_email": "rvcode8999+13@gmail.com",
    "join_time": "2025-12-01T11:34:02Z",
    "leave_time": "2025-12-01T12:12:24Z",
    "duration": 2302,
    "registrant_id": "pAdhnF9DSSS3XcJ3mz0m3w",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16787456",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:36:03Z",
    "leave_time": "2025-12-01T11:39:44Z",
    "duration": 221,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16788480",
    "name": "Varun B554",
    "user_email": "rvcode8999+554@gmail.com",
    "join_time": "2025-12-01T11:38:08Z",
    "leave_time": "2025-12-01T11:59:47Z",
    "duration": 1299,
    "registrant_id": "yu_fvu6jSQuazKcLjy_6-Q",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16789504",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:40:09Z",
    "leave_time": "2025-12-01T11:43:46Z",
    "duration": 217,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16790528",
    "name": "Varun B1",
    "user_email": "rvcode8999+1@gmail.com",
    "join_time": "2025-12-01T11:43:46Z",
    "leave_time": "2025-12-01T11:47:50Z",
    "duration": 244,
    "registrant_id": "d-dOamlNR1ClrBel0IGNpg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16791552",
    "name": "Varun B3",
    "user_email": "rvcode8999+3@gmail.com",
    "join_time": "2025-12-01T11:48:42Z",
    "leave_time": "2025-12-01T11:57:56Z",
    "duration": 554,
    "registrant_id": "QCib9oFcS2i-d6Sniakjyg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  },
  {
    "id": "",
    "user_id": "16792576",
    "name": "Varun B3",
    "user_email": "rvcode8999+3@gmail.com",
    "join_time": "2025-12-01T11:57:56Z",
    "leave_time": "2025-12-01T12:05:59Z",
    "duration": 483,
    "registrant_id": "QCib9oFcS2i-d6Sniakjyg",
    "failover": false,
    "status": "in_meeting",
    "groupId": "",
    "internal_user": false
  }
];

// Filter to only users with registrant_id (11 users)
const usersWithRegistrantId = baseParticipants.filter(
  p => p.registrant_id && p.registrant_id.trim() !== '' && !p.internal_user
);

console.log(`Found ${usersWithRegistrantId.length} users with registrant_id:`);
usersWithRegistrantId.forEach(p => {
  console.log(`  - ${p.user_email} -> ${p.registrant_id}`);
});

// Generate 4,500 participants
const totalParticipants = 4500;
const pageSize = 300;
const totalPages = Math.ceil(totalParticipants / pageSize);
const repeatsPerUser = Math.ceil(totalParticipants / usersWithRegistrantId.length);

console.log(`\nRepeating each user ~${repeatsPerUser} times to reach ${totalParticipants} total participants`);

const allParticipants = [];

// Repeat each user multiple times, keeping email and registrant_id the same
for (let i = 0; i < totalParticipants; i++) {
  const userIndex = i % usersWithRegistrantId.length;
  const baseUser = usersWithRegistrantId[userIndex];
  const participant = JSON.parse(JSON.stringify(baseUser)); // Deep copy
  
  // Keep email and registrant_id EXACTLY the same
  // Only change: duration, join_time, leave_time, user_id (for uniqueness in Zoom)
  
  // Make user_id unique (Zoom requires unique IDs)
  participant.user_id = String(16778240 + i);
  
  // Vary join/leave times (within meeting duration)
  const baseJoinTime = new Date('2025-12-01T11:13:00Z');
  const meetingDuration = 2 * 60 * 60 * 1000; // 2 hours
  const randomOffset = Math.floor(Math.random() * meetingDuration);
  const joinTime = new Date(baseJoinTime.getTime() + randomOffset);
  
  participant.join_time = joinTime.toISOString();
  
  // Vary duration (5 minutes to 35 minutes)
  const duration = Math.floor(Math.random() * 1800 + 300); // 300-2100 seconds
  participant.duration = duration;
  
  const leaveTime = new Date(joinTime.getTime() + duration * 1000);
  participant.leave_time = leaveTime.toISOString();
  
  // Keep everything else the same (email, registrant_id, name)
  allParticipants.push(participant);
}

// Create paginated data structure
const paginatedData = {
  allParticipants: allParticipants,
  pageSize: pageSize,
  totalPages: totalPages,
  totalRecords: totalParticipants
};

// Save to file
const outputPath = path.join(__dirname, 'zoom-dummy-data-4k.json');
fs.writeFileSync(outputPath, JSON.stringify(paginatedData, null, 2));

console.log(`✅ Generated ${totalParticipants} participants`);
console.log(`✅ Total pages: ${totalPages} (${pageSize} per page)`);
console.log(`✅ Saved to: ${outputPath}`);
console.log(`\n📊 Sample registrantIds:`);
const sampleRegistrantIds = [...new Set(allParticipants.slice(0, 50).map(p => p.registrant_id).filter(Boolean))];
console.log(sampleRegistrantIds.slice(0, 10).join(', '), '...');


