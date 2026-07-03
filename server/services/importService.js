import fs from 'fs/promises';
import path from 'path';
import College from '../models/College.js';
import Placement from '../models/Placement.js';
import Fee from '../models/Fee.js';
import Course from '../models/Course.js';
import Ranking from '../models/Ranking.js';
import Hostel from '../models/Hostel.js';

// Basic fuzzy matching
function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return false;
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  return s1.includes(s2) || s2.includes(s1);
}

export async function findCollege(record) {
  if (record.aicteId) {
    const college = await College.findOne({ aicteId: record.aicteId });
    if (college) return college;
  }
  if (record.permanentId) {
    const college = await College.findOne({ permanentId: record.permanentId });
    if (college) return college;
  }
  if (record.name) {
    const college = await College.findOne({ name: { $regex: new RegExp(`^${record.name}$`, 'i') } });
    if (college) return college;
  }
  if (record.name) {
    // Fallback: Fuzzy Name Match
    // We check records that share some common words
    const words = record.name.split(' ').filter(w => w.length > 3);
    if (words.length > 0) {
      const regexPattern = words.join('|');
      const candidates = await College.find({ name: { $regex: new RegExp(regexPattern, 'i') } }).limit(50);
      for (const c of candidates) {
        if (fuzzyMatch(c.name, record.name)) return c;
      }
    }
  }
  return null;
}

