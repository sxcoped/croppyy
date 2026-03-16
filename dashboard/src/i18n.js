import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "language": "Language",
      "english": "English",
      "hindi": "Hindi",
      "telugu": "Telugu",
      "kannada": "Kannada",
      "dashboard": "Dashboard",
      "settings": "Settings",
      "logout": "Logout"
    }
  },
  hi: {
    translation: {
      "language": "भाषा",
      "english": "अंग्रेज़ी",
      "hindi": "हिंदी",
      "telugu": "तेलुगु",
      "kannada": "कन्नड़",
      "dashboard": "डैशबोर्ड",
      "settings": "सेटिंग्स",
      "logout": "लॉग आउट"
    }
  },
  te: {
    translation: {
      "language": "భాష",
      "english": "ఇంగ్లీష్",
      "hindi": "హిందీ",
      "telugu": "తెలుగు",
      "kannada": "కన్నడ",
      "dashboard": "డాష్‌బోర్డ్",
      "settings": "సెట్టింగులు",
      "logout": "లాగ్ అవుట్"
    }
  },
  kn: {
    translation: {
      "language": "ಭಾಷೆ",
      "english": "ಇಂಗ್ಲಿಷ್",
      "hindi": "ಹಿಂದಿ",
      "telugu": "ತೆಲುಗು",
      "kannada": "ಕನ್ನಡ",
      "dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
      "settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
      "logout": "ಲಾಗ್ ಔಟ್"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
