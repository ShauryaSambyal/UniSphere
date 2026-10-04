import '../config/env.js';
import { foldName, expandAcronyms, nameSimilarity, cityAgrees, stateAgrees, candidateMatchesCollege } from '../services/nirfService.js';

const pairs = [
  ['T', 'Avinashilingam Institute for Home Science and Higher Education for Women', 'Coimbatore', 'Tamil Nadu', 'Avinashilingam Institute for Home Science & Higher Education for Women', 'Coimbatore', 'Tamil Nadu'],
  ['T', 'Bihar Agricultural University', 'Bhagalpur', 'Bihar', 'Bihar Agriculture University', 'Bhagalpur', 'Bihar'],
  ['T', 'Central Institute of Fisheries Education', 'Mumbai', 'Maharashtra', 'Central Institute of Fisheries Education, Fisheries University', 'Mumbai', 'Maharashtra'],
  ['T', 'Chaudhary Sarwan Kumar Himachal Pradesh Krishi Vishvavidyalaya', 'Kangra', 'Himachal Pradesh', 'Chaudhary Sarwan Kumar Himachal Pardesh Krishi Vishvavidyalaya', 'Kangra', 'Himachal Pradesh'],
  ['T', 'Cochin Unviersity of Science & Technology', 'Cochin', 'Kerala', 'Cochin University of Science and Technology', 'Cochin', 'Kerala'],
  ['T', 'Datta Meghe Institute of Higher Education and Research (Deemed to BE University)', 'Wardha', 'Maharashtra', 'Datta Meghe Institute of Higher Education and Research', 'Wardha', 'Maharashtra'],
  ['T', 'Delhi College of Arts and Commerce', '', 'Delhi', 'Delhi College of Arts & Commerce', 'South West', 'Delhi'],
  ['T', 'Dr. Y.S.Parmar University of Horticulture & Forestry', 'Solan', 'Himachal Pradesh', 'Dr. Y.S. Parmar University of Horticulture and Forestry', 'Solan', 'Himachal Pradesh'],
  ['T', 'Farook College Autonomous Kozhikode', 'Kozhikode', 'Kerala', 'Farook College, Kozhikkode', 'Kozhikode', 'Kerala'],
  ['T', 'Goswami Ganesh Dutta Sanatan Dharma College', 'Chandigarh', 'Chandigarh', 'Goswami Ganesh Dutta S.D. College', 'Chandigarh', 'Chandigarh'],
  ['T', 'JSS Academy of Higher Education & Research', 'Mysore', '', 'JSS Academy of Higher Education and Research', 'Mysuru', 'Karnataka'],
  ['T', 'All India Institute of Medical Sciences, New Delhi', '', 'Delhi', 'All India Institute of Medical Sciences, Delhi', 'New Delhi', 'Delhi'],
  ['T', 'Amar Shaheed Baba Ajit SINGH Jujhar SINGH Memorial College Bela', 'Rupnagar', 'Punjab', 'Amar Shaheed Baba Ajit Singh Jujhar Singh Memorial College of Pharmacy, BELA', 'Bela', 'Punjab'],
  ['T', 'G.B.Pant University of Agriculture & Technology', 'SINGH', 'Uttarakhand', 'G.B. Pant Universtiy of Agriculture and Technology, Pantnagar', 'Pantnagar', 'Uttarakhand'],
  ['T', 'Dr. Rajendra Prasad Central Agriculture University', 'Samastipur', '', 'Dr Rajendra Prasad Central Agricultural University, Samastipur', 'Samastipur', 'Bihar'],
  ['T', 'Dr. Yashwant Singh Parmar University of Horticulture and Forestry', 'Solan', '', 'Dr. Y.S. Parmar University of Horticulture and Forestry', 'Solan', 'Himachal Pradesh'],
  ['T', 'Birla Institute of Technology and Science BITS Pilani', 'Jhunjhunu', 'Rajasthan', 'Birla Institute of Technology & Science -Pilani', 'Pilani', 'Rajasthan'],
  ['T', 'Faculty of Architecture, DR APJ Abdul Kalam Technical University', 'Lucknow', 'Uttar Pradesh', 'Faculty of Architecture and Planning, Dr APJ Abbdul Kalam Technical University, Lucknow', 'Lucknow', 'Uttar Pradesh'],
  ['T', 'Delhi Pharmaceutical Sciences & Research University', 'Vihar', 'Delhi', 'Delhi Pharmaceutical Sciences and Research University', 'Delhi', 'Delhi'],

  ['F', 'College of Engineering Adoor', 'Pathanamthitta', 'Kerala', 'College of Engineering Trivandrum', 'Thiruvananthapuram', 'Kerala'],
  ['F', 'College of Engineering Chengannur', 'Alappuzha', 'Kerala', 'College of Engineering Trivandrum', 'Thiruvananthapuram', 'Kerala'],
  ['F', 'Goa College of ART', 'NORTH Goa', 'Goa', 'Goa College of Pharmacy', 'Panaji', 'Goa'],
  ['F', 'Bharati Vidyapeeths College of Fine ARTS', 'Pune', 'Maharashtra', 'Bharati Vidyapeeth College of Pharmacy', 'Kolhapur', 'Maharashtra'],
  ['F', 'Bharati Vidyapeeths College of Engineering Kolhapur', 'Kolhapur', 'Maharashtra', 'Bharati Vidyapeeth College of Pharmacy', 'Kolhapur', 'Maharashtra'],
  ['F', 'Assam Skill University', 'Darrang', 'Assam', 'Assam University-Silchar', 'Silchar', 'Assam'],
  ['F', 'All India Institute of Ayurveda, Delhi', '', 'Delhi', 'All India Institute of Medical Sciences, Delhi', 'New Delhi', 'Delhi'],
  ['F', 'Birla Institute of Technology, Mesra, Extension Center Noida', 'Gautham Buddha Nagar', 'Uttar Pradesh', 'Birla Institute of Management Technology', 'Greater Noida', 'Uttar Pradesh'],
  ['F', 'Dr. Ram Manohar Lohia Awadh University', '', 'Uttar Pradesh', 'Dr. Ram Manohar Lohiya National Law University, Lucknow', 'Lucknow', 'Uttar Pradesh'],
  ['F', 'Dhanalakshmi Srinivasan College of Engineering', 'Coimbatore', 'Tamil Nadu', 'Dhanalakshmi Srinivasan College of Arts & Science for Women', 'Perambalur', 'Tamil Nadu'],
  ['F', 'Indian Institute of Business Management', 'Patna', 'Bihar', 'Indian Institute of Management Bodh Gaya', 'Gaya', 'Bihar'],
  ['F', 'Dhanalakshmi Srinivasan ARTS and Science CO Education College', 'Kanchipuram', 'Tamil Nadu', 'Dhanalakshmi Srinivasan College of Arts & Science for Women', 'Perambalur', 'Tamil Nadu'],
  ['F', 'Bharati Vidyapeeths College of Engineering Kolhapur', 'Kolhapur', 'Maharashtra', 'Bharati Vidyapeeth College of Engineering, Pune', 'Pune', 'Maharashtra']
];