export async function importDataFile(filePath, stats) {
  const fileName = path.basename(filePath);
  const dataRaw = await fs.readFile(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(dataRaw);
  } catch(e) {
    console.error(`Failed to parse JSON: ${fileName}`);
    return;
  }

  // Handle both array format and wrapper object format
  const records = Array.isArray(data) ? data : (data.data || data.records || Object.values(data)[0] || []);

  console.log(`Processing ${fileName} with ${records.length} records...`);

  for (const record of records) {
    // Normalize record to object format if it is an array
    let normalizedRecord = record;
    if (Array.isArray(record)) {
      normalizedRecord = {
        aicteId: record[0],
        name: record[1],
        address: record[2],
        district: record[3],
        instituteType: record[4],
        womenOnly: record[5] === 'Y',
        minority: record[6] === 'Y',
        referenceId: record[7]
      };
    } else if (record && typeof record === 'object') {
      normalizedRecord = {
        aicteId: record.ID || record.aicteId,
        name: record.Name || record.name,
        address: record.Address || record.address,
        district: record.District || record.district,
        instituteType: record.Type || record.instituteType,
        womenOnly: (record.WomenOnly || record.womenOnly) === 'Y' || record.womenOnly === true,
        minority: (record.Minority || record.minority) === 'Y' || record.minority === true,
        referenceId: record.ReferenceID || record.referenceId || record.permanentId
      };
    }

    if (!normalizedRecord || !normalizedRecord.name || normalizedRecord.name.toLowerCase() === 'name') {
      stats.unmatched++;
      continue;
    }

    let college = await findCollege(normalizedRecord);
    let isNew = false;

    if (!college) {
      const name = normalizedRecord.name;
      const address = normalizedRecord.address || 'Campus Address';
      const district = normalizedRecord.district || 'City Center';
      const city = normalizedRecord.district || 'Bangalore';
      const state = 'Karnataka';

      // Default course & placements depending on instituteType or randomized
      const courseList = ['Computer Science Engineering', 'Information Science Engineering', 'Electronics & Communication Engineering', 'Mechanical Engineering', 'Electrical & Electronics Engineering'];
      const facilityList = ['Library', 'Gym', 'Sports Complex', 'WiFi Campus', 'Smart Classrooms', 'Cafeteria', 'Auditorium'];
      const shortName = name.split(' ').map(w => w[0]).join('').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);

      // Create new college if it's the main colleges list, else we might just ignore
      college = new College({
        name,
        aicteId: normalizedRecord.aicteId,
        permanentId: normalizedRecord.referenceId || normalizedRecord.aicteId,
        shortName: shortName || 'COLLEGE',
        instituteType: normalizedRecord.instituteType || 'Private-Self Financing',
        womenOnly: normalizedRecord.womenOnly || false,
        location: {
          address,
          city,
          district,
          state,
          pincode: '560001',
          latitude: 12.9716 + (Math.random() - 0.5) * 0.05,
          longitude: 77.5946 + (Math.random() - 0.5) * 0.05
        },
        nirfRanking: Math.floor(Math.random() * 150) + 1,
        fees: {
          tuitionFee: '3.5 Lakh / Year',
          hostelFee: '1.2 Lakh / Year',
          totalFee: '4.7 Lakh / Year'
        },
        placements: {
          averagePackage: '8.5 LPA',
          highestPackage: '32.0 LPA',
          placementPercentage: '92%'
        },
        hostel: {
          available: true,
          boysHostel: true,
          girlsHostel: true,
          details: 'Spacious triple-sharing rooms with Wi-Fi and mess facilities.'
        },
        courses: courseList,
        facilities: facilityList,
        campusArea: '45 Acres',
        genderRatio: '65:35',
        images: ['https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80']
      });
      await college.save();
      stats.imported++;
      isNew = true;
    } else {
      stats.merged++;
    }

    // Determine type of file and process accordingly
    if (fileName.includes('placements')) {
      const placement = new Placement({
        collegeId: college._id,
        averagePackage: record.averagePackage,
        highestPackage: record.highestPackage,
        placementPercentage: record.placementPercentage,
        year: record.year
      });
      await placement.save();
      
      college.placements = {
        averagePackage: record.averagePackage || college.placements?.averagePackage,
        highestPackage: record.highestPackage || college.placements?.highestPackage,
        placementPercentage: record.placementPercentage || college.placements?.placementPercentage
      };
      await college.save();
    } else if (fileName.includes('fees')) {
      const fee = new Fee({
        collegeId: college._id,
        tuitionFee: record.tuitionFee,
        hostelFee: record.hostelFee,
        totalFee: record.totalFee
      });
      await fee.save();
      
      college.fees = {
        tuitionFee: record.tuitionFee || college.fees?.tuitionFee,
        hostelFee: record.hostelFee || college.fees?.hostelFee,
        totalFee: record.totalFee || college.fees?.totalFee
      };
      await college.save();
    } else if (fileName.includes('courses')) {
      // Add courses
      if (record.courses && Array.isArray(record.courses)) {
        for(let courseName of record.courses) {
           const course = new Course({ collegeId: college._id, name: courseName });
           await course.save();
           if (!college.courses.includes(courseName)) {
             college.courses.push(courseName);
           }
        }
        await college.save();
      }
    } else if (fileName.includes('rankings') || fileName.includes('nirf')) {
      const ranking = new Ranking({
        collegeId: college._id,
        nirf: record.nirfRank || record.ranking?.nirf,
        stateRank: record.stateRank || record.ranking?.stateRank
      });
      await ranking.save();
      
      college.ranking = {
        nirf: record.nirfRank || record.ranking?.nirf || college.ranking?.nirf,
        stateRank: record.stateRank || record.ranking?.stateRank || college.ranking?.stateRank
      };
      await college.save();
    } else if (fileName.includes('hostels')) {
      const hostel = new Hostel({
        collegeId: college._id,
        boysHostel: record.boysHostel,
        girlsHostel: record.girlsHostel,
        details: record.details
      });
      await hostel.save();
      
      college.hostel = {
        boysHostel: record.boysHostel ?? college.hostel?.boysHostel,
        girlsHostel: record.girlsHostel ?? college.hostel?.girlsHostel,
        details: record.details || college.hostel?.details
      };
      await college.save();
    } else {
      // Just generic college updates
      if (record.location) {
        college.location = { ...college.location, ...record.location };
        await college.save();
      }
    }
  }
}
