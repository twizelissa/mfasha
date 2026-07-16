import { FormQuestion } from "./formParser";

const TRANSIT_STARTS = [
  "The city administration should ",
  "I recommend ",
  "We need to ",
  "It is crucial to ",
  "I suggest ",
  "A major improvement would be to ",
  "To improve mobility, we must ",
  "There is a strong need to ",
  "The best strategy is to ",
  "A key recommendation is to "
];

const TRANSIT_VERBS = [
  "introduce dedicated lanes for",
  "increase the fleet size of",
  "optimize the scheduling of",
  "improve the infrastructure of",
  "subsidize the cost of",
  "digitize the ticketing systems for",
  "upgrade the safety standards of",
  "expand the coverage of",
  "develop more pedestrian walkways and"
];

const TRANSIT_NOUNS = [
  "public buses, especially during rush hours,",
  "smart traffic control signals at busy intersections",
  "motorcycle taxi services",
  "sidewalks and non-motorized transport options",
  "bus terminals like Nyabugogo and Remera",
  "commuter bus routes linking residential areas",
  "bicycle lanes along main corridors",
  "alternative transport modes like light rail"
];

const TRANSIT_REASONS = [
  "to significantly reduce congestion.",
  "which will shorten waiting times for passengers.",
  "to make commuting safer and more reliable.",
  "so that people are encouraged to walk or cycle.",
  "to streamline passenger flow and ticketing.",
  "to lower overall travel times in Kigali.",
  "which will make public transit more accessible for everyone.",
  "to minimize gridlock during peak morning and evening hours."
];

// General feedback templates
const GENERAL_STARTS = [
  "I believe the program should focus on ",
  "An improvement could be made by ",
  "It would be beneficial to ",
  "The main priority should be ",
  "I suggest the coordinators ",
  "We should pay more attention to ",
  "A positive change would be to ",
  "To enhance the overall experience, they should "
];

const GENERAL_VERBS = [
  "improving communication regarding ",
  "providing better documentation for ",
  "extending the duration and availability of ",
  "streamlining the onboarding and setup of ",
  "creating more interactive sessions for ",
  "updating the tools and technology used in ",
  "increasing the feedback frequency of ",
  "allocating more resources toward "
];

const GENERAL_NOUNS = [
  "the core learning modules and study guides",
  "project coordination and group activities",
  "weekly assignments and practical exercises",
  "the online portal and reference materials",
  "support channels and query response times",
  "peer-to-peer collaboration sessions",
  "industry-relevant case studies"
];

const GENERAL_REASONS = [
  "to ensure everyone is on the same page.",
  "which will help participants perform better.",
  "so that learners can apply their knowledge directly.",
  "to minimize confusion during the initial stages.",
  "which makes the program more engaging.",
  "to keep up with modern standards and practices.",
  "leading to a more successful learning outcome."
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRecommendationText(formTitle: string): string {
  const lowercaseTitle = formTitle.toLowerCase();
  const isTransit = 
    lowercaseTitle.includes("transport") || 
    lowercaseTitle.includes("mobility") || 
    lowercaseTitle.includes("traffic") || 
    lowercaseTitle.includes("road") || 
    lowercaseTitle.includes("bus") || 
    lowercaseTitle.includes("kigali");

  if (isTransit) {
    return `${pickRandom(TRANSIT_STARTS)}${pickRandom(TRANSIT_VERBS)} ${pickRandom(TRANSIT_NOUNS)} ${pickRandom(TRANSIT_REASONS)}`;
  }

  return `${pickRandom(GENERAL_STARTS)}${pickRandom(GENERAL_VERBS)}${pickRandom(GENERAL_NOUNS)} ${pickRandom(GENERAL_REASONS)}`;
}

export function generateQuestionResponse(
  question: FormQuestion,
  formTitle: string
): string | string[] {
  const { type, choices } = question;

  switch (type) {
    case "radio":
    case "dropdown":
      if (choices.length === 0) return "";
      // Handle the "Yes/No" participate agreement questions
      if (question.title.toLowerCase().includes("agree") || question.title.toLowerCase().includes("participate")) {
        const yesOption = choices.find(c => c.toLowerCase() === "yes");
        if (yesOption) return yesOption;
      }
      return pickRandom(choices);

    case "scale":
      if (choices.length === 0) return "3";
      // Weight towards higher scores (3, 4, 5) for realistic satisfaction metrics
      const roll = Math.random();
      if (choices.length >= 5) {
        if (roll < 0.1) return choices[0]; // 1
        if (roll < 0.2) return choices[1]; // 2
        if (roll < 0.45) return choices[2]; // 3
        if (roll < 0.8) return choices[3]; // 4
        return choices[4]; // 5
      }
      return pickRandom(choices);

    case "checkbox":
      if (choices.length === 0) return [];
      // Pick between 1 and 3 random items
      const count = Math.min(choices.length, Math.floor(Math.random() * 3) + 1);
      const shuffled = [...choices].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);

    case "text": {
      const titleLower = question.title.toLowerCase();
      
      // 1. Check common fields first to keep data realistic
      if (titleLower.includes("name")) {
        const names = [
          "Jean Damascene", "Aline", "Eric", "Divine", "Fiona", "Cedric", "Patrick", 
          "Marie", "Emmanuel", "Claude", "Angelique", "Christian", "Grace", "Sandrine"
        ];
        return pickRandom(names);
      }
      if (titleLower.includes("email")) {
        const domains = ["gmail.com", "yahoo.com", "ur.ac.rw", "outlook.com"];
        const prefixes = ["damascene", "aline.m", "eric.biz", "divine.u", "fiona.k", "cedric.n"];
        return `${pickRandom(prefixes)}@${pickRandom(domains)}`;
      }
      if (titleLower.includes("phone") || titleLower.includes("mobile") || titleLower.includes("telephone")) {
        return `078${Math.floor(1000000 + Math.random() * 9000000)}`;
      }
      if (titleLower.includes("live") || titleLower.includes("address") || titleLower.includes("location") || titleLower.includes("residence") || titleLower.includes("where")) {
        const locations = ["Kigali", "Gasabo", "Kicukiro", "Nyarugenge", "Gisenyi", "Musanze", "Butare"];
        return pickRandom(locations);
      }
      if (titleLower.includes("married") || titleLower.includes("status") || titleLower.includes("relationship")) {
        return pickRandom(["Single", "Married", "Single", "Married"]);
      }

      // 2. Generic fallback depending on question length
      if (question.isParagraph) {
        return generateRecommendationText(formTitle);
      } else {
        const fallbackShortAnswers = [
          "N/A", "None", "Okay", "Satisfied", "Good", "Very good", "Yes", "No", 
          "Not sure", "Great", "Excellent", "Everything is fine", "No comment", "Agree"
        ];
        return pickRandom(fallbackShortAnswers);
      }
    }

    default:
      return "";
  }
}
