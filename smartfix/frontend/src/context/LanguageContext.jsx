import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const tradeTranslations = {
  en: {
    'Plumbing': 'Plumbing',
    'Electrical Repairs': 'Electrical Repairs',
    'AC Service and Repair': 'AC Service & Repair',
    'AC Service & Repair': 'AC Service & Repair',
    'Refrigerator Repair': 'Refrigerator Repair',
    'Washing Machine Repair': 'Washing Machine Repair',
    'Water Purifier Service': 'Water Purifier Service',
  },
  ta: {
    'Plumbing': 'பிளம்பிங் (குழாய் பழுது)',
    'Electrical Repairs': 'மின்சார பழுதுநீக்கம் (எலக்ட்ரிக்கல்)',
    'AC Service and Repair': 'ஏசி சர்வீஸ் & பழுதுநீக்கம்',
    'AC Service & Repair': 'ஏசி சர்வீஸ் & பழுதுநீக்கம்',
    'Refrigerator Repair': 'ஃப்ரிட்ஜ் பழுதுநீக்கம்',
    'Washing Machine Repair': 'வாஷிங் மெஷின் பழுதுநீக்கம்',
    'Water Purifier Service': 'வாட்டர் பியூரிஃபையர் சர்வீஸ்',
  },
};

export const translations = {
  en: {
    // Navbar & Header
    brand: 'SmartFix',
    browse_experts: 'Browse Experts',
    my_dashboard: 'My Dashboard',
    profile_settings: 'Profile & Settings',
    admin_console: 'Admin Console',
    logout: 'Logout',
    login_register: 'Login / Register',
    search_placeholder: 'Search plumbers, electricians, AC repair...',
    search_btn: 'Search',
    
    // Theme & Language
    light_mode: 'Light Mode',
    dark_mode: 'Dark Mode',
    select_language: 'Preferred Language',
    language_en: 'English',
    language_ta: 'தமிழ் (Tamil)',

    // Home & Browse Pages
    welcome_label: 'Welcome / வணக்கமுடன்',
    hero_badge: '⚡ Instant 15-Min On-Demand Dispatch',
    hero_title: 'Trusted Home Experts & Handymen Near You',
    hero_subtitle: 'Book certified plumbers, electricians, AC technicians & home repair specialists instantly in Tamil Nadu & nearby areas.',
    book_now: 'Book Handyman Now',
    explore_services: 'Explore All Services',
    verified_pros: '100% Background Checked Experts',
    feat_ver_techs: 'Verified Technicians',
    feat_upfront_pricing: 'Upfront Pricing',
    feat_same_day: 'Same-Day Service',
    feat_ver_desc: 'All technicians undergo thorough background check & skill test.',
    feat_upfront_desc: 'Clear upfront pricing before work begins. No hidden charges.',
    feat_same_day_desc: 'Get fast local dispatch and repair service on the same day.',
    why_choose_title: 'Why Choose SmartFix',
    why_choose_subtitle: 'Reliable, fast, and transparent home services in your area.',
    radial_dispatch_badge: '📍 5 km Radial GPS Dispatch',
    worker_join_badge: '🛠️ Worker Partner Join',
    hero_search_placeholder: 'What service do you need today? (e.g. AC Gas Refill, Pipe Leak, Wiring)',
    repairs_solved: '15,000+ Repairs Solved',
    user_rating: '4.9 ★ User Rating',
    arrival_guarantee: '1 Hour Arrival Guarantee',
    active_online_workers: 'Active Online Handymen Near You',
    traditional_craftsmanship: 'TRADITIONAL CRAFTSMANSHIP & MODERN CONVENIENCE',
    core_categories_badge: 'EXPLORE 6 PRIMARY SERVICES',
    core_categories_title: 'Our Core Repair Categories',
    core_categories_subtitle: 'Click any trade to view specialized sub-services and book nearby verified experts instantly.',
    popular_subservices: 'Popular Sub-services:',
    for_homeowners_title: 'For Homeowners & Families',
    for_homeowners_desc: 'Get transparent upfront pricing, verified Tamil Nadu experts, and live GPS worker tracking at your doorstep.',
    for_workers_title: 'For Skilled Technicians & Handymen',
    for_workers_desc: 'Join as a verified partner in Tamil Nadu. Get daily local repair jobs, instant UPI payouts, and flexible work hours.',
    join_partner_btn: 'Register as Worker Partner 🛠️',
    testimonials_title: 'What People in Tamil Nadu Say',

    // Services & Categories
    services_title: 'Our Professional Home Services',
    services_subtitle: 'Click any category to view specialized sub-services and book verified local handymen.',
    starts_at: 'Starts at',
    plumbing: 'Plumbing',
    electrical: 'Electrical Repairs',
    ac_service: 'AC Service & Repair',
    washing_machine: 'Washing Machine Repair',
    water_purifier: 'Water Purifier Service',
    refrigerator: 'Refrigerator Repair',
    
    // Browse & Worker Cards
    all_experts: 'All Expert Handymen',
    filter_by_trade: 'Filter by Trade Category',
    all_trades: 'All Trades',
    per_hour: 'per hour',
    online_now: 'Online Now',
    offline: 'Offline',
    verified_badge: 'Verified Expert',
    view_details: 'View Profile',
    instant_book: 'Instant Book 🚀',
    no_workers_found: 'No handymen found matching your search.',
    rating_label: 'Rating',
    distance_label: 'Distance',
    rating_revealed_on_booking: 'Rating revealed upon booking',
    no_reviews_yet: 'No reviews yet',
    secured_number: 'Secured Number (In-App Call)',
    call_now: 'Call Handyman',
    whatsapp: 'WhatsApp Chat',

    // Booking Page & Dispatch Engine
    booking_title: 'Book Professional Service',
    step1_select_service: '1. Select Sub-Services & Category',
    step2_location_datetime: '2. Pickup Location & Date/Time',
    step3_service_tier: '3. Choose Service Tier',
    bike_express: 'BikePro Express ⚡ (15-20 Mins)',
    auto_standard: 'AutoHandyman Standard 🚗 (25 Mins)',
    master_tech: 'MasterTech Specialist 🚚 (Tools Included)',
    est_fare: 'Estimated Fare',
    address_label: 'Your Complete Street Address',
    address_placeholder: 'Enter door no, street name, landmark...',
    notes_label: 'Special Notes / Instructions for Handyman',
    notes_placeholder: 'e.g. Bring extra 1-inch CPVC pipe joint...',
    confirm_booking_btn: 'Confirm & Dispatch Nearest Captain 🚀',

    // Login & Signup Form
    welcome_back: 'Welcome Back to SmartFix',
    create_account: 'Create Your Account',
    customer: 'Customer',
    handyman: 'Handyman / Worker',
    full_name: 'Full Name',
    phone_number: 'Phone Number',
    password: 'Password',
    confirm_password: 'Confirm Password',
    select_trade: 'Select Your Trade / Specialization',
    aadhaar_number: 'Verified Mobile Number',
    signup_btn: 'Complete Registration',
    login_btn: 'Sign In',

    // Dashboards & Admin
    admin_title: 'Admin Verification & Operations Console',
    dashboard_title: 'Dashboard Overview',
    active_bookings: 'Active Bookings',
    booking_history: 'Booking History',
    total_earnings: 'Total Earnings',
    wallet_balance: 'Wallet Balance',
    status: 'Status',
    actions: 'Actions',
    cancel_booking: 'Cancel Booking',
    track_live: 'Live Map Tracker 🗺️',
    call_worker: 'Call Worker 📞',
    pay_online: 'Pay Online 💳',
    rate_worker: 'Rate Service ⭐',
    withdraw_btn: 'Withdraw Earnings 🏦',
    online_toggle_on: 'You are ONLINE & Available for Jobs 🟢',
    online_toggle_off: 'You are OFFLINE 🔴',

    pending_verification_queue: 'Pending KYC Worker Verification Queue',
    customer_management: 'Registered Customer Accounts',
    approve_btn: 'Approve Worker ✅',
    reject_btn: 'Reject Document ❌',
    block_btn: 'Block Account 🚫',
    unblock_btn: 'Unblock Account 🟢',

    // AI Assistant & Footer
    home: 'Home',
    about: 'About',
    careers: 'Careers',
    ai_widget_title: 'SmartFix Bot 🤖',
    ai_widget_subtitle: 'Trained on 10,000+ repair & pricing scenarios',
    ai_placeholder: 'Ask about repair costs, plumbing tips, AC gas...',
    ai_send_btn: 'Ask AI',
    footer_tagline: "Tamil Nadu's #1 Trusted On-Demand Home Service Network.",
    quick_links: 'Quick Links',
    contact_us: 'Contact Us',
    all_rights_reserved: 'All rights reserved.',
  },
  ta: {
    // Navbar & Header
    brand: 'ஸ்மார்ட்ஃபிக்ஸ்',
    browse_experts: 'நிபுணர்களை பார்க்க',
    my_dashboard: 'என் டாஷ்போர்டு',
    profile_settings: 'சுயவிவரம் & அமைப்புகள்',
    admin_console: 'நிர்வாக கன்சோல்',
    logout: 'வெளியேறு',
    login_register: 'உள்நுழைவு / பதிவு',
    search_placeholder: 'பிளம்பர், எலக்ட்ரீஷியன், ஏசி பழுது பார்க்க தேடவும்...',
    search_btn: 'தேடு',
    
    // Theme & Language
    light_mode: 'லைட் மோட்',
    dark_mode: 'டார்க் மோட்',
    select_language: 'விருப்ப மொழி',
    language_en: 'English',
    language_ta: 'தமிழ் (Tamil)',

    // Home & Browse Pages
    welcome_label: 'வணக்கமுடன்',
    hero_badge: '⚡ 15 நிமிடத்தில் வீட்டு வாசலில் சேவைகள்',
    hero_title: 'உங்களுக்கு அருகிலுள்ள நம்பிக்கையான வீட்டு பழுதுநீக்கும் நிபுணர்கள்',
    hero_subtitle: 'சிவகங்கை மற்றும் அதைச் சுற்றியுள்ள பகுதிகளில் சரிபார்க்கப்பட்ட பிளம்பர், எலக்ட்ரீஷியன், ஏசி நுட்பனர்கள் & வீட்டு பழுதுபார்ப்பு நிபுணர்களை உடனடியாக முன்பதிவு செய்யுங்கள்.',
    book_now: 'தொழிலாளியை முன்பதிவு செய்ய',
    explore_services: 'அனைத்து சேவைகளையும் பார்க்க',
    verified_pros: '100% சரிபார்க்கப்பட்ட நிபுணர்கள்',
    feat_ver_techs: 'சரிபார்க்கப்பட்ட வல்லுநர்கள்',
    feat_upfront_pricing: 'வெளிப்படையான கட்டணம்',
    feat_same_day: 'அன்றைய தின சேவை',
    feat_ver_desc: 'அனைத்து பணியாட்களும் பின்னணி சரிபார்ப்பு மற்றும் திறன் சோதனைக்கு உட்பட்டவர்கள்.',
    feat_upfront_desc: 'வேலை தொடங்கும் முன் தெளிவான முன் கட்டணம். மறைமுக கட்டணங்கள் இல்லை.',
    feat_same_day_desc: 'ஒரே நாளில் விரைவான உள்ளூர் சேவை மற்றும் பழுதுநீக்கம் பெறுங்கள்.',
    why_choose_title: 'ஏன் ஸ்மார்ட்ஃபிக்ஸ்',
    why_choose_subtitle: 'உங்கள் பகுதியில் நம்பகமான, விரைவான மற்றும் வெளிப்படையான சேவைகள்.',
    radial_dispatch_badge: '📍 5 கி.மீ எல்லைக்குள் உடனடி வருகை',
    worker_join_badge: '🛠️ தொழிலாளியாக இணையுங்கள்',
    hero_search_placeholder: 'இன்று உங்களுக்கு என்ன சேவை தேவை? (எ.கா: ஏசி கேஸ் ரீஃபில், குழாய் கசிவு, எலக்ட்ரிக்கல்)',
    repairs_solved: '15,000+ பழுதுநீக்கங்கள் முடிந்தது',
    user_rating: '4.9 ★ வாடிக்கையாளர் மதிப்பீடு',
    arrival_guarantee: '1 மணி நேர வருகை உத்தரவாதம்',
    active_online_workers: 'உங்களுக்கு அருகில் ஆன்லைனில் உள்ள பணியாட்கள்',
    traditional_craftsmanship: 'பாரம்பரிய வேலைத்திறன் & நவீன வசதி',
    core_categories_badge: '6 முக்கிய சேவைகள்',
    core_categories_title: 'எங்களின் முக்கிய பழுதுநீக்கும் சேவைகள்',
    core_categories_subtitle: 'சிறப்பு சேவைகளைப் பார்க்கவும், அருகிலுள்ள சரிபார்க்கப்பட்ட நிபுணர்களை முன்பதிவு செய்யவும் ஏதேனும் தொழிலைக் கிளிக் செய்யவும்.',
    popular_subservices: 'பிரபலமான சேவைகள்:',
    for_homeowners_title: 'வீட்டு உரிமையாளர்களுக்கு',
    for_homeowners_desc: 'தெளிவான முன்னறிவிப்பு கட்டணம், சரிபார்க்கப்பட்ட சிவகங்கை நிபுணர்கள் மற்றும் நேரலை வரைபட வழிகாட்டுதல்.',
    for_workers_title: 'கைவினைஞர்கள் & தொழிலாளர்களுக்கு',
    for_workers_desc: 'சிவகங்கை மாவட்டத்தில் சரிபார்க்கப்பட்ட கூட்டாளியாக இணையுங்கள். தினமும் வேலைகள் மற்றும் உடனடி கட்டணங்கள் பெறுங்கள்.',
    join_partner_btn: 'தொழிலாளியாக பதிவு செய்ய 🛠️',
    testimonials_title: 'சிவகங்கை மக்களின் கருத்துக்கள்',

    // Services & Categories
    services_title: 'எங்களின் முக்கிய பழுதுநீக்கும் சேவைகள்',
    services_subtitle: 'சிறப்பு சேவைகளைப் பார்க்கவும், சரிபார்க்கப்பட்ட நிபுணர்களை முன்பதிவு செய்யவும் ஏதேனும் பிரிவைக் கிளிக் செய்யவும்.',
    starts_at: 'தொடக்க விலை',
    plumbing: 'பிளம்பிங் (குழாய் பழுது)',
    electrical: 'மின்சார பழுதுநீக்கம் (எலக்ட்ரிக்கல்)',
    ac_service: 'ஏசி சர்வீஸ் & பழுதுநீக்கம்',
    washing_machine: 'வாஷிங் மெஷின் பழுதுநீக்கம்',
    water_purifier: 'வாட்டர் பியூரிஃபையர் சர்வீஸ்',
    refrigerator: 'ஃபிரிட்ஜ் பழுதுநீக்கம்',
    
    // Browse & Worker Cards
    all_experts: 'அனைத்து பழுதுநீக்கும் தொழிலாளர்கள்',
    filter_by_trade: 'தொழில் அடிப்படையில் பிரிக்க',
    all_trades: 'அனைத்து தொழில்கள்',
    per_hour: 'மணிக்கு',
    online_now: 'ஆன்லைனில் உள்ளார்',
    offline: 'ஆஃப்லைன்',
    verified_badge: 'சரிபார்க்கப்பட்ட நிபுணர்',
    view_details: 'விவரங்களை பார்க்க',
    instant_book: 'உடனடி முன்பதிவு 🚀',
    no_workers_found: 'தேடலுக்கு பொருத்தமான பணியாட்கள் கிடைக்கவில்லை.',
    rating_label: 'மதிப்பீடு',
    distance_label: 'தூரம்',
    rating_revealed_on_booking: 'முன்பதிவுக்குப் பின் ரேட்டிங் தெரியவரும்',
    no_reviews_yet: 'இன்னும் மதிப்புரைகள் இல்லை',
    secured_number: 'பாதுகாக்கப்பட்ட எண் (செயலி மூலம் அழைக்கவும்)',
    call_now: 'தொழிலாளியை அழைக்க',
    whatsapp: 'வாட்ஸ்அப் அரட்டை',

    // Booking Page & Dispatch Engine
    booking_title: 'சேவையை முன்பதிவு செய்யுங்கள்',
    step1_select_service: '1. சேவையின் வகையை தேர்ந்தெடுக்கவும்',
    step2_location_datetime: '2. முகவரி மற்றும் தேதி/நேரம்',
    step3_service_tier: '3. சேவை முறையை தேர்வு செய்க',
    bike_express: 'பைக் எக்ஸ்பிரஸ் ⚡ (15-20 நிமிடங்கள்)',
    auto_standard: 'ஸ்டாண்டர்ட் ஆட்டோ கைவினைஞர் 🚗 (25 நிமிடங்கள்)',
    master_tech: 'மாஸ்டர் டெக் நிபுணர் 🚚 (கருவிகளுடன்)',
    est_fare: 'மதிப்பிடப்பட்ட கட்டணம்',
    address_label: 'உங்கள் முழுமையான கதவு எண் மற்றும் தெரு முகவரி',
    address_placeholder: 'கதவு எண், தெரு பெயர், அடையாளம் உள்ளிடவும்...',
    notes_label: 'தொழிலாளிக்கு ஏதேனும் சிறப்பு குறிப்புகள்',
    notes_placeholder: 'எ.கா: 1 அங்குல குழாய் இணைப்பு எடுத்து வரவும்...',
    confirm_booking_btn: 'உறுதி செய்து தொழிலாளியை அழைக்கவும் 🚀',

    // Login & Signup Form
    welcome_back: 'ஸ்மார்ட்ஃபிக்ஸ்-க்கு நல்வரவு',
    create_account: 'புதிய கணக்கை உருவாக்குங்கள்',
    customer: 'வாடிக்கையாளர்',
    handyman: 'தொழிலாளி / வேலையாள்',
    full_name: 'முழு பெயர்',
    phone_number: 'கைபேசி எண்',
    password: 'கடவுச்சொல்',
    confirm_password: 'கடவுச்சொல்லை உறுதிப்படுத்துக',
    select_trade: 'உங்கள் தொழிலை தேர்வு செய்க',
    aadhaar_number: '12-இலக்க ஆதார் கார்டு எண்',
    signup_btn: 'பதிவை நிறைவு செய்க',
    login_btn: 'உள்நுழைக',

    // Dashboards & Admin
    admin_title: 'நிர்வாக சரிபார்ப்பு கன்சோல்',
    dashboard_title: 'டாஷ்போர்டு பார்வை',
    active_bookings: 'தற்போதைய முன்பதிவுகள்',
    booking_history: 'முந்தைய முன்பதிவு வரலாறு',
    total_earnings: 'மொத்த வருமானம்',
    wallet_balance: 'வாலட் இருப்பு',
    status: 'நிலை',
    actions: 'செயல்கள்',
    cancel_booking: 'முன்பதிவை ரத்து செய்க',
    track_live: 'நேரலை வரைபடம் 🗺️',
    call_worker: 'தொழிலாளியை அழைக்க 📞',
    pay_online: 'கட்டணம் செலுத்த 💳',
    rate_worker: 'மதிப்பீடு வழங்க ⭐',
    withdraw_btn: 'வருமானத்தை பெற 🏦',
    online_toggle_on: 'நீங்கள் ஆன்லைனில் உள்ளீர்கள் 🟢',
    online_toggle_off: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் 🔴',

    pending_verification_queue: 'சரிபார்ப்பிற்காக காத்திருக்கும் தொழிலாளர்கள்',
    customer_management: 'பதிவுசெய்த வாடிக்கையாளர்கள்',
    approve_btn: 'அங்கீகரிக்கவும் ✅',
    reject_btn: 'நிராகரிக்கவும் ❌',
    block_btn: 'கணக்கை முடக்க 🚫',
    unblock_btn: 'முடக்கத்தை நீக்க 🟢',

    // AI Assistant & Footer
    home: 'முகப்பு',
    about: 'எங்களைப் பற்றி',
    careers: 'வேலைவாய்ப்புகள்',
    ai_widget_title: 'ஸ்மார்ட்ஃபிக்ஸ் பாட் (SmartFix Bot) 🤖',
    ai_widget_subtitle: '10,000+ பழுதுநீக்கும் விவரங்கள் அறிந்த AI',
    ai_placeholder: 'பழுதுநீக்கும் செலவு, பிளம்பிங் குறிப்புகள் பற்றி கேளுங்கள்...',
    ai_send_btn: 'AI இடம் கேள்',
    footer_tagline: 'சிவகங்கை மாவட்டத்தின் முதன்மை நம்பிக்கையான வீட்டு சேவை நெட்வொர்க்.',
    quick_links: 'விரைவு இணைப்புகள்',
    contact_us: 'தொடர்பு கொள்ள',
    all_rights_reserved: 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
  },
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const savedLang = localStorage.getItem('smartfix_lang');
    if (savedLang === 'ta' || savedLang === 'ta_en') return 'ta';
    if (savedLang && translations[savedLang]) return savedLang;
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('smartfix_lang', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const tTrade = (tradeName) => {
    if (!tradeName) return tradeName;
    return tradeTranslations[language]?.[tradeName] || tradeName;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tTrade }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
