import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import College from '../models/College.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import { syncCollegeToVectorDb } from '../services/chromaService.js';
import { syncCollegeToSearch, syncAllCollegesToSearch } from '../services/searchService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockColleges = [
  {
    name: 'RV College of Engineering',
    shortName: 'RVCE',
    location: {
      address: 'Mysore Road, RV Vidyaniketan, Post',
      city: 'Bangalore',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560059',
      latitude: 12.9226,
      longitude: 77.4980
    },
    nirfRanking: 96,
    instituteType: 'Autonomous',
    fees: {
      tuition: '3.5 Lakh / Year',
      hostel: '1.25 Lakh / Year',
      miscellaneous: '25,000 / Year'
    },
    placements: {
      averagePackage: '12.5 LPA',
      highestPackage: '62.0 LPA',
      placementPercentage: '97%'
    },
    hostel: {
      available: true,
      boysHostel: true,
      girlsHostel: true,
      details: 'Comfortable occupancy options with multi-cuisine dining, solar water heating, and common study rooms.'
    },
    courses: [
      'Computer Science Engineering',
      'Information Science Engineering',
      'Electronics & Communication Engineering',
      'Mechanical Engineering',
      'Artificial Intelligence & Machine Learning'
    ],
    facilities: [
      'Digital Library',
      'Sports Ground',
      'Hi-Tech Seminar Halls',
      'High-Speed Wi-Fi Campus',
      'Auditorium',
      'Health Center'
    ],
    campusArea: '52 Acres',
    genderRatio: '68:32',
    aiSummary: 'RV College of Engineering (RVCE) established in 1963 is one of the top self-financing engineering colleges in India. Known for its strong placements and research orientation, it has consistently achieved 95%+ placement rates in premium tech conglomerates. With a green 52-acre campus on Mysore Road, it offers top-tier facilities, an active student community, and notable alumni across the global tech landscape.',
    images: [
      'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    name: 'BMS College of Engineering',
    shortName: 'BMSCE',
    location: {
      address: 'Bull Temple Rd, Basavanagudi',
      city: 'Bangalore',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560019',
      latitude: 12.9412,
      longitude: 77.5659
    },
    nirfRanking: 101,
    instituteType: 'Autonomous',
    fees: {
      tuition: '3.2 Lakh / Year',
      hostel: '1.1 Lakh / Year',
      miscellaneous: '20,000 / Year'
    },
    placements: {
      averagePackage: '9.8 LPA',
      highestPackage: '50.0 LPA',
      placementPercentage: '94%'
    },
    hostel: {
      available: true,
      boysHostel: true,
      girlsHostel: true,
      details: 'Well-furnished hostels in Basavanagudi area with dynamic mess menus and 24x7 power back-up.'
    },
    courses: [
      'Computer Science Engineering',
      'Information Science Engineering',
      'Electronics & Communication Engineering',
      'Civil Engineering',
      'Chemical Engineering'
    ],
    facilities: [
      'Historical Library',
      'Indoor Gym',
      'Football Stadium',
      'High-Speed Wi-Fi',
      'Cafeteria',
      'Innovation Lab'
    ],
    campusArea: '15 Acres',
    genderRatio: '60:40',
    aiSummary: 'BMS College of Engineering (BMSCE) founded in 1946 by Sri. B. M. Sreenivasaiah is the first private sector initiative in engineering education in India. Located in the heart of historic Basavanagudi, BMSCE boasts a rich legacy of academic excellence, massive alumni network, and excellent core placements. It features strong tie-ups with global tech leaders and offers a balanced gender ratio and vibrant co-curricular culture.',
    images: [
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    name: 'Christ University',
    shortName: 'CU',
    location: {
      address: 'Hosur Rd, Bhavani Nagar, S.G. Palya',
      city: 'Bangalore',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560029',
      latitude: 12.9344,
      longitude: 77.6059
    },
    nirfRanking: 60,
    instituteType: 'Deemed University',
    fees: {
      tuition: '2.5 Lakh / Year',
      hostel: '1.4 Lakh / Year',
      miscellaneous: '30,000 / Year'
    },
    placements: {
      averagePackage: '7.8 LPA',
      highestPackage: '25.0 LPA',
      placementPercentage: '89%'
    },
    hostel: {
      available: true,
      boysHostel: true,
      girlsHostel: true,
      details: 'Modern amenities with biometric attendance, laundry services, and multi-facility recreation halls.'
    },
    courses: [
      'Bachelor of Business Administration',
      'Bachelor of Commerce (Honours)',
      'B.Tech in Computer Science',
      'M.Sc in Data Science',
      'Bachelor of Arts (Psychology)'
    ],
    facilities: [
      'Ultra-Modern Library',
      'State-of-the-art Gym',
      'Auditoriums (Multi-hall)',
      'Sublime Green Gardens',
      'Food Courts',
      'Cricket Field'
    ],
    campusArea: '25 Acres',
    genderRatio: '45:55',
    aiSummary: 'Christ University (Deemed to be University) is a highly prestigious, multi-disciplinary institution in Bangalore known for its strict discipline, holistic pedagogy, and premium management programs (BBA/MBA). The main campus on Hosur Road is a lush green sanctuary within the city. It attracts students globally and has highly active student-led committees, regular arts festivals, and extensive corporate connections.',
    images: [
      'https://images.unsplash.com/photo-1498243691581-b145c3f54a5c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    name: 'IIIT Bangalore',
    shortName: 'IIITB',
    location: {
      address: '26/C, Hosur Rd, Electronics City Phase 1',
      city: 'Bangalore',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      pincode: '560100',
      latitude: 12.8449,
      longitude: 77.6631
    },
    nirfRanking: 74,
    instituteType: 'Autonomous (Non-profit PPP)',
    fees: {
      tuition: '4.0 Lakh / Year',
      hostel: '1.5 Lakh / Year',
      miscellaneous: '15,000 / Year'
    },
    placements: {
      averagePackage: '26.5 LPA',
      highestPackage: '95.0 LPA',
      placementPercentage: '99%'
    },
    hostel: {
      available: true,
      boysHostel: true,
      girlsHostel: true,
      details: 'Fully residential campus. Individual student rooms, modern gym facilities, and premium mess services.'
    },
    courses: [
      'Integrated M.Tech (CSE)',
      'Integrated M.Tech (ECE)',
      'M.Tech in Computer Science',
      'M.Sc in Digital Society',
      'Ph.D. in IT'
    ],
    facilities: [
      'Advanced Research Labs',
      '24/7 Library access',
      'Sports Arena',
      'High-Speed Campus LAN',
      'Innovation Center',
      'Smart Classrooms'
    ],
    campusArea: '9 Acres',
    genderRatio: '78:22',
    aiSummary: 'The International Institute of Information Technology Bangalore (IIITB) is a premier graduate institute located in Electronic City, the tech heart of Bangalore. Established in 1999, it focuses exclusively on IT education and research. Offering integrated courses and post-graduate studies, IIITB boasts an extraordinary average package of 26.5 LPA, making it one of the absolute best institutions for Computer Science and Electronics globally.',
    images: [
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1525920980995-f8a382bf42c5?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    name: 'IIT Bombay',
    shortName: 'IITB-M',
    location: {
      address: 'Main Gate Rd, IIT Area, Powai',
      city: 'Mumbai',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      pincode: '400076',
      latitude: 19.1334,
      longitude: 72.9133
    },
    nirfRanking: 3,
    instituteType: 'Government Institute of National Importance',
    fees: {
      tuition: '2.2 Lakh / Year',
      hostel: '40,000 / Year',
      miscellaneous: '10,000 / Year'
    },
    placements: {
      averagePackage: '21.8 LPA',
      highestPackage: '1.6 CR / Year',
      placementPercentage: '96%'
    },
    hostel: {
      available: true,
      boysHostel: true,
      girlsHostel: true,
      details: '18 student hostels overlooking Powai Lake, equipped with common rooms, libraries, and active sports areas.'
    },
    courses: [
      'B.Tech in Computer Science & Engineering',
      'B.Tech in Electrical Engineering',
      'B.Tech in Aerospace Engineering',
      'Dual Degree (B.Tech + M.Tech)',
      'Master of Design'
    ],
    facilities: [
      'Central Library (IITB)',
      'Swimming Pool',
      'Olympic Standard Athletics Track',
      'Wind Tunnel Research Lab',
      'Supercomputing Facility',
      'Auditoriums'
    ],
    campusArea: '550 Acres',
    genderRatio: '80:20',
    aiSummary: 'Indian Institute of Technology Bombay (IIT Bombay) established in 1958 is a flagship public university located in Powai, Mumbai. Regarded as the most sought-after engineering institute in India, it features world-class research infrastructure, a sprawling 550-acre lakeside campus, and a stellar reputation. IIT Bombay produces leaders across science, business, startups, and tech fields globally.',
    images: [
      'https://images.unsplash.com/photo-1541829011-5586454ee1f3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80'
    ]
  }
];

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform';

  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // Clear collections
    console.log('Clearing existing collections...');
    await College.deleteMany({});
    await Review.deleteMany({});
    await User.deleteMany({});

    // Create an Admin user and a student user for testing
    console.log('Seeding demo accounts...');
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: 'admin@college.com',
      password: 'adminpassword123',
      role: 'admin'
    });

    const studentUser = await User.create({
      name: 'Rahul Sharma',
      email: 'rahul@student.com',
      password: 'studentpassword123',
      role: 'student'
    });

    console.log('Demo Accounts created successfully:');
    console.log('- Admin: admin@college.com (password: adminpassword123)');
    console.log('- Student: rahul@student.com (password: studentpassword123)');

    // Seed Colleges from JSON file
    console.log('Loading colleges from AICTE JSON data...');
    const jsonPath = path.join(__dirname, '../data/AICTE_All_Colleges_Demo_Filled.json');
    let aicteColleges = [];
    try {
      if (fs.existsSync(jsonPath)) {
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const parsedData = JSON.parse(rawData);
        console.log(`Loaded ${parsedData.length} colleges from JSON.`);
        
        aicteColleges = parsedData.map(item => {
          const name = item.Name || item.name || 'Unnamed College';
          const aicteId = item.ID || item.aicteId || undefined;
          const permanentId = item.ReferenceID || item.permanentId || undefined;
          const instituteType = item.Type || item.instituteType || 'Co-Ed';
          
          let womenOnly = false;
          if (typeof item.womenOnly === 'boolean') {
            womenOnly = item.womenOnly;
          } else if (item.WomenOnly === 'Y') {
            womenOnly = true;
          }

          let hostelAvailable = false;
          if (typeof item.hostelAvailable === 'boolean') {
            hostelAvailable = item.hostelAvailable;
          } else if (item.hostel?.boysHostel || item.hostel?.girlsHostel) {
            hostelAvailable = true;
          }

          let address = '';
          let district = '';
          let city = '';
          let state = '';
          let latitude = 12.9716;
          let longitude = 77.5946;

          if (item.location) {
            address = item.location.address || '';
            district = item.location.district || '';
            city = item.location.city || district || '';
            state = item.location.state || '';
            latitude = item.location.latitude || 12.9716;
            longitude = item.location.longitude || 77.5946;
          } else {
            address = item.Address || '';
            district = item.District || '';
            city = district || '';
          }

          if (!city && district) {
            city = district;
          }
          if (!state && district) {
            const d = district.toLowerCase();
            if (d === 'ghaziabad') {
              state = 'Uttar Pradesh';
              latitude = 28.6692;
              longitude = 77.4538;
            } else if (d === 'belgaum' || d === 'belagavi' || d === 'gadag' || d === 'gulbarga' || d === 'kalaburagi' || d === 'udupi' || d === 'ramanagara' || d === 'bangalore urban' || d === 'bangalore rural' || d === 'bijapur') {
              state = 'Karnataka';
              latitude = 12.9716 + (Math.random() - 0.5) * 0.1;
              longitude = 77.5946 + (Math.random() - 0.5) * 0.1;
            } else {
              state = 'Karnataka';
            }
          }

          const averagePackage = item.placements?.averagePackage || '0 LPA';
          const medianPackage = item.placements?.medianPackage || '0 LPA';
          const highestPackage = item.placements?.highestPackage || '0 LPA';
          const placementPercentage = item.placements?.placementPercentage ? String(item.placements.placementPercentage) : '0';

          const tuitionFee = item.fees?.tuitionFee ? String(item.fees.tuitionFee) : '0';
          const hostelFee = item.fees?.hostelFee ? String(item.fees.hostelFee) : '0';
          const totalFee = item.fees?.totalFee ? String(item.fees.totalFee) : '0';

          const shortName = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 10);

          return {
            aicteId,
            permanentId,
            name,
            shortName,
            instituteType,
            womenOnly,
            hostelAvailable,
            location: {
              address,
              district,
              city: city || 'Bangalore',
              state: state || 'Karnataka',
              latitude,
              longitude
            },
            ranking: {
              nirf: item.ranking?.nirf || 999,
              stateRank: item.ranking?.stateRank || 999
            },
            placements: {
              averagePackage,
              medianPackage,
              highestPackage,
              placementPercentage
            },
            fees: {
              tuitionFee,
              hostelFee,
              totalFee,
              tuition: tuitionFee + ' / Year',
              hostel: hostelFee + ' / Year'
            },
            hostel: {
              boysHostel: item.hostel?.boysHostel || false,
              girlsHostel: item.hostel?.girlsHostel || false,
              details: item.hostel?.details || ''
            },
            courses: item.courses || [],
            facilities: item.facilities || [],
            aiSummary: item.aiSummary || '',
            nearbyPlaces: [],
            reviews: []
          };
        });
      } else {
        console.warn(`JSON file not found at ${jsonPath}. Seeding mock colleges only.`);
      }
    } catch (err) {
      console.warn('Error reading or parsing AICTE JSON data:', err.message);
    }

    // Deduplicate colleges to prevent MongoDB Unique constraint errors on aicteId or permanentId
    const seenAicteIds = new Set();
    const seenNames = new Set();

    mockColleges.forEach(c => {
      if (c.aicteId) seenAicteIds.add(c.aicteId);
      seenNames.add(c.name.toLowerCase());
    });

    const uniqueAicteColleges = [];
    for (const college of aicteColleges) {
      const lowerName = college.name.toLowerCase();
      if (college.aicteId && seenAicteIds.has(college.aicteId)) {
        continue;
      }
      if (seenNames.has(lowerName)) {
        continue;
      }
      if (college.aicteId) seenAicteIds.add(college.aicteId);
      seenNames.add(lowerName);
      uniqueAicteColleges.push(college);
    }

    const collegesToSeed = [...mockColleges, ...uniqueAicteColleges];
    console.log(`Inserting ${collegesToSeed.length} college documents in bulk...`);
    
    const savedColleges = await College.insertMany(collegesToSeed);
    console.log(`Successfully seeded ${savedColleges.length} colleges.`);

    // Seed some reviews for Colleges
    console.log('Seeding reviews...');
    const rvCollege = savedColleges.find(c => c.shortName === 'RVCE');
    if (rvCollege && studentUser) {
      const review1 = await Review.create({
        userId: studentUser._id,
        collegeId: rvCollege._id,
        rating: 5,
        review: 'RVCE has an incredible placement record. The CSE department is top-notch with great professors and strong competitive coding culture. Fully recommend!',
        upvotes: [adminUser._id]
      });

      rvCollege.reviews.push(review1._id);
      await rvCollege.save();
    }

    const iitBombay = savedColleges.find(c => c.shortName === 'IITB-M');
    if (iitBombay && studentUser) {
      const review2 = await Review.create({
        userId: studentUser._id,
        collegeId: iitBombay._id,
        rating: 5,
        review: 'IIT Bombay is a dream campus. Mood Indigo festival is a life experience, and the academic freedom is unmatched. The lakeside hostel rooms are highly scenic.',
        upvotes: []
      });

      iitBombay.reviews.push(review2._id);
      await iitBombay.save();
    }

    // Synchronize to search and vector indexes
    console.log('Synchronizing indexes...');
    let chromaCount = 0;
    let searchCount = 0;

    // Bulk sync to Algolia Search
    console.log('Syncing all colleges to Algolia search index in bulk...');
    const searchSynced = await syncAllCollegesToSearch(savedColleges);
    if (searchSynced) {
      searchCount = savedColleges.length;
    }

    // Heartbeat check for ChromaDB before syncing to save massive amount of time if offline
    let chromaOnline = false;
    try {
      const host = process.env.CHROMADB_HOST || 'http://localhost:8000';
      const response = await axios.get(`${host}/api/v1/heartbeat`, { timeout: 1000 });
      chromaOnline = response.status === 200;
    } catch (err) {
      chromaOnline = false;
    }

    if (chromaOnline) {
      console.log('ChromaDB is online. Syncing to vector database...');
      for (const college of savedColleges) {
        try {
          const cSynced = await syncCollegeToVectorDb(college);
          if (cSynced) chromaCount++;
        } catch (err) {
          console.error(`Vector DB sync error for ${college.name}:`, err.message);
        }
      }
    } else {
      console.log('ChromaDB is offline. Skipping vector database synchronization.');
    }

    console.log(`\nDatabase seeding completed successfully!`);
    console.log(`- Seeded ${savedColleges.length} colleges.`);
    console.log(`- Synced ${chromaCount}/${savedColleges.length} to ChromaDB vector store.`);
    console.log(`- Synced ${searchCount}/${savedColleges.length} to Algolia search index.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
}

seed();
