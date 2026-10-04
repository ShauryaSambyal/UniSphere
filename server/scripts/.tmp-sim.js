import { nameSimilarity, foldName, expandAcronyms } from '../services/nirfService.js';

const pairs = [
  ['All India Institute of Ayurveda, Delhi', 'All India Institute of Medical Sciences, Delhi'],
  ['Assam Skill University', 'Assam University-Silchar'],
  ['Bharati Vidyapeeths College of Fine ARTS', 'Bharati Vidyapeeth College of Pharmacy'],
  ['Birla Institute of Technology, Mesra, Extension Center Noida', 'Birla Institute of Management Technology'],
  ['College of Engineering Adoor', 'College of Engineering Trivandrum'],
  ['Dhanalakshmi Srinivasan College of Engineering', 'Dhanalakshmi Srinivasan College of Arts & Science for Women'],
  ['Dr. Ram Manohar Lohia Awadh University', 'Dr. Ram Manohar Lohiya National Law University, Lucknow'],
  ['Goa College of ART', 'Goa College of Pharmacy'],
  ['Indian Institute of Business Management', 'Indian Institute of Management Visakhapatnam'],
  ['Avinashilingam Institute for Home Science and Higher Education for Women', 'Avinashilingam Institute for Home Science & Higher Education for Women'],
  ['Bihar Agricultural University', 'Bihar Agriculture University'],
  ['Birla Institute of Technology and Science BITS Pilani', 'Birla Institute of Technology & Science -Pilani'],
  ['Cochin Unviersity of Science & Technology', 'Cochin University of Science and Technology'],
  ['Chaudhary Sarwan Kumar Himachal Pradesh Krishi Vishvavidyalaya', 'Chaudhary Sarwan Kumar Himachal Pardesh Krishi Vishvavidyalaya'],
  ['Faculty of Architecture, DR APJ Abdul Kalam Technical University', 'Faculty of Architecture and Planning, Dr APJ Abbdul Kalam Technical University, Lucknow'],
  ['G.B.Pant University of Agriculture & Technology', 'G.B. Pant Universtiy of Agriculture and Technology, Pantnagar'],
  ['Bharati Vidyapeeths College of Engineering Kolhapur', 'Bharati Vidyapeeth College of Pharmacy'],
  ['Delhi College of Arts and Commerce', 'Delhi College of Arts & Commerce'],
  ['Datta Meghe Institute of Higher Education and Research (Deemed to BE University)', 'Datta Meghe Institute of Higher Education and Research'],
  ['Dr. Y.S.R. Horticultural Univerity', 'Dr Y S R Horticulture University'],
  ['Farook College Autonomous Kozhikode', 'Farook College, Kozhikkode'],
  ['Goswami Ganesh Dutta Sanatan Dharma College', 'Goswami Ganesh Dutta S.D. College']
];

for (const [left, right] of pairs) {
  const a = expandAcronyms(foldName(left));
  const b = expandAcronyms(foldName(right));
  console.log(nameSimilarity(a, b).toFixed(3), '|', left, '=>', right);
}
