// Indian States, UTs and major cities.
// Extend the city arrays over time — the Bill / Supplier forms allow
// "+ Add custom city" so unlisted cities can still be captured.

export const INDIAN_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Kadapa",
    "Tirupati", "Rajahmundry", "Kakinada", "Anantapur", "Ongole", "Kandukur",
    "Chittoor", "Eluru", "Machilipatnam", "Srikakulam", "Vizianagaram",
    "Proddatur", "Hindupur", "Bhimavaram", "Tenali", "Chirala", "Narasaraopet",
    "Tadepalligudem", "Adoni", "Madanapalle", "Dharmavaram", "Gudivada",
  ],
  "Telangana": [
    "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam",
    "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet", "Miryalaguda", "Siddipet",
    "Jagtial", "Mancherial", "Nirmal", "Kothagudem", "Bodhan",
  ],
  "Tamil Nadu": [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
    "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Dindigul", "Thanjavur",
    "Ranipet", "Sivakasi", "Karur", "Udumalaipettai", "Hosur", "Nagercoil",
    "Kanchipuram", "Kumbakonam", "Cuddalore", "Tiruvannamalai",
  ],
  "Karnataka": [
    "Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Kalaburagi",
    "Davanagere", "Ballari", "Vijayapura", "Shivamogga", "Tumakuru", "Raichur",
    "Bidar", "Hospet", "Hassan", "Gadag", "Udupi", "Chikkamagaluru",
  ],
  "Maharashtra": [
    "Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur",
    "Amravati", "Kolhapur", "Sangli", "Jalgaon", "Akola", "Latur", "Ahmednagar",
    "Chandrapur", "Parbhani", "Nanded", "Dhule", "Ichalkaranji",
  ],
  "Gujarat": [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
    "Junagadh", "Gandhinagar", "Anand", "Nadiad", "Bharuch", "Mehsana",
    "Morbi", "Surendranagar", "Navsari", "Vapi", "Gandhidham",
  ],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", "Central Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh"],
  "Kerala": [
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
    "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram", "Idukki",
    "Ernakulam", "Pathanamthitta", "Kasaragod",
  ],
  "West Bengal": [
    "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman",
    "Malda", "Kharagpur", "Haldia", "Berhampore", "Krishnanagar", "Barasat",
  ],
  "Uttar Pradesh": [
    "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj",
    "Noida", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur",
    "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura", "Ayodhya",
  ],
  "Rajasthan": [
    "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Bhilwara",
    "Alwar", "Sikar", "Pali", "Sri Ganganagar", "Bharatpur", "Tonk",
  ],
  "Madhya Pradesh": [
    "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas",
    "Satna", "Ratlam", "Rewa", "Katni", "Singrauli", "Burhanpur",
  ],
  "Punjab": [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali",
    "Hoshiarpur", "Pathankot", "Moga", "Batala", "Firozpur",
  ],
  "Haryana": [
    "Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak",
    "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa",
  ],
  "Bihar": [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia",
    "Arrah", "Begusarai", "Chhapra", "Katihar", "Munger",
  ],
  "Odisha": [
    "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri",
    "Balasore", "Baripada", "Bhadrak", "Jharsuguda",
  ],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh", "Giridih"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon", "Jagdalpur"],
  "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur", "Rishikesh"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Mandi", "Solan", "Kullu", "Manali", "Hamirpur"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua"],
  "Ladakh": ["Leh", "Kargil"],
  "Chandigarh": ["Chandigarh"],
  "Puducherry": ["Puducherry", "Karaikal", "Yanam", "Mahe"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  "Lakshadweep": ["Kavaratti"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat"],
  "Manipur": ["Imphal", "Thoubal", "Bishnupur"],
  "Meghalaya": ["Shillong", "Tura", "Jowai"],
  "Mizoram": ["Aizawl", "Lunglei", "Champhai"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung"],
  "Sikkim": ["Gangtok", "Namchi", "Gyalshing"],
  "Tripura": ["Agartala", "Udaipur", "Dharmanagar"],
};

export function citiesForState(state: string): string[] {
  return CITIES_BY_STATE[state] ?? [];
}
