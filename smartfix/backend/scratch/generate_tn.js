const fs = require('fs');
const path = require('path');

const districts = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivagangai", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Trichy", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar"
];

const tnData = {
  "Madurai": {
    "Madurai North": ["Anna Nagar", "K.K. Nagar", "Tallakulam", "Sellur", "Othakadai"],
    "Madurai South": ["Villapuram", "South Gate", "Simmakkal", "Jaihindpuram"],
    "Melur": ["Melur Town", "Kottampatti", "Vellalur"],
    "Thirumangalam": ["Thirumangalam Town", "Kalligudi", "T.Kallupatti"],
    "Usilampatti": ["Usilampatti Town", "Chellampatti", "Sedapatti"]
  },
  "Sivagangai": {
    "Sivagangai": ["Sivagangai Town", "Kalayarkoil", "Ilayangudi", "Okkur", "Paiyur"],
    "Karaikudi": ["Karaikudi Town", "Kottaiyur", "Kandanur", "Pallathur"],
    "Devakottai": ["Devakottai Town", "Kannangudi"],
    "Manamadurai": ["Manamadurai Town", "Muthanendal", "Thirupuvanam"],
    "Thirupuvanam": ["Thirupuvanam Town", "Palayanoor"]
  },
  "Chennai": {
    "Chennai": ["Adyar", "Anna Nagar", "T. Nagar", "Velachery", "Mylapore", "Guindy", "Thiruvanmiyur"]
  },
  "Coimbatore": {
    "Coimbatore North": ["Thudiyalur", "Saravanampatti", "Gandhipuram", "RS Puram"],
    "Coimbatore South": ["Kuniyamuthur", "Ramanathapuram", "Singanallur"],
    "Pollachi": ["Pollachi Town", "Kottur", "Anaimalai"],
    "Mettupalayam": ["Mettupalayam Town", "Karamadai", "Sirumugai"]
  },
  "Trichy": {
    "Trichy West": ["Thillai Nagar", "Woraiyur", "Tennur"],
    "Trichy East": ["Srirangam", "Thiruvanaikaval", "Cantonment"],
    "Lalgudi": ["Lalgudi Town", "Poovalur"],
    "Manapparai": ["Manapparai Town", "Vaiyampatti"]
  },
  "Salem": {
    "Salem": ["Ammapet", "Hasthampatti", "Kondalampatti", "Suramangalam"],
    "Attur": ["Attur Town", "Narasingapuram"],
    "Mettur": ["Mettur Town", "Mecheri"]
  },
  "Tirunelveli": {
    "Tirunelveli": ["Tirunelveli Town", "Palayamkottai", "Melapalayam", "Thatchanallur"],
    "Ambasamudram": ["Ambasamudram Town", "Kallidaikurichi"],
    "Tenkasi": ["Tenkasi Town", "Courtallam"]
  },
  "Kanyakumari": {
    "Nagercoil": ["Nagercoil Town", "Vadasery", "Kottar"],
    "Kanyakumari": ["Kanyakumari Town", "Agasteeswaram"],
    "Marthandam": ["Marthandam Town", "Kuzhithurai"]
  },
  "Erode": {
    "Erode": ["Erode Town", "Surampatti", "Periyasemur", "Veerappanchatram"],
    "Bhavani": ["Bhavani Town", "Appakudal"],
    "Gobichettipalayam": ["Gobichettipalayam Town", "Kugalur"]
  },
  "Vellore": {
    "Vellore": ["Vellore Town", "Katpadi", "Sathuvachari"],
    "Gudiyatham": ["Gudiyatham Town", "Pernambut"],
    "Arakkonam": ["Arakkonam Town", "Nemili"]
  }
};

districts.forEach(d => {
  if (!tnData[d]) {
    tnData[d] = {
      [`${d} Taluk`]: [`${d} Town`, `${d} North`, `${d} South`]
    };
  }
});

const outputPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'tamilnadu-locations.json');
fs.writeFileSync(outputPath, JSON.stringify(tnData, null, 2), 'utf-8');
console.log('Successfully generated', outputPath);