const results = [];
for (const [label, cName, cCity, cState, rName, rCity, rState] of pairs) {
  const college = { name: cName, location: { city: cCity, state: cState } };
  const record = { name: rName, city: rCity, state: rState };
  const folded = foldName(cName);
  const variants = [...new Set([folded, expandAcronyms(folded)])];
  const recFolded = foldName(rName);
  const city = cityAgrees(cCity, rCity);
  const state = stateAgrees(cState, rState);
  const sim = Math.max(...variants.map((v) => nameSimilarity(v, recFolded)));
  const prefix = variants.some(
    (v) => (v.startsWith(recFolded) || recFolded.startsWith(v)) && Math.abs(v.length - recFolded.length) <= 20
  );
  const score = candidateMatchesCollege(college, record, variants);
  results.push({
    label,
    city,
    state,
    sim: Number(sim.toFixed(3)),
    prefix,
    score,
    predicted: score > 0,
    c: cName.slice(0, 48),
    r: rName.slice(0, 48)
  });
}

results.sort((a, b) => a.sim - b.sim);
console.log('label city  state sim    score prefix college => record');
for (const r of results) {
  console.log(
    `${r.label}    ${r.city ? 'Y' : 'n'}    ${r.state ? 'Y' : 'n'}   ${r.sim.toFixed(3)}  ${r.score}     ${r.prefix ? 'Y' : 'n'}    ${r.c}  =>  ${r.r}`
  );
}

let tp = 0, fn = 0, fp = 0, tn = 0;
for (const r of results) {
  if (r.label === 'T' && r.predicted) tp += 1;
  if (r.label === 'T' && !r.predicted) { fn += 1; console.log('  MISSED TRUE:', r.c, '=>', r.r, 'sim=' + r.sim, 'city=' + r.city, 'state=' + r.state, 'score=' + r.score); }
  if (r.label === 'F' && r.predicted) { fp += 1; console.log('  FALSE POSITIVE:', r.c, '=>', r.r, 'sim=' + r.sim, 'city=' + r.city, 'state=' + r.state, 'score=' + r.score); }
  if (r.label === 'F' && !r.predicted) tn += 1;
}
console.log({ tp, fn, fp, tn });
